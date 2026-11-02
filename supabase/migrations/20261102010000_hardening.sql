-- Endurecimiento según los avisos de seguridad de Supabase (Database Advisors).

-- Funciones de trigger con search_path fijo.
alter function public.check_proposal_limit() set search_path = public;
alter function public.set_vote_round() set search_path = public;

-- handle_new_user solo la dispara el alta en auth.users: nadie debe poder llamarla por la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Las funciones auxiliares de las reglas RLS salen del esquema que expone la API (/rest/v1/rpc).
-- Las políticas las referencian por OID, así que siguen funcionando sin cambios.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_member() set schema private;
alter function public.is_organizer() set schema private;
alter function public.round_phase_of(uuid) set schema private;
revoke execute on function private.is_member(), private.is_organizer(), private.round_phase_of(uuid) from public, anon;
grant execute on function private.is_member(), private.is_organizer(), private.round_phase_of(uuid) to authenticated;

-- Las funciones públicas que las usan ahora también las buscan en `private`.
alter function public.round_voters(uuid) set search_path = public, private;
alter function public.close_round(uuid) set search_path = public, private;
alter function public.set_member_role(uuid, boolean, boolean) set search_path = public, private;
