create index if not exists reservation_table_assignments_assigned_by_idx
  on public.reservation_table_assignments (assigned_by)
  where assigned_by is not null;
