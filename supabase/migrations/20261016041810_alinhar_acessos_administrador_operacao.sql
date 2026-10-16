begin;

-- Administrador é o nível completo. "dono" permanece como alias legado;
-- os demais cargos internos são operacionais, sem promoção em massa.
create or replace function public.is_reservation_owner()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid()
    and role in ('admin', 'dono') and not coalesce(force_password_change, false));
$$;

create or replace function private.is_manager()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.is_reservation_owner(); $$;

create or replace function private.is_reservation_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid()
    and role in ('admin', 'dono', 'employee', 'gerente', 'receptionist', 'portaria')
    and not coalesce(force_password_change, false));
$$;

create or replace function public.can_override_reservation_capacity()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_reservation_owner() or exists (
    select 1 from public.reservation_capacity_permissions permission
    join public.profiles profile on profile.id = permission.profile_id
    where permission.profile_id = auth.uid() and permission.revoked_at is null
      and profile.role in ('employee', 'gerente', 'receptionist', 'portaria')
      and not coalesce(profile.force_password_change, false)
  );
$$;

create or replace function public.set_reservation_capacity_permission(p_profile_id uuid, p_granted boolean, p_reason text)
returns table (updated_profile_id uuid, granted boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare change_reason text := nullif(btrim(p_reason), ''); actor_id uuid := auth.uid(); target_role text;
begin
  if not public.is_reservation_owner() then raise exception 'OWNER_REQUIRED'; end if;
  if p_profile_id = actor_id then raise exception 'CAPACITY_PERMISSION_SELF_ASSIGNMENT_FORBIDDEN'; end if;
  if change_reason is null or char_length(change_reason) not between 3 and 1000 then raise exception 'INVALID_CAPACITY_PERMISSION_REASON'; end if;
  select role into target_role from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if target_role not in ('admin', 'dono', 'employee', 'gerente', 'receptionist', 'portaria') then raise exception 'CAPACITY_PERMISSION_TARGET_NOT_PANEL_STAFF'; end if;
  if p_granted then
    insert into public.reservation_capacity_permissions (profile_id, granted_by, granted_at, revoked_by, revoked_at)
    values (p_profile_id, actor_id, now(), null, null)
    on conflict on constraint reservation_capacity_permissions_pkey do update
      set granted_by = excluded.granted_by, granted_at = excluded.granted_at, revoked_by = null, revoked_at = null;
  else
    update public.reservation_capacity_permissions as permission set revoked_by = actor_id, revoked_at = now()
      where permission.profile_id = p_profile_id and permission.revoked_at is null;
    if not found then raise exception 'CAPACITY_PERMISSION_NOT_ACTIVE'; end if;
  end if;
  insert into public.reservation_capacity_permission_audits (profile_id, actor_id, action, reason)
    values (p_profile_id, actor_id, case when p_granted then 'granted' else 'revoked' end, change_reason);
  return query select p_profile_id, p_granted;
end; $$;

-- Financeiro completo é administrativo, inclusive no acesso direto ao banco.
drop policy if exists "Reservation staff can read reservation payments" on public.reservation_payments;
create policy "Administradores consultam pagamentos" on public.reservation_payments
  for select to authenticated using ((select private.is_manager()));
grant select on public.reservation_payments to authenticated;

-- Dados necessários ao checklist e ao contato operacional. A escrita continua
-- nas policies administrativas já existentes, baseadas em private.is_manager.
create policy "Equipe consulta cargos operacionais" on public.employee_roles
  for select to authenticated using ((select private.is_reservation_staff()));
create policy "Equipe consulta categorias de tarefas" on public.task_categories
  for select to authenticated using ((select private.is_reservation_staff()));
create policy "Equipe consulta modelos de mensagens" on public.whatsapp_templates
  for select to authenticated using ((select private.is_reservation_staff()));

-- IDs são snapshots intencionalmente sem FK: a exclusão posterior de uma conta
-- não deve apagar ou modificar a trilha imutável de acessos concedidos.
create table public.alteracoes_cargos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null,
  autor_id uuid,
  cargo_anterior text,
  cargo_novo text,
  origem text not null check (origem in ('administrador', 'manutencao')),
  motivo text not null,
  criado_em timestamptz not null default now()
);
create index alteracoes_cargos_perfil_idx on public.alteracoes_cargos (perfil_id, criado_em);
create index alteracoes_cargos_autor_idx on public.alteracoes_cargos (autor_id);
alter table public.alteracoes_cargos enable row level security;
grant select on public.alteracoes_cargos to authenticated;
grant select, insert on public.alteracoes_cargos to service_role;
revoke insert, update, delete, truncate on public.alteracoes_cargos from public, anon, authenticated;
create policy "Administradores consultam alteracoes de cargos" on public.alteracoes_cargos
  for select to authenticated using ((select private.is_manager()));
create trigger alteracoes_cargos_imutaveis before update or delete on public.alteracoes_cargos
  for each row execute function public.reject_capacity_audit_mutation();

create or replace function private.prevent_profile_privilege_escalation()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  novo_cargo text;
  novo_ativo boolean;
  manutencao boolean := session_user in ('postgres', 'supabase_admin')
    and auth.uid() is null and coalesce(current_setting('role', true), 'none') in ('none', 'postgres', 'supabase_admin');
begin
  if tg_op = 'DELETE' then novo_cargo := null; novo_ativo := false;
  else
    novo_cargo := new.role;
    novo_ativo := not coalesce(new.force_password_change, false);
    if new.role is not distinct from old.role and new.job_role_id is not distinct from old.job_role_id
      and new.force_password_change is not distinct from old.force_password_change then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('administracao:cargos'));
  if auth.uid() = old.id then raise exception 'CANNOT_CHANGE_OWN_ACCESS'; end if;
  if auth.uid() is not null and not private.is_manager() then raise exception 'ADMIN_REQUIRED'; end if;
  if not manutencao and old.role in ('admin', 'dono') and (coalesce(novo_cargo, '') not in ('admin', 'dono') or not novo_ativo)
    and not exists (select 1 from public.profiles where id <> old.id and role in ('admin', 'dono') and not coalesce(force_password_change, false)) then
    raise exception 'LAST_ADMIN_REQUIRED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

create trigger proteger_exclusao_administrador before delete on public.profiles
  for each row execute function private.prevent_profile_privilege_escalation();

create function private.registrar_alteracao_cargo()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$ begin
  if tg_op = 'DELETE' then
    insert into public.alteracoes_cargos (perfil_id, autor_id, cargo_anterior, cargo_novo, origem, motivo)
      values (old.id, auth.uid(), old.role, null, case when auth.uid() is null then 'manutencao' else 'administrador' end,
        coalesce(nullif(current_setting('app.motivo_alteracao_cargo', true), ''), 'Exclusão de perfil'));
    return old;
  end if;
  if new.role is distinct from old.role then
    insert into public.alteracoes_cargos (perfil_id, autor_id, cargo_anterior, cargo_novo, origem, motivo)
      values (new.id, auth.uid(), old.role, new.role, case when auth.uid() is null then 'manutencao' else 'administrador' end,
        coalesce(nullif(current_setting('app.motivo_alteracao_cargo', true), ''), 'Alteração de nível de acesso'));
  end if;
  return new;
end; $$;
create trigger registrar_alteracao_cargo after update of role or delete on public.profiles
  for each row execute function private.registrar_alteracao_cargo();

revoke all on function private.is_manager(), private.is_reservation_staff(), private.prevent_profile_privilege_escalation(),
  private.registrar_alteracao_cargo() from public, anon;
grant execute on function private.is_manager(), private.is_reservation_staff() to authenticated;
revoke all on function private.prevent_profile_privilege_escalation(), private.registrar_alteracao_cargo() from authenticated;
revoke all on function public.is_reservation_owner(), public.can_override_reservation_capacity(),
  public.set_reservation_capacity_permission(uuid, boolean, text) from public, anon;
grant execute on function public.is_reservation_owner(), public.can_override_reservation_capacity(),
  public.set_reservation_capacity_permission(uuid, boolean, text) to authenticated;

commit;
