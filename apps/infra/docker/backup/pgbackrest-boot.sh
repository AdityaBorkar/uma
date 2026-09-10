#!/bin/sh
# pgBackRest bootstrap for the planner postgres container, run once postgres
# accepts connections (the entrypoint starts the server concurrently):
#   1. wait for postgres
#   2. stanza-create (idempotent — ignore "already exists" on restarts)
#   3. check (validates repo credentials + archive_command end to end)
#   4. seed the very first full base backup (otherwise the first one would
#      only land at the next scheduled run, up to ~48h after bring-up)
#   5. start busybox crond, which drives the every-N-days full backup cadence
#
# Runs as the `postgres` user (the entrypoint invokes it via `su postgres`).
# BACKUP_STANZA comes from that `su` command line; crond jobs read the same
# value from /etc/pgbackrest/stanza (crond does not propagate env).
set -eu

STANZA="${BACKUP_STANZA:-planner}"

ready=0
for _ in $(seq 1 60); do
    if pg_isready -h 127.0.0.1 -p 5432 -d postgres -U postgres -q >/dev/null 2>&1; then
        ready=1
        break
    fi
    sleep 2
done

if [ "$ready" -ne 1 ]; then
    echo "pgBackRest bootstrap: postgres never became ready (timed out)." >&2
    exit 1
fi

# Create the stanza (S3 repo layout) if it does not exist yet.
pgbackrest --stanza="${STANZA}" stanza-create 2>&1 || true

# Fail hard on misconfiguration — this surfaces S3 creds, endpoint, bucket,
# and archive_command problems at bring-up instead of silently at 01:00.
pgbackrest --stanza="${STANZA}" check

# Seed the first full base backup if the repo has none.
if ! pgbackrest --stanza="${STANZA}" info --output=json 2>/dev/null | grep -q '"full"'; then
    pgbackrest --stanza="${STANZA}" --type=full backup --log-level-console=info
fi

# Keep crond in the foreground of this process so its logs flow to the
# container (docker logs), like any other long-lived sidecar.
exec crond -f -l 8 -L /proc/self/fd/2