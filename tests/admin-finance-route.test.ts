import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), isFinanceStaff: vi.fn() }));

vi.mock('@/lib/auth', () => ({ isFinanceStaff: mocks.isFinanceStaff }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from '@/app/api/admin/finance/route';

function paymentQuery(data: unknown[] = []) {
  const builder: Record<string, any> = {};
  for (const method of ['select', 'in', 'gte', 'lt', 'order']) builder[method] = vi.fn(() => builder);
  builder.range = vi.fn(async () => ({ data, error: null }));
  return builder;
}

describe('/api/admin/finance', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.isFinanceStaff.mockReset();
    mocks.isFinanceStaff.mockResolvedValue(true);
  });

  it('blocks non-finance staff before querying payment data', async () => {
    mocks.isFinanceStaff.mockResolvedValue(false);
    const response = await GET(new Request('http://localhost/api/admin/finance?from=2026-10-01&to=2026-10-31'));

    expect(response.status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects invalid date ranges', async () => {
    const response = await GET(new Request('http://localhost/api/admin/finance?from=2026-10-31&to=2026-10-01'));

    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('uses Porto Velho date boundaries and summarizes only paid payments', async () => {
    const paid = paymentQuery([{ amount: '100', status: 'paid', paid_at: '2026-10-15T15:00:00Z', created_at: '2026-10-15T14:00:00Z' }]);
    const other = paymentQuery([{ amount: '50', status: 'pending', paid_at: null, created_at: '2026-10-16T15:00:00Z' }]);
    const from = vi.fn().mockReturnValueOnce(paid).mockReturnValueOnce(other);
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await GET(new Request('http://localhost/api/admin/finance?from=2026-10-01&to=2026-10-31&status=all'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toMatchObject({ paidCount: 1, totalPaid: 100, pendingCount: 1 });
    expect(body.payments).toHaveLength(2);
    expect(paid.gte).toHaveBeenCalledWith('paid_at', '2026-10-01T04:00:00.000Z');
    expect(paid.lt).toHaveBeenCalledWith('paid_at', '2026-11-01T04:00:00.000Z');
  });
});
