-- Initialize PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create application user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'xch_user') THEN
      CREATE ROLE xch_user LOGIN PASSWORD 'xch_password';
   END IF;
END
$do$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE xch_dev TO xch_user;

-- Set default search path to include PostGIS
ALTER DATABASE xch_dev SET search_path TO public, postgis;
