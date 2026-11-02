-- Cineclub: rondas semanales, propuestas (máx. 2 por persona) y voto por aprobación.
--
-- Flujo de una ronda:  proposals ──► voting ──► closed
--   * El organizador la abre (solo puede haber una ronda abierta a la vez) y la pasa a votación.
--   * Al cerrarla (close_round) se cuenta: gana la propuesta con más votos; un empate se sortea.
--   * Los votos son secretos mientras la ronda está abierta: cada uno ve solo los suyos y quién ya votó
--     (round_voters). Al cerrar, todos ven el conteo completo.

-- ── Miembros ──────────────────────────────────────────────────────────────────────────────────────
create table public.members (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  avatar_url   text,
  is_organizer boolean not null default false,
  active       boolean not null default true,  -- el organizador puede sacar a alguien del club
  created_at   timestamptz not null default now()
);

-- Quien entra con Google por primera vez queda registrado como miembro. El primero es organizador.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (id, display_name, avatar_url, is_organizer)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                  nullif(split_part(new.email, '@', 1), ''), 'Sin nombre'), 60),
    new.raw_user_meta_data ->> 'avatar_url',
    not exists (select 1 from public.members)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = auth.uid() and active);
$$;

create function public.is_organizer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = auth.uid() and active and is_organizer);
$$;

-- ── Películas (ficha de TMDB guardada al proponerla) ──────────────────────────────────────────────
create table public.movies (
  tmdb_id        integer primary key,
  title          text not null,
  original_title text,
  year           integer,
  poster_path    text,
  overview       text,
  runtime        integer,
  director       text,
  genres         text[] not null default '{}',
  providers      jsonb not null default '[]',   -- [{name, logo_path}] de streaming en la región
  updated_at     timestamptz not null default now()
);

-- ── Rondas ────────────────────────────────────────────────────────────────────────────────────────
create type public.round_phase as enum ('proposals', 'voting', 'closed');

create table public.rounds (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (length(trim(title)) between 1 and 80),
  meeting_at         timestamptz,
  phase              public.round_phase not null default 'proposals',
  winner_proposal_id uuid,
  tie_broken         boolean not null default false,  -- la ganadora salió de un sorteo entre empatadas
  created_by         uuid references public.members (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  closed_at          timestamptz
);

-- Una sola ronda abierta a la vez: es "la de esta semana".
create unique index rounds_one_open on public.rounds ((true)) where phase <> 'closed';
create index rounds_created_at on public.rounds (created_at desc);

-- ── Propuestas ────────────────────────────────────────────────────────────────────────────────────
create table public.proposals (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.rounds (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade default auth.uid(),
  tmdb_id    integer not null references public.movies (tmdb_id),
  pitch      text check (length(pitch) <= 280),
  created_at timestamptz not null default now(),
  unique (round_id, tmdb_id)  -- la misma película no se propone dos veces en una ronda
);
create index proposals_round on public.proposals (round_id);

alter table public.rounds add constraint rounds_winner_fk
  foreign key (winner_proposal_id) references public.proposals (id) on delete set null;

-- Máximo 2 propuestas por persona en cada ronda.
create function public.check_proposal_limit() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.round_id::text || new.member_id::text));
  if (select count(*) from public.proposals
      where round_id = new.round_id and member_id = new.member_id) >= 2 then
    raise exception 'Ya hiciste tus 2 propuestas de esta ronda' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger proposals_limit before insert on public.proposals
  for each row execute function public.check_proposal_limit();

-- ── Votos (aprobación: una fila por cada película que la persona vería con gusto) ─────────────────
create table public.votes (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade default auth.uid(),
  round_id    uuid not null references public.rounds (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (proposal_id, member_id)
);
create index votes_round on public.votes (round_id);

-- round_id se copia de la propuesta (no se confía en el que manda el cliente).
create function public.set_vote_round() returns trigger
language plpgsql as $$
begin
  select round_id into new.round_id from public.proposals where id = new.proposal_id;
  return new;
end $$;

create trigger votes_set_round before insert on public.votes
  for each row execute function public.set_vote_round();

create function public.round_phase_of(p_round uuid) returns public.round_phase
language sql stable security definer set search_path = public as $$
  select phase from rounds where id = p_round;
$$;

-- ── Seguridad (RLS) ───────────────────────────────────────────────────────────────────────────────
alter table public.members   enable row level security;
alter table public.movies    enable row level security;
alter table public.rounds    enable row level security;
alter table public.proposals enable row level security;
alter table public.votes     enable row level security;

-- Miembros: todos los del club se ven; cada uno edita su nombre; el organizador gestiona el resto.
create policy members_select on public.members for select to authenticated
  using (public.is_member() or id = auth.uid());
create policy members_update on public.members for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Solo el organizador cambia is_organizer / active (nadie se da permisos a sí mismo).
revoke update on public.members from authenticated;
grant update (display_name) on public.members to authenticated;
create function public.set_member_role(p_member uuid, p_organizer boolean, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer() then raise exception 'Solo el organizador puede hacer esto'; end if;
  if p_member = auth.uid() and (not p_organizer or not p_active) then
    raise exception 'No puedes quitarte el rol de organizador a ti mismo';
  end if;
  update members set is_organizer = p_organizer, active = p_active where id = p_member;
end $$;

-- Películas: lectura y alta para miembros (es solo la ficha pública de TMDB).
create policy movies_select on public.movies for select to authenticated using (public.is_member());
create policy movies_insert on public.movies for insert to authenticated with check (public.is_member());
create policy movies_update on public.movies for update to authenticated
  using (public.is_member()) with check (public.is_member());

-- Rondas: todos las ven; el organizador las crea y cambia de fase (cerrar va por close_round).
create policy rounds_select on public.rounds for select to authenticated using (public.is_member());
create policy rounds_insert on public.rounds for insert to authenticated
  with check (public.is_organizer() and phase = 'proposals');
create policy rounds_update on public.rounds for update to authenticated
  using (public.is_organizer() and phase <> 'closed')
  with check (public.is_organizer() and phase <> 'closed');
create policy rounds_delete on public.rounds for delete to authenticated
  using (public.is_organizer() and phase <> 'closed');
revoke insert, update on public.rounds from authenticated;
grant insert (title, meeting_at) on public.rounds to authenticated;
grant update (title, meeting_at, phase) on public.rounds to authenticated;

-- Propuestas: se agregan y retiran solo en fase de propuestas; el organizador puede retirar cualquiera.
create policy proposals_select on public.proposals for select to authenticated using (public.is_member());
create policy proposals_insert on public.proposals for insert to authenticated
  with check (public.is_member() and member_id = auth.uid()
              and public.round_phase_of(round_id) = 'proposals');
create policy proposals_update on public.proposals for update to authenticated
  using (public.is_member() and member_id = auth.uid() and public.round_phase_of(round_id) = 'proposals')
  with check (member_id = auth.uid());
revoke update on public.proposals from authenticated;
grant update (pitch) on public.proposals to authenticated;
create policy proposals_delete on public.proposals for delete to authenticated
  using (((public.is_member() and member_id = auth.uid()) or public.is_organizer())
         and public.round_phase_of(round_id) = 'proposals');

-- Votos: cada uno ve los suyos; con la ronda cerrada, todos ven todos. Solo se vota en fase de votación.
create policy votes_select on public.votes for select to authenticated
  using (member_id = auth.uid() or (public.is_member() and public.round_phase_of(round_id) = 'closed'));
create policy votes_insert on public.votes for insert to authenticated
  with check (public.is_member() and member_id = auth.uid()
              and public.round_phase_of(round_id) = 'voting');
create policy votes_delete on public.votes for delete to authenticated
  using (public.is_member() and member_id = auth.uid() and public.round_phase_of(round_id) = 'voting');

-- Quién ya votó en una ronda (sin revelar por qué película), para ver la participación.
create function public.round_voters(p_round uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct member_id from votes where round_id = p_round and is_member();
$$;

-- Cierra la ronda: gana la propuesta más votada; si hay empate, se sortea entre las empatadas.
create function public.close_round(p_round uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_phase  round_phase;
  v_winner uuid;
  v_tied   integer;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede cerrar la ronda'; end if;
  select phase into v_phase from rounds where id = p_round for update;
  if v_phase is null then raise exception 'La ronda no existe'; end if;
  if v_phase <> 'voting' then raise exception 'La ronda tiene que estar en votación para cerrarla'; end if;

  with tally as (
    select p.id, count(v.member_id) as n
    from proposals p left join votes v on v.proposal_id = p.id
    where p.round_id = p_round
    group by p.id
  ), top as (
    select id from tally where n = (select max(n) from tally)
  )
  select (select id from top order by random() limit 1), (select count(*) from top)
  into v_winner, v_tied;

  update rounds
     set phase = 'closed', closed_at = now(), winner_proposal_id = v_winner, tie_broken = v_tied > 1
   where id = p_round;
  return v_winner;
end $$;

revoke execute on function public.close_round(uuid), public.set_member_role(uuid, boolean, boolean),
  public.round_voters(uuid) from public, anon;

-- ── Tiempo real: la página se actualiza sola cuando alguien propone o cambia la fase ───────────────
-- `votes` queda fuera a propósito: los eventos de borrado no pasan por RLS y revelarían quién quitó
-- qué voto. La participación (round_voters) se refresca consultando cada pocos segundos.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rounds, public.proposals, public.members;
  end if;
end $$;
