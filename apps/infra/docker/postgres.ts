import { resolve } from "node:path";

import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";
import { getProject, interpolate } from "@pulumi/pulumi";

import type { BackupBackend } from "../oci/object-storage.ts";
import { GROUP_LABELS } from "./utils.ts";

// The image's default PGDATA is `/var/lib/postgresql/18/docker`, but the data
// volume is mounted at `/var/lib/postgresql/18/data` — set PGDATA explicitly
// so the two agree and the named volume actually persists the cluster.
const PGDATA = "/var/lib/postgresql/18/data";

const BASE_ARGS: string[] = [
	"-c",
	"shared_buffers=256MB",
	"-c",
	"max_connections=200",
	"-c",
	"effective_cache_size=1GB",
	"-c",
	"work_mem=8MB",
	"-c",
	"maintenance_work_mem=64MB",
	"-c",
	"wal_level=replica",
	"-c",
	"max_wal_senders=10",
	"-c",
	"max_replication_slots=10",
	"-c",
	"synchronous_commit=on",
	"-c",
	"checkpoint_completion_target=0.9",
	"-c",
	"max_worker_processes=8",
	"-c",
	"max_parallel_workers_per_gather=4",
	"-c",
	"max_parallel_workers=8",
	"-c",
	"log_min_duration_statement=100",
	"-c",
	"log_statement=ddl",
	"-c",
	"log_checkpoints=on",
	"-c",
	"log_connections=on",
	"-c",
	"log_disconnections=on",
	"-c",
	"row_security=off",
];

export function postgresContainer({
	network,
	provider,
	backends,
}: {
	network: docker.Network;
	provider: docker.Provider;
	/** pgBackRest repo config; when set, archiving + scheduled backups are on. */
	backends?: BackupBackend;
}) {
	const config = new pulumi.Config("postgres");
	const port = config.requireNumber("DB_PORT");
	const user = {
		name: config.requireSecret("DB_USER"),
		password: config.requireSecret("DB_PASSWORD"),
	};

	// With backups the postgres image is built from infra/docker/backup
	// (postgres:18-alpine + pgBackRest + cron); without, stock postgres. The
	// RemoteImage is only instantiated on the dev path, so production never
	// pulls an unused tag. Timings are wall-clock on the machine running
	// `pulumi up` (for remote daemons, including context streaming over SSH).
	const imageBuildStartedAt = Date.now();
	const builtImage = backends
		? new docker.Image(
				"postgres-image",
				{
					build: {
						context: resolve(import.meta.dir, "backup"),
						dockerfile: "Dockerfile",
						platform: "linux/arm64",
					},
					imageName: interpolate`${getProject()}-postgres:latest`,
					skipPush: true,
				},
				{ provider },
			)
		: undefined;

	// repoDigest is the local image ID and changes on every rebuild, so the
	// container is recreated whenever the image changes (same pattern as the
	// app image). Fall back to the tag if the provider returns no digest.
	const image: pulumi.Output<string> =
		backends && builtImage
			? pulumi
					.all([builtImage.repoDigest, builtImage.imageName])
					.apply(([digest, name]) => digest || name)
			: new docker.RemoteImage(
					"postgres-image",
					{ name: "postgres:18-alpine" },
					{ provider },
				).name;

	const command = [
		"postgres",
		...BASE_ARGS,
		...(backends
			? [
					// Continuous WAL archiving: every completed segment is pushed to
					// the OCI bucket by pgBackRest via archive_command ("instant" WAL),
					// plus archive_timeout so idle clusters still ship WAL promptly.
					"-c",
					"archive_mode=on",
					"-c",
					`archive_command=pgbackrest --stanza=${backends.stanza} archive-push %p`,
					"-c",
					"archive_timeout=60",
				]
			: []),
	];

	const volume = new docker.Volume(
		"postgres-data",
		{ labels: GROUP_LABELS },
		{ protect: true, provider, retainOnDelete: true },
	);

	const containerCreateStartedAt = Date.now();
	const container = new docker.Container(
		"postgres-container",
		{
			command,
			envs: [
				pulumi.interpolate`POSTGRES_USER=${user.name}`,
				pulumi.interpolate`POSTGRES_PASSWORD=${user.password}`,
				pulumi.interpolate`POSTGRES_DB=control_plane`,
				"POSTGRES_INITDB_ARGS=--data-checksums --encoding=UTF8",
				`PGDATA=${PGDATA}`,
				...(backends
					? [
							pulumi.interpolate`BACKUP_S3_BUCKET=${backends.s3.bucket}`,
							pulumi.interpolate`BACKUP_S3_ENDPOINT=${backends.s3.endpoint}`,
							pulumi.interpolate`BACKUP_S3_KEY=${backends.s3.accessKey}`,
							pulumi.interpolate`BACKUP_S3_SECRET=${backends.s3.secretKey}`,
							`BACKUP_S3_REGION=${backends.s3.region}`,
							`BACKUP_REPO_PATH=${backends.repoPath}`,
							`BACKUP_RETENTION_FULL_DAYS=${backends.retentionDays.full}`,
							`BACKUP_RETENTION_ARCHIVE_DAYS=${backends.retentionDays.archive}`,
							`BACKUP_SCHEDULE=${backends.schedule}`,
							`BACKUP_STANZA=${backends.stanza}`,
						]
					: []),
			],
			healthcheck: {
				interval: "10s",
				retries: 5,
				tests: ["CMD-SHELL", `pg_isready -U ${user.name} -d postgres`],
				timeout: "5s",
			},
			image,
			labels: GROUP_LABELS,
			networksAdvanced: [{ name: network.name }],
			ports: [{ external: port, internal: 5432 }],
			restart: "unless-stopped",
			volumes: [
				{
					containerPath: PGDATA,
					volumeName: volume.name,
				},
			],
		},
		{ provider },
	);

	const local_url = pulumi.interpolate`postgres://${user.name}:${user.password}@localhost:${port}`;
	const container_url = pulumi.interpolate`postgres://${user.name}:${user.password}@${container.name}:${port}`;

	return {
		container,
		// Consumed by index.ts and exported as stack outputs for the GitHub
		// Actions deploy summary. Deliberately secret-free — only names, ports
		// and durations. `imageBuildMs` is null when the stock image is used
		// (no backup backend); on `preview` the numbers are ~0.
		metrics: {
			containerCreateMs: Date.now() - containerCreateStartedAt,
			containerName: container.name,
			imageBuildMs: builtImage ? Date.now() - imageBuildStartedAt : null,
			port,
		},
		server: { container_url, local_url },
	};
}
