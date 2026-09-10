# syntax=docker/dockerfile:1

# Postgres 18 (server binary unchanged from postgres:18-alpine) + pgBackRest
# for scheduled S3 (OCI Object Storage) backups.
#
# pgBackRest ships as a distribution tarball that builds with meson+ninja
# (required libs: libpq, OpenSSL, libxml2, lz4, bz2, zlib; zstd optional).
# libpq.pc on Alpine pulls libcurl, hence curl-dev. The toolchain is removed
# after install; the runtime libxml2/lz4/bz2/zlib/openssl stay.
#
# No extra postgres packages are added, so the server itself behaves exactly
# like stock postgres:18-alpine; only the pgbackrest binary and a thin
# cron/bootstrap layer are added on top. The entrypoint renders
# /etc/pgbackrest/pgbackrest.conf and the cron schedule from env vars
# (entrypoint.sh) only when BACKUP_S3_* is present — dev stacks leave
# those unset and get the stock behavior back.
FROM postgres:18-alpine

ARG PGBACKREST_VERSION=2.59.1

RUN set -eux; \
    apk add --no-cache \
      ca-certificates \
      curl \
      meson \
      ninja \
      gcc \
      musl-dev \
      pkgconfig \
      curl-dev \
      postgresql-dev \
      openssl-dev \
      libxml2-dev \
      lz4-dev \
      bzip2-dev \
      zlib-dev \
      zstd-dev; \
    curl -fsSL -o /tmp/pgbackrest.tar.gz \
      "https://github.com/pgbackrest/pgbackrest/releases/download/release/${PGBACKREST_VERSION}/pgbackrest-${PGBACKREST_VERSION}.tar.gz"; \
    tar -xzf /tmp/pgbackrest.tar.gz -C /tmp; \
    cd "/tmp/pgbackrest-${PGBACKREST_VERSION}"; \
    meson setup build .; \
    ninja -C build; \
    meson install -C build; \
    pgbackrest version; \
    cd /; \
    rm -rf /tmp/pgbackrest-* /tmp/pgbackrest.tar.gz; \
    apk del \
      curl meson ninja gcc musl-dev pkgconfig curl-dev postgresql-dev \
      openssl-dev libxml2-dev lz4-dev bzip2-dev zlib-dev zstd-dev; \
    # pgBackRest links dynamically against the compression/XML/SSL libs;
    # apk del above orphans them if they were only pulled in by the -dev
    # packages, so pin them explicitly for runtime. NB: Alpine ships the
    # bzip2 shared library in a separate `libbz2` package (the `bzip2`
    # package only has the CLI tools).
    apk add --no-cache \
      libbz2 lz4 zstd zlib libxml2 openssl

# Backup orchestration: entrypoint wrapper (renders config), first-run
# bootstrap (stanza-create/check/first full + crond), the cron job itself,
# and the initdb SQL that guarantees a `postgres` superuser role for
# pgBackRest's local-socket (peer-auth) connection.
COPY entrypoint.sh pgbackrest-boot.sh planner-backup-full.sh /usr/local/bin/
COPY init-role-postgres.sql /docker-entrypoint-initdb.d/
RUN chmod 755 \
      /usr/local/bin/entrypoint.sh \
      /usr/local/bin/pgbackrest-boot.sh \
      /usr/local/bin/planner-backup-full.sh

# The stock docker-entrypoint.sh is still invoked by our wrapper after setup.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]