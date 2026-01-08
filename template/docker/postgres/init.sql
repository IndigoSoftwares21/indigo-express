-- docker/postgres/init.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'user') THEN
    CREATE ROLE "user" WITH LOGIN PASSWORD 'password';
    ALTER ROLE "user" CREATEDB;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'indigo_db') THEN
    CREATE DATABASE indigo_db
      WITH OWNER = "user"
      ENCODING = 'UTF8'
      LC_COLLATE = 'C'
      LC_CTYPE = 'C'
      TEMPLATE = template0;
  END IF;
END;
$$;

GRANT ALL PRIVILEGES ON DATABASE indigo_db TO "user";