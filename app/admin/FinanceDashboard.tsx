'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CalendarClock, ChevronLeft, ChevronRight, CreditCard, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Feedback } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form-controls';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';

const TIMEZONE = 'America/Porto_Velho';
const PAGE_SIZE = 10;
const PAYMENT_STATUSES = [
  { value: 'all', label: 'Todos os status' },
  { value: 'paid', label: 'Pagos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'failed', label: 'Falhos' },
  { value: 'expired', label: 'Expirados' },
  { value: 'refunded', label: 'Estornados' },
];

type FinancePayment = {
  id: string;
  reservation_id: string;
  provider: string;
  provider_order_id: string;
  method: string;
  status: string;
  amount: number | string;
  currency: string;
  paid_at: string | null;
  created_at: string;
  reservation: {
    name: string;
    email: string | null;
    whatsapp: string;
    reservation_date: string;
    reservation_time: string;
  } | null;
};

type FinancePayload = {
  payments: FinancePayment[];
  summary: { paidCount: number; totalPaid: number; pendingCount: number };
};

function dateInRestaurantTimezone(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function defaultRange() {
  const today = dateInRestaurantTimezone(new Date());
  const [year, month] = today.split('-');
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function formatCurrency(value: number | string, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value) || 0);
}

function formatDateTime(value: string | null) {
  if (!value) return 'Ainda não pago';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TIMEZONE,
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    failed: 'Falhou',
    expired: 'Expirado',
    refunded: 'Estornado',
  };
  return labels[status] || status;
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'refunded') return 'neutral';
  return 'danger';
}

export default function FinanceDashboard() {
  const initialRange = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [status, setStatus] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState({ ...initialRange, status: 'all' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<FinancePayload>({ payments: [], summary: { paidCount: 0, totalPaid: 0, pendingCount: 0 } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFinance = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(appliedFilters);
      const response = await fetch(`/api/admin/finance?${params}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o financeiro.');
      setPayload(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o financeiro.');
      if (!silent) setPayload({ payments: [], summary: { paidCount: 0, totalPaid: 0, pendingCount: 0 } });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadFinance(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadFinance]);

  const payments = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return payload.payments;
    return payload.payments.filter((payment) => [
      payment.reservation?.name,
      payment.reservation?.email,
      payment.reservation?.whatsapp,
      payment.provider_order_id,
    ].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)));
  }, [payload.payments, search]);

  const pageCount = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagePayments = payments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstVisible = payments.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min(currentPage * PAGE_SIZE, payments.length);

  const applyFilters = () => {
    if (!from || !to || from > to) {
      setError('Informe um período válido: a data inicial deve ser anterior ou igual à data final.');
      return;
    }
    setError('');
    setPage(1);
    setAppliedFilters({ from, to, status });
  };

  return <div className="space-y-4 sm:space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <p className="max-w-2xl text-xs leading-5 text-[#76695e]">Pagamentos de reservas no fuso de Porto Velho. O total recebido considera somente pagamentos confirmados.</p>
      <Button type="button" variant="secondary" onClick={() => void loadFinance(true)} disabled={loading || refreshing} className="w-full sm:w-auto">
        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Atualizar
      </Button>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="Total recebido" value={formatCurrency(payload.summary.totalPaid)} detail="Pagamentos confirmados no período" icon={<BadgeDollarSign size={20} />} tone="success" />
      <MetricCard label="Pagamentos confirmados" value={payload.summary.paidCount} detail="Data considerada: confirmação do pagamento" icon={<CreditCard size={20} />} />
      <MetricCard label="Aguardando pagamento" value={payload.summary.pendingCount} detail="Dentro do período selecionado" icon={<CalendarClock size={20} />} tone={payload.summary.pendingCount ? 'warning' : 'default'} />
    </div>

    <Card>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(12rem,0.8fr)_minmax(16rem,1.4fr)_auto] xl:items-end">
          <label>
            <span className="ui-field-label">De</span>
            <Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span className="ui-field-label">Até</span>
            <Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label>
            <span className="ui-field-label">Status</span>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              {PAYMENT_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </label>
          <label>
            <span className="ui-field-label">Buscar cliente ou pedido</span>
            <span className="relative block">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#76695e]" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, e-mail, telefone ou pedido" className="pl-9" />
            </span>
          </label>
          <Button type="button" onClick={applyFilters} disabled={loading || refreshing} className="w-full xl:w-auto">
            Aplicar filtros
          </Button>
        </div>

        {error && <Feedback tone="error" role="alert">{error}</Feedback>}
        {loading ? <p className="py-12 text-center text-sm text-[#76695e]">Carregando pagamentos…</p> : payments.length === 0 ? (
          <EmptyState icon={<CreditCard size={28} />} title="Nenhum pagamento encontrado" description="Tente alterar o período, status ou busca." />
        ) : <>
          <p className="text-xs text-[#76695e]" aria-live="polite">Mostrando {firstVisible}–{lastVisible} de {payments.length} {payments.length === 1 ? 'pagamento' : 'pagamentos'}</p>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#D9CFC1] text-[10px] uppercase tracking-wider text-[#76695e]">
                  <th scope="col" className="px-3 py-3">Pagamento</th>
                  <th scope="col" className="px-3 py-3">Cliente</th>
                  <th scope="col" className="px-3 py-3">Reserva</th>
                  <th scope="col" className="px-3 py-3">Método / provedor</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {pagePayments.map((payment) => <tr key={payment.id} className="border-b border-[#D9CFC1]/60 last:border-0 hover:bg-[#FDFBF7]">
                  <td className="px-3 py-4 align-top">
                    <p className="font-semibold">{formatDateTime(payment.paid_at)}</p>
                    {!payment.paid_at && <p className="mt-1 text-xs text-[#76695e]">Criado {formatDateTime(payment.created_at)}</p>}
                    <p className="mt-1 max-w-40 truncate text-[10px] text-[#76695e]" title={payment.provider_order_id}>Pedido {payment.provider_order_id}</p>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <p className="font-semibold">{payment.reservation?.name || 'Cliente indisponível'}</p>
                    <p className="mt-1 text-xs text-[#76695e]">{payment.reservation?.email || payment.reservation?.whatsapp || '—'}</p>
                  </td>
                  <td className="px-3 py-4 align-top text-xs">
                    {payment.reservation ? <>{payment.reservation.reservation_date} · {payment.reservation.reservation_time.slice(0, 5)}</> : '—'}
                  </td>
                  <td className="px-3 py-4 align-top text-xs capitalize">{payment.method} · {payment.provider}</td>
                  <td className="px-3 py-4 align-top"><StatusBadge label={statusLabel(payment.status)} tone={statusTone(payment.status)} /></td>
                  <td className="px-3 py-4 text-right align-top font-bold">{formatCurrency(payment.amount, payment.currency)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {pagePayments.map((payment) => <article key={payment.id} className="rounded-2xl border border-[#D9CFC1] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{payment.reservation?.name || 'Cliente indisponível'}</p>
                  <p className="mt-1 break-all text-xs text-[#76695e]">{payment.reservation?.email || payment.reservation?.whatsapp || 'Contato indisponível'}</p>
                </div>
                <StatusBadge label={statusLabel(payment.status)} tone={statusTone(payment.status)} className="shrink-0" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#D9CFC1]/60 pt-3 text-xs">
                <div><p className="text-[#76695e]">Valor</p><p className="mt-1 font-bold">{formatCurrency(payment.amount, payment.currency)}</p></div>
                <div><p className="text-[#76695e]">Data do pagamento</p><p className="mt-1 font-semibold">{formatDateTime(payment.paid_at)}</p></div>
                <div><p className="text-[#76695e]">Método / provedor</p><p className="mt-1 capitalize">{payment.method} · {payment.provider}</p></div>
                <div><p className="text-[#76695e]">Reserva</p><p className="mt-1">{payment.reservation ? `${payment.reservation.reservation_date} · ${payment.reservation.reservation_time.slice(0, 5)}` : '—'}</p></div>
              </div>
            </article>)}
          </div>

          {pageCount > 1 && <nav aria-label="Paginação dos pagamentos" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D9CFC1]/70 pt-4">
            <p className="text-xs text-[#76695e]">Página {currentPage} de {pageCount}</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} aria-label="Página anterior">
                <ChevronLeft size={16} /> Anterior
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage === pageCount} aria-label="Próxima página">
                Próxima <ChevronRight size={16} />
              </Button>
            </div>
          </nav>}
        </>}
      </CardContent>
    </Card>
  </div>;
}
