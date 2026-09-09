revoke all on function public.is_manager() from public, anon, authenticated;
revoke all on function public.is_reservation_staff() from public, anon, authenticated;
revoke all on function public.can_access_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_start_task(uuid, date) from public, anon, authenticated;
revoke all on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_reservation_staff() to authenticated;
grant execute on function public.can_access_task(uuid, uuid) to authenticated;
grant execute on function public.can_start_task(uuid, date) to authenticated;
