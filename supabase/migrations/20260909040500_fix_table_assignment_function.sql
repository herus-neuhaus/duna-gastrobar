create or replace function public.replace_reservation_table_assignments(
  p_reservation_id uuid,
  p_table_ids uuid[],
  p_assigned_by uuid default null
)
returns table (id uuid, table_id uuid, allocated_capacity integer, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
  occupancy record;
  selected_count integer;
  selected_min_capacity integer;
  selected_max_capacity integer;
  selected_area_count integer;
begin
  select * into reservation_row from public.reservations where reservations.id = p_reservation_id for update;
  if reservation_row.id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if lower(coalesce(reservation_row.status, 'pending')) not in ('pending', 'confirmed', 'seated') then raise exception 'RESERVATION_NOT_ASSIGNABLE'; end if;
  if p_table_ids is null or cardinality(p_table_ids) = 0 or cardinality(p_table_ids) <> cardinality(array(select distinct unnest(p_table_ids))) then raise exception 'INVALID_TABLE_SELECTION'; end if;
  perform pg_advisory_xact_lock(hashtext('restaurant-table:' || tables_to_lock.table_id::text)) from (select unnest(p_table_ids) as table_id order by 1) tables_to_lock;
  select count(*), coalesce(sum(min_capacity), 0), coalesce(sum(max_capacity), 0), count(distinct area_id) into selected_count, selected_min_capacity, selected_max_capacity, selected_area_count from public.restaurant_tables where restaurant_tables.id = any(p_table_ids) and active;
  if selected_count <> cardinality(p_table_ids) then raise exception 'TABLE_NOT_AVAILABLE'; end if;
  if selected_area_count <> 1 then raise exception 'TABLES_MUST_SHARE_AREA'; end if;
  if reservation_row.num_guests not between selected_min_capacity and selected_max_capacity then raise exception 'TABLE_CAPACITY_INSUFFICIENT'; end if;
  select * into occupancy from public.get_reservation_occupancy_window(p_reservation_id);
  update public.reservation_table_assignments set released_at = now() where reservation_id = p_reservation_id and released_at is null;
  return query insert into public.reservation_table_assignments (reservation_id, table_id, allocated_capacity, starts_at, ends_at, assigned_by) select p_reservation_id, restaurant_tables.id, restaurant_tables.max_capacity, occupancy.starts_at, occupancy.ends_at, p_assigned_by from public.restaurant_tables where restaurant_tables.id = any(p_table_ids) returning reservation_table_assignments.id, reservation_table_assignments.table_id, reservation_table_assignments.allocated_capacity, reservation_table_assignments.starts_at, reservation_table_assignments.ends_at;
end;
$$;
