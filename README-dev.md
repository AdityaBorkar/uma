# README for developers

## TODO

- Env injection in ./Dockerfile and app.ts
  - `run-command.ts` must properly namespace exports
- GitHub Actions, Preview Deployments, Instant Rollbacks.
- Pulumi using S3 Provider along with GitHub Actions

- `backup:CIPHER_PASS` is documented but never plumbed
- Backup failures are silent
- Everything pgBackRest-related runs backgrounded from `entrypoint.sh` (`… &`), so a boot failure (`stanza-create` / `check` / cron) never stops the container — the app keeps serving while backups are broken. `pgbackrest-boot.sh` also does `stanza-create … || true`, swallowing real repo errors.
- Send a heartbeat/alert after each cron run (healthchecks.io / UptimeKuma ping), or run an in-container watchdog that fails when the repo WAL min age exceeds `archive_timeout * 2`.
- Only `|| true` on the *already-exists* case, not all errors.
- **Restore tooling:** `BACKUPS.md` describes a manual restore with a hand-written pgBackRest conf. A checked-in restore container/image or script (mirroring `infra/docker/backup/`) would cut RTO from hours to minutes and make the documented `backup:CIPHER_PASS` path testable. A periodic restore drill is the single highest-value ops improvement.

- DO NOT USE SEAWEEDFS FOR S3. USE OUTSOURCED PROVIDER ONLY with `protect: true` / `retainOnDelete`
