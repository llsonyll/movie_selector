#!/usr/bin/env bash
# Prueba las migraciones y reglas de seguridad en un Postgres local desechable (no toca Supabase).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
data="$(mktemp -d)"
trap 'run "\"$bin/pg_ctl\" -D \"$data\" -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$data"' EXIT
run() { if [ "$(id -u)" = 0 ]; then chown postgres "$data" 2>/dev/null; su postgres -c "$*"; else bash -c "$*"; fi; }
chmod 777 "$data"
run "'$bin/initdb' -D '$data' -A trust -U postgres >/dev/null"
run "'$bin/pg_ctl' -D '$data' -o '-p 54329 -k $data' -l '$data/log' start >/dev/null"
psql=(psql -h "$data" -p 54329 -U postgres -v ON_ERROR_STOP=1 -q -X)
"${psql[@]}" -c 'create database t' >/dev/null
"${psql[@]}" -d t -f "$here/supabase_stub.sql" >/dev/null
for f in "$here"/../migrations/*.sql; do "${psql[@]}" -d t -f "$f" >/dev/null; done
"${psql[@]}" -d t -f "$here/rules_test.sql"
