#!/usr/bin/env bash
# Starts or stops a private Postgres and Redis for local development when Docker is not running.
# Data lives in .localdev/ (git-ignored). Postgres listens on 5433 and Redis on 6380, so they
# do not disturb anything else on the machine.
#   scripts/dev-services.sh start | stop | status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.localdev"
PGDATA="$DIR/pg"
PGPORT=5433
REDISPORT=6380

start() {
  mkdir -p "$DIR"
  if [ ! -d "$PGDATA" ]; then
    initdb -D "$PGDATA" -U lumen --auth=trust -E UTF8 >/dev/null
  fi
  if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
    pg_ctl -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -k $DIR" -l "$DIR/pg.log" -w start >/dev/null
  fi
  for db in lumen_dev lumen_test; do
    psql -h 127.0.0.1 -p "$PGPORT" -U lumen -d postgres -tAc "select 1 from pg_database where datname='$db'" | grep -q 1 \
      || createdb -h 127.0.0.1 -p "$PGPORT" -U lumen "$db"
  done
  if ! redis-cli -p "$REDISPORT" ping >/dev/null 2>&1; then
    redis-server --port "$REDISPORT" --bind 127.0.0.1 --daemonize yes --dir "$DIR" --save "" --logfile "$DIR/redis.log" >/dev/null
  fi
  status
}

stop() {
  pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  redis-cli -p "$REDISPORT" shutdown nosave >/dev/null 2>&1 || true
  echo "stopped"
}

status() {
  pg_isready -h 127.0.0.1 -p "$PGPORT" || true
  redis-cli -p "$REDISPORT" ping 2>/dev/null | sed 's/^/redis: /' || echo "redis: down"
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "usage: $0 start|stop|status" >&2; exit 2 ;;
esac
