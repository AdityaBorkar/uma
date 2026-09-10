# ADR 007 — Automated PostgreSQL Backups to OCI Object Storage

**Date:** 2026-08-31
**Status:** Accepted
**Implements:** `apps/infra/oci/object-storage.ts` + `apps/infra/docker/backup/` (pgBackRest-enabled postgres image), `apps/infra/docker/postgres.ts`
**Related:** [`docs/CONTEXT.md`](../CONTEXT.md) (control_plane database)

> ⚠️ **Wiring status (2026-08-31, still true 2026-09-10):** every component this ADR describes is in
> the tree, but the stack does **not** currently enable backups. `apps/infra/index.ts`
> has the `createBackupBackend()` call commented out and never passes `backends`
> to `postgresContainer()`, so as committed the postgres container runs the
> stock image with `archive_mode` off and no cron. The decision below stands;
> re-enable by wiring `vps ? createBackupBackend() : undefined` through to
> `postgresContainer({ backends })`.

## Context

Postgres (`control_plane`, Docker container on the OCI VPS) had no backups:
the previous weekly-cycle ADRs assumed a fixed period, and the only persistence
was a single Docker named volume on the same disk as the container. A lost VM,
disk, or accidental `TRUNCATE` was unrecoverable. The infra is Pulumi-driven
(`apps/infra/index.ts`) and OCI-native (`@pulumi/oci`), so the natural recovery
target is **OCI Object Storage**, which the stack already provisions against
(`oci:*` provider config, `vps:compartmentId`).

Requirements settled with the owner:

- Full base backups every **2 days**, plus **continuous WAL archiving**
  ("full every 2 days + WAL instantly") so the DB can be restored to any
  committed transaction.
- Backups land in **OCI Object Storage** with **lifecycle rules** bounding
  storage (base backups 60 days, WAL archives 14 days — both configurable).
- Driven by cron, managed as infrastructure (Pulumi) like everything else.

## Decision

Back up Postgres with **pgBackRest** (physical backups + WAL archive-push)
writing to an OCI Object Storage bucket over its **S3-compatible API**, with
the bucket's lifecycle policy as the retention enforcement layer.

- **Tooling: pgBackRest 2.59.x**, not hand-rolled `pg_dump` + `cp`. pgBackRest
  is purpose-built for exactly this shape: `archive_command` pushes every WAL
  segment to the repo *instantly* (idempotent, retried, checksummed), and a
  scheduled cron job takes the base backup. A logical `pg_dump` every 2 days
  cannot be WAL-replayed, so it would forfeit point-in-time recovery.
- **Where it runs:** inside the postgres container. The image
  (`apps/infra/docker/backup/Dockerfile`) is `postgres:18-alpine` + pgBackRest +
  busybox cron. `wal_level=replica` was already set; we add
  `archive_mode=on`, `archive_command=pgbackrest … archive-push %p`, and
  `archive_timeout=60` (idle clusters still ship WAL at least every minute).
  An entrypoint wrapper renders the pgBackRest config from `BACKUP_*`
  environment vars **only when a backend is configured**, so dev keeps the
  stock behavior. pgBackRest connects over the **local unix socket** as the
  OS `postgres` user → DB role `postgres` (created by an initdb script);
  no TCP/password exposure.
- **Object storage:** a private bucket + `ObjectLifecyclePolicy`
  (`apps/infra/oci/object-storage.ts`), credentials as an IAM **Customer Secret
  Key** (the S3-compatible Access Key = key `id`, Secret Key = `key`), and
  the path-style endpoint
  `https://<namespace>.compat.objectstorage.<region>.oci.customer-oci.com`.
- **Schedule:** cron `0 1 */2 * *` (default) runs a full backup at 01:00 UTC
  every 2 days; the entrypoint seeds an initial full backup on first boot so
  a restore is possible immediately, and `pgbackrest check` validates repo +
  archive end-to-end at bring-up.
- **Retention (configurable):** the lifecycle policy deletes
  `<repoPath>/backup/*` after 60 days and `<repoPath>/archive/*` after 14
  days. pgBackRest is told to *never prune WAL sooner* than the policy
  (`repo1-retention-archive=30`, `type=full`), so the cloud rule is the single
  source of truth; pgBackRest's own `expire` prunes superseded bases per
  `repo1-retention-full=60` (time).
- **Config namespace `backup:`** in the Pulumi stacks (`BUCKET_NAME`,
  `REPO_PATH`, `STANZA`, `SCHEDULE`, `RETENTION_FULL_DAYS`,
  `RETENTION_ARCHIVE_DAYS`, optional `ENDPOINT`/`CIPHER_PASS`). Backups only
  materialize on non-dev stacks (`getStack() !== "dev"`).

## Consequences

- Recovery to any committed transaction **within the WAL window** (default
  14 days), or to any kept base backup (60 days) — see the runbook
  `docs/do-not-touch-ai/BACKUPS.md` for the restore procedure.
- Storage cost bounded by the lifecycle rules; WAL is small (~write volume)
  and compresses (lz4/zstd).
- The S3-compat Customer Secret Key is created for the same IAM user that
  owns `oci:userOcid`; that user must have Object Storage permissions.
  Prefer a dedicated backup IAM user for non-personal tenancies.
- **PGDATA alignment:** the postgres 18 image's default data dir moved to
  `/var/lib/postgresql/18/docker`, which silently stopped the named
  `postgres-data` volume (mounted at `/var/lib/postgresql/18/data`) from
  persisting the cluster. `PGDATA` is set explicitly to
  `/var/lib/postgresql/18/data` so the volume is used again. No migration is
  needed — there is no pre-ADR deployment.
- pgBackRest env-var liability: any `PGBACKREST_*` env var is read as a config
  option, so our vars are namespaced `BACKUP_*` to avoid accidental option
  injection into archive_command.
- Dev stacks keep the stock image with archiving off (no OCI resources).

## Alternatives considered

- **`pg_dump -Fc` via cron every 2 days:** simplest, but no WAL replay → no
  PITR; up to 2 days of loss. Rejected in favor of the user's PITR decision.
- **pgBackRest as a sidecar container + shared WAL volume:** keeps postgres
  stock but forces asynchronous WAL shipping through a shared directory and a
  scanner process; rejected — the combined image gets synchronous, retried
  per-segment `archive-push` with no extra moving parts.
- **Instance principal / dedicated backup user:** more IAM plumbing
  (dynamic group + policies) for the same single-tenant box; the Customer
  Secret Key reuses existing stack credentials. Documented as an upgrade path
  (and repo cipher-pass `backup:CIPHER_PASS` is available for at-rest
  encryption above OCI's default SSE).

## Traceability

- `apps/infra/oci/object-storage.ts` — bucket, lifecycle policy, S3-compat key.
- `apps/infra/docker/backup/{Dockerfile,entrypoint.sh,pgbackrest-boot.sh,planner-backup-full.sh,init-role-postgres.sql}` — image + orchestration.
- `apps/infra/docker/postgres.ts` — image selection, `PGDATA`, archive settings, `BACKUP_*` envs, healthcheck fix.
- `docs/do-not-touch-ai/BACKUPS.md` — verification, restore, and troubleshooting runbook.