-- MacroEngine database schema
-- Run against Neon Postgres

-- Enable extensions for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- USDA Food Database (Foundation + SR Legacy + Branded)
CREATE TABLE IF NOT EXISTS usda_foods (
    fdc_id              INTEGER PRIMARY KEY,
    description         TEXT NOT NULL,
    brand_owner         TEXT,
    data_type           VARCHAR(20),
    calories            REAL,
    protein             REAL,
    carbs               REAL,
    fat                 REAL,
    fiber               REAL,
    sugar               REAL,
    sodium              REAL,
    serving_size_g      REAL,
    serving_description TEXT,
    search_vector       TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', description)
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_usda_search ON usda_foods USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_usda_trgm ON usda_foods USING GIN(description gin_trgm_ops);

-- User custom foods
CREATE TABLE IF NOT EXISTS user_foods (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    brand               TEXT,
    calories            REAL NOT NULL,
    protein             REAL NOT NULL,
    carbs               REAL NOT NULL,
    fat                 REAL NOT NULL,
    fiber               REAL DEFAULT 0,
    serving_size_g      REAL DEFAULT 100,
    serving_description TEXT,
    barcode             VARCHAR(20),
    source              VARCHAR(20) DEFAULT 'manual',
    source_id           VARCHAR(60),
    use_count           INTEGER DEFAULT 0,
    is_favorite         BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Platform credentials (for Garmin tokens, shared with soma format)
CREATE TABLE IF NOT EXISTS platform_credentials (
    platform        VARCHAR(30) PRIMARY KEY,
    auth_type       VARCHAR(30),
    credentials     JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(20) DEFAULT 'inactive',
    connected_at    TIMESTAMPTZ
);
