-- Pruebas de las reglas del cineclub. Cada bloque falla con un error si una regla no se cumple.
\set QUIET on
set client_min_messages = notice;
\o /dev/null

-- Ayudantes (como superusuario).
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  execute 'set role authenticated';
end $$;

create function pg_temp.must_fail(p_sql text, p_what text) returns void language plpgsql as $$
declare v_rows integer;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception when others then
    raise notice 'ok  (bloqueado) %: %', p_what, sqlerrm;
    return;
  end;
  if v_rows = 0 and p_sql ~* '^\s*(update|delete)' then
    raise notice 'ok  (sin efecto) %', p_what;
    return;
  end if;
  raise exception 'FALLO: debía bloquearse — %', p_what;
end $$;

grant execute on all functions in schema pg_temp to authenticated;

-- Cuatro amigos entran con Google: Ana (primera → organizadora), Beto, Caro y Dani.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@x.com',  '{"full_name":"Ana","avatar_url":"http://a"}'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@x.com', '{"name":"Beto"}'),
  ('00000000-0000-0000-0000-00000000000c', 'caro@x.com', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'dani@x.com', '{"full_name":"Dani"}');

do $$ begin
  assert (select display_name from members where id = '00000000-0000-0000-0000-00000000000c') = 'caro',
    'el nombre cae al correo si Google no lo manda';
  assert (select count(*) from members where is_organizer) = 1, 'solo el primero es organizador';
  assert (select is_organizer from members where display_name = 'Ana'), 'Ana es organizadora';
  raise notice 'ok  miembros creados al entrar; el primero es organizador';
end $$;

insert into movies (tmdb_id, title, year) values (1, 'Perfect Days', 2023), (2, 'Aftersun', 2022),
  (3, 'Past Lives', 2023), (4, 'Close', 2022), (5, 'Drive My Car', 2021);

-- ── Permisos de organizador ───────────────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.must_fail($$insert into rounds (title) values ('Ronda de Beto')$$, 'un no organizador abre ronda');
select pg_temp.must_fail($$update members set is_organizer = true where id = auth.uid()$$, 'Beto se hace organizador');
select pg_temp.must_fail($$select set_member_role(auth.uid(), true, true)$$, 'Beto usa set_member_role');
update members set display_name = 'Beto R.' where id = auth.uid();
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into rounds (title) values ('Viernes 6/11');
select pg_temp.must_fail($$insert into rounds (title) values ('Otra')$$, 'dos rondas abiertas a la vez');
select pg_temp.must_fail($$insert into rounds (title, phase) values ('X', 'closed')$$, 'crear ronda ya cerrada');
reset role;
do $$ begin
  assert (select display_name from members where id = '00000000-0000-0000-0000-00000000000b') = 'Beto R.',
    'cada uno cambia su nombre';
  raise notice 'ok  solo el organizador abre rondas; nadie se da permisos';
end $$;

-- ── Propuestas: máximo 2 por persona, sin repetir película ────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into proposals (round_id, tmdb_id, pitch) select id, 1, 'Wenders!' from rounds;
insert into proposals (round_id, tmdb_id) select id, 2 from rounds;
select pg_temp.must_fail($$insert into proposals (round_id, tmdb_id) select id, 3 from rounds$$, 'tercera propuesta');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.must_fail($$insert into proposals (round_id, tmdb_id) select id, 1 from rounds$$, 'película repetida');
select pg_temp.must_fail($$insert into proposals (round_id, tmdb_id, member_id)
  select id, 3, '00000000-0000-0000-0000-00000000000d' from rounds$$, 'proponer a nombre de otro');
insert into proposals (round_id, tmdb_id) select id, 3 from rounds;
select pg_temp.must_fail($$delete from proposals where tmdb_id = 1$$, 'Caro retira la propuesta de Beto');
select pg_temp.must_fail($$insert into votes (proposal_id) select id from proposals limit 1$$, 'votar en fase de propuestas');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
insert into proposals (round_id, tmdb_id) select id, 4 from rounds;
reset role;
do $$ begin
  assert (select count(*) from proposals) = 4, 'quedan 4 propuestas';
  raise notice 'ok  2 propuestas por persona, sin repetidas, cada uno las suyas';
end $$;

-- ── Votación por aprobación ───────────────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.must_fail($$update rounds set phase = 'voting'$$, 'Beto pasa la ronda a votación');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.must_fail($$update rounds set phase = 'closed'$$, 'cerrar sin contar los votos');
update rounds set phase = 'voting';
reset role;

-- Ana: 1 y 3. Beto: 1 y 2. Caro: 3. Dani: 1, 3 y 4.  →  Perfect Days 3, Past Lives 3 (empate), Aftersun 1, Close 1.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.must_fail($$insert into proposals (round_id, tmdb_id) select id, 5 from rounds$$, 'proponer durante la votación');
insert into votes (proposal_id) select id from proposals where tmdb_id in (1, 3);
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into votes (proposal_id) select id from proposals where tmdb_id in (1, 2, 4);
delete from votes where proposal_id = (select id from proposals where tmdb_id = 4);  -- cambia de opinión
select pg_temp.must_fail($$insert into votes (proposal_id) select id from proposals where tmdb_id = 1$$, 'votar dos veces la misma');
select pg_temp.must_fail($$insert into votes (proposal_id, member_id) select id, '00000000-0000-0000-0000-00000000000c'
  from proposals where tmdb_id = 2$$, 'votar a nombre de otro');
do $$ begin
  assert (select count(*) from votes) = 2, 'durante la votación cada uno ve solo sus votos';
  assert (select count(*) from round_voters((select id from rounds))) = 2, 'se ve quién ya votó';
  raise notice 'ok  votos secretos durante la votación; participación visible';
end $$;
select pg_temp.must_fail($$select close_round((select id from rounds))$$, 'Beto cierra la ronda');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into votes (proposal_id) select id from proposals where tmdb_id = 3;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
insert into votes (proposal_id) select id from proposals where tmdb_id in (1, 3, 4);
reset role;

-- Un miembro dado de baja ya no ve ni vota.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_member_role('00000000-0000-0000-0000-00000000000d', false, false);
select pg_temp.must_fail($$select set_member_role(auth.uid(), false, true)$$, 'la organizadora se quita el rol');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from proposals) = 0, 'un dado de baja no ve propuestas';
end $$;
select pg_temp.must_fail($$delete from votes$$, 'un dado de baja quita votos');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_member_role('00000000-0000-0000-0000-00000000000d', false, true);

-- ── Cierre: gana la más votada; el empate se sortea ──────────────────────────────────────────────
select close_round((select id from rounds));
do $$
declare v_title text; v_tie boolean;
begin
  select m.title, r.tie_broken into v_title, v_tie
  from rounds r join proposals p on p.id = r.winner_proposal_id join movies m on m.tmdb_id = p.tmdb_id;
  assert v_title in ('Perfect Days', 'Past Lives'), 'gana una de las empatadas, no ' || v_title;
  assert v_tie, 'se marca que hubo sorteo';
  assert (select count(*) from votes) = 8, 'cerrada la ronda, todos ven todos los votos';
  raise notice 'ok  cierre: ganó % por sorteo entre empatadas; conteo visible', v_title;
end $$;
select pg_temp.must_fail($$update rounds set title = 'cambiada'$$, 'editar una ronda cerrada');
select pg_temp.must_fail($$select close_round((select id from rounds))$$, 'cerrar dos veces');
insert into rounds (title) values ('Viernes 13/11');  -- ya se puede abrir la siguiente
reset role;

-- Una ronda con una ganadora clara no se marca como sorteo.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into proposals (round_id, tmdb_id) select id, 5 from rounds where phase = 'proposals';
insert into proposals (round_id, tmdb_id) select id, 2 from rounds where phase = 'proposals';
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update rounds set phase = 'voting' where phase = 'proposals';
insert into votes (proposal_id) select p.id from proposals p join rounds r on r.id = p.round_id
  where r.phase = 'voting' and p.tmdb_id = 5;
select close_round((select id from rounds where phase = 'voting'));
do $$ begin
  assert (select m.title from rounds r join proposals p on p.id = r.winner_proposal_id
          join movies m on m.tmdb_id = p.tmdb_id where r.title = 'Viernes 13/11') = 'Drive My Car', 'gana la más votada';
  assert not (select tie_broken from rounds where title = 'Viernes 13/11'), 'sin sorteo';
  raise notice 'ok  ganadora clara sin sorteo';
end $$;
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.must_fail($$update rounds set winner_proposal_id = null$$, 'cambiar la ganadora a mano');
reset role;

\echo 'TODAS LAS PRUEBAS PASARON'
