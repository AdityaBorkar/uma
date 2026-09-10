# PostgreSQL Backups — Ops Runbook

Automated backups via **pgBackRest** → **OCI Object Storage** (ADR 007). This
page is the "how do I check it / recover" reference. It assumes you deployed
the production stack (`pulumi up --stack production`) and can reach the
postgres container by name (`postgres-container`, per `infra/docker/postgres.ts`).

> ⚠️ **Status (2026-08-31):** the steps below assume the backup wiring is
> **enabled**. As committed, `infra/index.ts` has the `createBackupBackend()`
> call commented out and never passes `backends` to `postgresContainer()` —
> the postgres image is stock, `$BACKUP_*` envs are absent, and archiving is
> off. Re-enable first (see ADR 007), then verify per "Verify backups are
> healthy" below.

## What runs where

| Piece | Where | Cadence |
| --- | --- | --- |
| Full base backup | pgBackRest `backup`, cron inside the postgres container | defaults 01:00 UTC every 2 days (`0 1 */2 * *`) |
| WAL archive push | postgres `archive_command` on every WAL segment | continuous ("instant"); `archive_timeout=60` floors it at ~1/min when idle |
| Retention (bases) | OCI bucket lifecycle rule `base-backups` | delete `<repoPath>/backup/*` after `RETENTION_FULL_DAYS` (60) |
| Retention (WAL) | OCI bucket lifecycle rule `wal-archive` | delete `<repoPath>/archive/*` after `RETENTION_ARCHIVE_DAYS` (14) |

Config lives in the Pulumi stack under the `backup:` namespace (see ADR 007).

## Verify backups are healthy

On the VM / with the docker socket:

```bash
docker exec postgres-container pgbackrest --stanza=planner info
```

Healthy output lists `status: ok`, the wal archive range, and one or more
`full backup:` entries with today's timestamp. To confirm the objects on the
OCI side:

```bash
NAMESPACE=$(oci os ns get --query 'data' --raw-output)   # tenancy namespace
BUCKET=$(pulumi config get backup:BUCKET_NAME --stack production)
oci os object list -bn "$BUCKET" --prefix planner/backup/ --query 'data[0:5].name'
oci os object list -bn "$BUCKET" --prefix planner/archive/ --query 'data[0:5].name'
```

WAL flowing continuously shows as new `.gz` objects under
`<repoPath>/archive/<stanza>/…` (segment files land within `archive_timeout`
of being produced; name pattern `…<logseq>/<segment>-<sha>.gz`).

Troubleshooting signals:

- `WARN: archive command failed … will try again later` at startup is normal
  *only* until the bootstrap's `stanza-create` completes (a few seconds).
  The bootstrap then runs `pgbackrest check` and fails loudly if repo creds,
  endpoint, bucket, or `archive_command` are wrong — check the container logs
  (`docker logs postgres-container`).
- `ERROR: unable to find a valid repository … ArchiveMismatchError` means the
  bucket holds a repo created by a *different* cluster (different system-id).
  This is expected if you point a fresh cluster at an existing bucket/path;
  restore the intended data instead of starting over (below).
- Missing objects on the OCI side → check the Customer Secret Key was created
  for a user with Object Storage permissions and the bucket name matches
  `backup:BUCKET_NAME`.

## Restore (point-in-time)

1. **Identify the target.** `pgbackrest info` shows the available bases and
   wal archive range. You can restore the latest state (`--type=standby`, or
   promote with `--type=preserve`), or to a time:
   `--type=time --target='2026-08-30 14:30:00+00'`.

2. **Bring up a throwaway restore container** against the same bucket
   (mirrors the backup image):

   ```bash
   BUCKET=$(pulumi config get backup:BUCKET_NAME --stack production)
   # 1. write /etc/pgbackrest/pgbackrest.conf mirroring entrypoint.sh (S3 repo
   #    + [planner] pg1-path=/var/lib/postgresql/restore, pg1-user=postgres)
   # 2. pgbackrest --stanza=planner restore --type=time --target='...' \
   #      --recovery-option='restore_command=pgbackrest --stanza=planner archive-get %f %p'
   # 3. start postgres on the restored dir and promote once recovery is complete:
   #      pg_ctl -D /var/lib/postgresql/restore -k /run/postgresql start
   #      pg_ctl -D /var/lib/postgresql/restore promote
   ```

3. **Validate** with a query (e.g., `TABLE signals;`) before cutting traffic
   over.

The restore must use the same Customer Secret Key/bucket/path — i.e., rotate
out of a maintenance window on the VPS or an identical throwaway image.

## Ad-hoc full backup / off-cycle run

```bash
docker exec postgres-container pgbackrest --stanza=planner --type=full backup --log-level-console=info
```

## Hardening toggles (config)

- `backup:CIPHER_PASS` — set to enable repo-level aes-256 encryption on top of
  OCI's default server-side encryption. **Restoring requires the same
  passphrase**, so store it in your secrets manager, not just Pulumi state.
- `backup:ENDPOINT` — override the S3-compat endpoint (e.g. an OCI
  object-storage private endpoint or a different region).
- Prefer a dedicated IAM user (scoped to the bucket) for non-personal
  tenancies instead of the provisioning user's Customer Secret Key.