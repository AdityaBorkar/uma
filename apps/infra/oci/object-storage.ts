import * as oci from "@pulumi/oci";
import * as pulumi from "@pulumi/pulumi";

import { displayName } from "./utils.ts";

/**
 * Backup backend for Postgres (pgBackRest repos).
 *
 * Provisions the OCI Object Storage bucket + lifecycle policy and the
 * S3-compatibility Customer Secret Key that pgBackRest authenticates with.
 * The resulting `BackupBackend` is consumed by `postgresContainer` (see
 * `infra/docker/postgres.ts`), which builds the pgBackRest-enabled image and
 * points `archive_command` + the every-N-days cron at this repo.
 *
 * Config (`backup:` namespace):
 * - `BUCKET_NAME`            bucket name (default `planner-backups`)
 * - `REPO_PATH`              pgBackRest repo path, also the lifecycle prefix
 *                            (default `/planner`)
 * - `STANZA`                 pgBackRest stanza / DB cluster id (default `planner`)
 * - `SCHEDULE`               cron expression for full base backups
 *                            (default: 01:00 UTC on every 2nd day)
 * - `RETENTION_FULL_DAYS`    lifecycle expiry for base backups (default 60)
 * - `RETENTION_ARCHIVE_DAYS` lifecycle expiry for WAL archives (default 14)
 * - `ENDPOINT`               optional override for the S3-compat endpoint
 *
 * Auth: the Customer Secret Key is created for the same IAM user that owns
 * the stack's `oci:userOcid` API key, so that user must have Object Storage
 * (read/write/list buckets + objects) permission. Only ever created on
 * non-dev stacks where the `oci:` provider config exists.
 */
export interface BackupBackend {
	bucketName: string;
	repoPath: string;
	retentionDays: { full: number; archive: number };
	s3: {
		accessKey: pulumi.Output<string>;
		secretKey: pulumi.Output<string>;
		bucket: pulumi.Output<string>;
		endpoint: pulumi.Input<string>;
		region: string;
	};
	schedule: string;
	stanza: string;
}

export function createBackupBackend(): BackupBackend {
	const config = new pulumi.Config("backup");
	const ociConfig = new pulumi.Config("oci");
	const vpsConfig = new pulumi.Config("vps");

	const compartmentId = vpsConfig.require("compartmentId");
	const region = ociConfig.require("region");
	const userId = ociConfig.requireSecret("userOcid");

	const bucketName = config.get("BUCKET_NAME") ?? "planner-backups";
	const repoPath = config.get("REPO_PATH") ?? "/planner";
	const stanza = config.get("STANZA") ?? "planner";
	const schedule = config.get("SCHEDULE") ?? "0 1 */2 * *";
	const fullDays = config.getNumber("RETENTION_FULL_DAYS") ?? 60;
	const archiveDays = config.getNumber("RETENTION_ARCHIVE_DAYS") ?? 14;

	const namespace = oci.objectstorage.getNamespaceOutput({
		compartmentId,
	}).namespace;

	const bucket = new oci.objectstorage.Bucket("pg-backup-bucket", {
		accessType: "NoPublicAccess",
		compartmentId,
		name: bucketName,
		namespace,
	});

	// S3-compatible credentials (Access Key = resource `id`, Secret Key = `key`)
	// used by pgBackRest's repo1-type=s3 repo.
	const secretKey = new oci.identity.CustomerSecretKey("pg-backup-s3-key", {
		displayName: displayName("pg-backup-s3-key-pgbackrest"),
		userId,
	});

	// Lifecycle policy = the retention enforcement layer. pgBackRest itself
	// never prunes WAL before the cloud rule (see entrypoint.sh in
	// infra/docker/backup), so what survives in the bucket is bounded here.
	new oci.objectstorage.ObjectLifecyclePolicy(
		"pg-backup-lifecycle",
		{
			bucket: bucket.name,
			namespace,
			rules: [
				{
					action: "DELETE",
					isEnabled: true,
					name: "base-backups",
					objectNameFilter: {
						inclusionPrefixes: [`${repoPath.replace(/^\/+/, "")}/backup/`],
					},
					target: "objects",
					timeAmount: String(fullDays),
					timeUnit: "DAYS",
				},
				{
					action: "DELETE",
					isEnabled: true,
					name: "wal-archive",
					objectNameFilter: {
						inclusionPrefixes: [`${repoPath.replace(/^\/+/, "")}/archive/`],
					},
					target: "objects",
					timeAmount: String(archiveDays),
					timeUnit: "DAYS",
				},
			],
		},
		{ dependsOn: [bucket] },
	);

	const endpoint =
		config.get("ENDPOINT") ??
		pulumi.interpolate`https://${namespace}.compat.objectstorage.${region}.oci.customer-oci.com`;

	return {
		bucketName,
		repoPath,
		retentionDays: { archive: archiveDays, full: fullDays },
		s3: {
			accessKey: secretKey.id,
			bucket: bucket.name,
			endpoint,
			region,
			secretKey: secretKey.key,
		},
		schedule,
		stanza,
	};
}
