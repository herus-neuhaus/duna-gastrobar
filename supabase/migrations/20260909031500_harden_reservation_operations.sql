begin;

create index if not exists reservations_special_date_id_idx
  on public.reservations (special_date_id);

-- Local reconstruction: the preceding local file already includes this policy.
-- Remote 20260909022933 did not; 20260909024121 created it once.
drop policy if exists "No direct access to reservation recovery challenges"
  on public.reservation_recovery_challenges;
create policy "No direct access to reservation recovery challenges"
  on public.reservation_recovery_challenges for all using (false) with check (false);

revoke all on function public.record_reservation_event() from public, anon, authenticated;
revoke all on function public.record_reservation_payment_event() from public, anon, authenticated;

commit;
