begin;

create index if not exists reservations_special_date_id_idx
  on public.reservations (special_date_id);

create policy "No direct access to reservation recovery challenges"
  on public.reservation_recovery_challenges for all using (false) with check (false);

revoke all on function public.record_reservation_event() from public, anon, authenticated;
revoke all on function public.record_reservation_payment_event() from public, anon, authenticated;

commit;
