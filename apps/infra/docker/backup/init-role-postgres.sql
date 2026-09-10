-- Run by docker-entrypoint.sh during first init (docker-entrypoint-initdb.d).
-- pgBackRest connects over the local unix socket as the OS user `postgres`,
-- and socket peer authentication maps that OS user to a database role of the
-- same name. pgBackRest also needs a superuser to run its backup functions,
-- so ensure a `postgres` role exists regardless of POSTGRES_USER. Idempotent
-- so a re-initialized cluster (new volume) is always covered.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres LOGIN SUPERUSER;
        COMMENT ON ROLE postgres IS
            'pgBackRest local-socket superuser (peer auth via OS user postgres)';
    END IF;
END
$$;