#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="$ROOT/fable.log"
LOCK="$ROOT/fable.lock"

exec 9>"$LOCK"
if ! flock -n 9; then
  printf '[%s] Fable adjudicator is already running\n' "$(date --iso-8601=seconds)" >>"$LOG"
  exit 1
fi

printf '[%s] Fable adjudicator started as PID %s\n' "$(date --iso-8601=seconds)" "$$" >>"$LOG"

while true; do
  output=$(node "$ROOT/fable-adjudicate.mjs" 2>&1)
  status=$?
  printf '[%s] %s\n' "$(date --iso-8601=seconds)" "$output" >>"$LOG"

  if (( status != 0 )); then
    sleep 60
    continue
  fi

  if [[ "$output" == FULL\ FABLE\ ADJUDICATION\ DONE* ]]; then
    exit 0
  fi

  sleep 5
done
