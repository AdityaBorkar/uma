#!/bin/sh
# Container entrypoint wrapper for the planner postgres image.
#
# Renders the pgBackRest config and cron schedule from environment variables
# when a backup backend is configured (non-dev stacks pass BACKUP_S3_*), then
# hands off to the stock docker-entrypoint.sh so initdb/server behavior is
# unchanged. Dev stacks leave the vars unset and this script is a pure
# pass-through.
#
# NB: backup env vars are namespaced BACKUP_* (NOT PGBACKREST_*) because
# pgBackRest reads every PGBACKREST_* env var as a config option.
set -eu

if [ -n "${BACKUP_S3_KEY:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
    STANZA="${BACKUP_STANZA:-planner}"

    mkdir -p /etc/pgbackrest /var/log/pgbackrest

    # pgBackRest config. The endpoint is the OCI Object Storage
    # S3-compatibility path-style endpoint. pgBackRest connects over the
    # local unix socket (no pg1-host) as OS user `postgres` → DB role
    # `postgres` (created by init-role-postgres.sql on first init).
    #
    # Retention: full bases retained BACKUP_RETENTION_FULL_DAYS by time;
    # the OCI bucket lifecycle policy expires base objects by the same rule
    # and WAL archive objects after BACKUP_RETENTION_ARCHIVE_DAYS. pgBackRest
    # itself must never prune WAL before the lifecycle, so repo archive
    # retention is set in full-backup units (30 × ~2d ≈ 60d), a safe upper
    # bound that defers WAL expiry to the lifecycle policy.
    cat > /etc/pgbackrest/pgbackrest.conf <<EOF
[global]
allow-root=y
repo1-type=s3
repo1-s3-bucket=${BACKUP_S3_BUCKET}
repo1-s3-endpoint=${BACKUP_S3_ENDPOINT}
repo1-s3-key=${BACKUP_S3_KEY}
repo1-s3-key-secret=${BACKUP_S3_SECRET}
repo1-s3-region=${BACKUP_S3_REGION}
repo1-s3-uri-style=path
repo1-path=${BACKUP_REPO_PATH:-/planner}
repo1-retention-full=${BACKUP_RETENTION_FULL_DAYS:-60}
repo1-retention-full-type=time
repo1-retention-archive=30
repo1-retention-archive-type=full
log-path=/var/log/pgbackrest
log-level-file=info
log-level-console=warn
process-max=${BACKUP_PROCESS_MAX:-4}

[${STANZA}]
pg1-path=${PGDATA}
pg1-user=postgres
EOF

    # Optional repo-level encryption (defense in depth on top of OCI's
    # default server-side encryption). Set backup:CIPHER_PASS to enable.
    if [ -n "${BACKUP_CIPHER_PASS:-}" ]; then
        cat >> /etc/pgbackrest/pgbackrest.conf <<EOF
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=${BACKUP_CIPHER_PASS}
EOF
    fi

    chown -R postgres:postgres /etc/pgbackrest /var/log/pgbackrest
    chmod 640 /etc/pgbackrest/pgbackrest.conf

    # Housekeeping files for the cron job (crond does not propagate env).
    printf '%s\n' "${STANZA}" > /etc/pgbackrest/stanza
    chown postgres:postgres /etc/pgbackrest/stanza

    # Per-user crontab processed by the busybox crond that the bootstrap
    # helper starts once postgres is ready.
    mkdir -p /etc/crontabs
    cat > /etc/crontabs/postgres <<EOF
# m  h  dom mon dow command  (postgres)
${BACKUP_SCHEDULE:-0 1 */2 * *} /usr/local/bin/planner-backup-full.sh
EOF
    chown postgres:postgres /etc/crontabs/postgres

    # stanza-create / check / first full backup + crond, started once postgres
    # accepts connections. Runs as the postgres user so every pgBackRest-owned
    # artifact (locks, logs) has a single owner.
    su postgres -c "BACKUP_STANZA=${STANZA} /usr/local/bin/pgbackrest-boot.sh" &
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"