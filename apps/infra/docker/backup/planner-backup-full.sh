#!/bin/sh
# Scheduled full base backup. The cadence (every N days at 01:00 UTC) comes
# from the cron schedule in /etc/crontabs/postgres, rendered by entrypoint.sh.
# pgBackRest auto-expires superseded backups after a successful run; the OCI
# bucket lifecycle policy is the enforcement layer for WAL archive retention.
set -eu

STANZA="$(cat /etc/pgbackrest/stanza 2>/dev/null || echo planner)"

exec pgbackrest --stanza="${STANZA}" --type=full backup --log-level-console=info