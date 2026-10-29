#!/usr/bin/env bash
# 実 PostgreSQL での同時承認レース試験。DB にマイグレーション＋シード適用済みであること。
# 使い方: PSQL="psql -h localhost -p 54322 -U postgres -d postgres" bash tests/race-pg.sh
set -euo pipefail
P="${PSQL:?PSQL を指定してください} -qtA"
KEN=c0000000-0000-4000-8000-000000000002; YUI=b0000000-0000-4000-8000-000000000005; SAK=b0000000-0000-4000-8000-000000000003
read -r A B < <($P -c "insert into bookings(man_id,woman_id,start_at,end_at,price) values ('$KEN','$YUI',now()+interval '20 days',now()+interval '20 days 2 hours',10000),('$KEN','$SAK',now()+interval '20 days 1 hour',now()+interval '20 days 3 hours',10000) returning id" | tr '\n' ' '; echo)
sess() { echo "begin; select set_config('request.jwt.claims','{\"sub\":\"$1\",\"role\":\"authenticated\"}',true); set local role authenticated; select public.accept_booking('$2')->>'status'; select pg_sleep($3); commit;" | $P 2>&1 || true; }
sess $YUI "$A" 3 > /tmp/race-a.txt & sleep 0.5; sess $SAK "$B" 0 > /tmp/race-b.txt; wait
grep -q accepted /tmp/race-a.txt && grep -q BOOKING_CONFLICT /tmp/race-b.txt && echo "PASS: 先に承認した側のみ確定、同時承認は BOOKING_CONFLICT" || { echo FAIL; cat /tmp/race-a.txt /tmp/race-b.txt; exit 1; }
