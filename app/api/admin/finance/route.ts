import { NextResponse } from 'next/server';
import { isFinanceStaff } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const PAYMENT_COLUMNS = 'id,reservation_id,provider,provider_order_id,method,status,amount,currency,paid_at,created_at,reservation:reservations!reservation_payments_reservation_id_fkey(name,email,whatsapp,reservation_date,reservation_time)';
const PAGE_SIZE = 1000;
const OTHER_PAYMENT_STATUSES = ['pending', 'failed', 'expired', 'refunded'] as const;
const VALID_STATUSES = ['all', 'paid', ...OTHER_PAYMENT_STATUSES] as const;

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function portoVelhoMidnight(date: string) {
  // Porto Velho uses UTC-04:00 and does not observe daylight saving time.
  return new Date(`${date}T00:00:00-04:00`).toISOString();
}

function addOneDay(date: string) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

async function loadPayments(
  supabase: ReturnType<typeof createAdminClient>,
  column: 'paid_at' | 'created_at',
  from: string,
  to: string,
  statuses: readonly string[],
) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('reservation_payments')
      .select(PAYMENT_COLUMNS)
      .in('status', [...statuses])
      .gte(column, from)
      .lt(column, to)
      .order(column, { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data || []) as unknown as Record<string, unknown>[]);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function GET(request: Request) {
  if (!(await isFinanceStaff())) {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const fromDate = params.get('from');
  const toDate = params.get('to');
  const status = params.get('status') || 'all';

  if (!validDate(fromDate) || !validDate(toDate) || fromDate > toDate || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: 'Informe um período e status válidos.' }, { status: 400 });
  }

  const from = portoVelhoMidnight(fromDate);
  const to = portoVelhoMidnight(addOneDay(toDate));
  try {
    const supabase = createAdminClient();
    const [paidPayments, otherPayments, pendingPayments] = await Promise.all([
      loadPayments(supabase, 'paid_at', from, to, ['paid']),
      status === 'all' || status !== 'paid'
        ? loadPayments(
          supabase,
          'created_at',
          from,
          to,
          status === 'all' ? OTHER_PAYMENT_STATUSES : [status],
        )
        : Promise.resolve([]),
      status === 'all' || status === 'pending'
        ? Promise.resolve(null)
        : loadPayments(supabase, 'created_at', from, to, ['pending']),
    ]);
    const payments = (status === 'paid' ? paidPayments : status === 'all' ? [...paidPayments, ...otherPayments] : otherPayments)
      .sort((a, b) => String(b.paid_at || b.created_at).localeCompare(String(a.paid_at || a.created_at)));
    const totalPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return NextResponse.json({
      payments,
      summary: {
        paidCount: paidPayments.length,
        totalPaid,
        pendingCount: (pendingPayments || otherPayments.filter((payment) => payment.status === 'pending')).length,
      },
      timezone: 'America/Porto_Velho',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Falha ao carregar financeiro:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os pagamentos.' }, { status: 500 });
  }
}
