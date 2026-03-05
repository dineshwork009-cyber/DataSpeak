-- =============================================================
-- DataSpeak SaaS – PostgreSQL Schema  (schema: endeavour_test_area)
-- Version: 1.1.0  – uses built-in gen_random_uuid() (pg13+)
-- Run once:  psql … -f schema.sql
-- =============================================================

-- Isolate all DataSpeak tables in their own schema
-- Schema endeavour_test_area already exists and is owned by this user
SET search_path = endeavour_test_area;

-- Clean up partial objects from any previous failed run
DROP TABLE IF EXISTS endeavour_test_area.audit_logs          CASCADE;
DROP TABLE IF EXISTS endeavour_test_area.query_usage         CASCADE;
DROP TABLE IF EXISTS endeavour_test_area.query_history       CASCADE;
DROP TABLE IF EXISTS endeavour_test_area.database_connections CASCADE;
DROP TABLE IF EXISTS endeavour_test_area.user_tenant_roles   CASCADE;
DROP TABLE IF EXISTS endeavour_test_area.users               CASCADE;
DROP TABLE IF EXISTS endeavour_test_area.tenants             CASCADE;

-- =============================================================
-- TENANTS
-- =============================================================
CREATE TABLE endeavour_test_area.tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    slug                VARCHAR(100) NOT NULL,
    logo_url            TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    plan                VARCHAR(50) NOT NULL DEFAULT 'starter',
    max_users           INT NOT NULL DEFAULT 5,
    max_connections     INT NOT NULL DEFAULT 3,
    monthly_query_limit INT NOT NULL DEFAULT 1000,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_tenants_slug UNIQUE (slug)
);
CREATE INDEX idx_tenants_slug ON endeavour_test_area.tenants (slug) WHERE is_deleted = FALSE;

-- =============================================================
-- USERS
-- =============================================================
CREATE TABLE endeavour_test_area.users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES endeavour_test_area.tenants(id) ON DELETE RESTRICT,
    email                 VARCHAR(256) NOT NULL,
    password_hash         TEXT NOT NULL,
    first_name            VARCHAR(50) NOT NULL,
    last_name             VARCHAR(50) NOT NULL,
    is_email_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    refresh_token         TEXT,
    refresh_token_expiry  TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at            TIMESTAMPTZ,
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant_id ON endeavour_test_area.users (tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_users_email     ON endeavour_test_area.users (email)     WHERE is_deleted = FALSE;

-- =============================================================
-- USER TENANT ROLES
-- =============================================================
CREATE TABLE endeavour_test_area.user_tenant_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES endeavour_test_area.users(id)   ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES endeavour_test_area.tenants(id) ON DELETE CASCADE,
    role        SMALLINT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMPTZ,
    CONSTRAINT uq_user_tenant_role UNIQUE (user_id, tenant_id)
);
CREATE INDEX idx_utr_tenant_id ON endeavour_test_area.user_tenant_roles (tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_utr_user_id   ON endeavour_test_area.user_tenant_roles (user_id)   WHERE is_deleted = FALSE;

-- =============================================================
-- DATABASE CONNECTIONS
-- =============================================================
CREATE TABLE endeavour_test_area.database_connections (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES endeavour_test_area.tenants(id) ON DELETE CASCADE,
    created_by_user_id          UUID NOT NULL REFERENCES endeavour_test_area.users(id)   ON DELETE RESTRICT,
    name                        VARCHAR(100) NOT NULL,
    description                 TEXT,
    provider                    SMALLINT NOT NULL,
    encrypted_connection_string TEXT NOT NULL,
    status                      SMALLINT NOT NULL DEFAULT 1,
    last_tested_at              TIMESTAMPTZ,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted                  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at                  TIMESTAMPTZ
);
CREATE INDEX idx_db_conn_tenant_id ON endeavour_test_area.database_connections (tenant_id) WHERE is_deleted = FALSE;

-- =============================================================
-- QUERY HISTORY
-- =============================================================
CREATE TABLE endeavour_test_area.query_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES endeavour_test_area.tenants(id)              ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES endeavour_test_area.users(id)                ON DELETE RESTRICT,
    connection_id           UUID NOT NULL REFERENCES endeavour_test_area.database_connections(id) ON DELETE RESTRICT,
    natural_language_query  TEXT NOT NULL,
    generated_sql           TEXT NOT NULL,
    status                  SMALLINT NOT NULL,
    error_message           TEXT,
    row_count               INT NOT NULL DEFAULT 0,
    execution_time_ms       BIGINT NOT NULL DEFAULT 0,
    tokens_used             INT NOT NULL DEFAULT 0,
    executed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMPTZ
);
CREATE INDEX idx_qh_tenant_id     ON endeavour_test_area.query_history (tenant_id)    WHERE is_deleted = FALSE;
CREATE INDEX idx_qh_user_id       ON endeavour_test_area.query_history (user_id)      WHERE is_deleted = FALSE;
CREATE INDEX idx_qh_connection_id ON endeavour_test_area.query_history (connection_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_qh_executed_at   ON endeavour_test_area.query_history (executed_at DESC);

-- =============================================================
-- QUERY USAGE (monthly rollup)
-- =============================================================
CREATE TABLE endeavour_test_area.query_usage (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES endeavour_test_area.tenants(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES endeavour_test_area.users(id)   ON DELETE CASCADE,
    month               SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                SMALLINT NOT NULL CHECK (year >= 2024),
    total_queries       INT NOT NULL DEFAULT 0,
    total_tokens_used   INT NOT NULL DEFAULT 0,
    successful_queries  INT NOT NULL DEFAULT 0,
    failed_queries      INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usage_tenant_user_period UNIQUE (tenant_id, user_id, month, year)
);
CREATE INDEX idx_qu_tenant_id ON endeavour_test_area.query_usage (tenant_id);
CREATE INDEX idx_qu_user_id   ON endeavour_test_area.query_usage (user_id);

-- =============================================================
-- AUDIT LOGS
-- =============================================================
CREATE TABLE endeavour_test_area.audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES endeavour_test_area.tenants(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES endeavour_test_area.users(id) ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(100) NOT NULL,
    entity_id    TEXT,
    old_values   JSONB,
    new_values   JSONB,
    ip_address   INET,
    user_agent   TEXT,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_al_tenant_id ON endeavour_test_area.audit_logs (tenant_id);
CREATE INDEX idx_al_user_id   ON endeavour_test_area.audit_logs (user_id);
CREATE INDEX idx_al_timestamp ON endeavour_test_area.audit_logs (timestamp DESC);
CREATE INDEX idx_al_entity    ON endeavour_test_area.audit_logs (entity_type, entity_id);

-- =============================================================
-- updated_at auto-update trigger
-- =============================================================
CREATE OR REPLACE FUNCTION endeavour_test_area.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['tenants','users','user_tenant_roles',
                              'database_connections','query_history',
                              'query_usage','audit_logs']
    LOOP
        EXECUTE format(
          'CREATE TRIGGER trg_%I_updated_at
           BEFORE UPDATE ON endeavour_test_area.%I
           FOR EACH ROW EXECUTE FUNCTION endeavour_test_area.update_updated_at_column()',
          t, t);
    END LOOP;
END $$;

-- Confirm
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'endeavour_test_area' ORDER BY tablename;
