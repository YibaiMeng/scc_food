CREATE TABLE IF NOT EXISTS business (
    business_id  TEXT PRIMARY KEY,
    name         TEXT,
    address      TEXT,
    city         TEXT,
    state        TEXT,
    postal_code  TEXT,
    latitude     REAL,
    longitude    REAL,
    phone_number TEXT,
    first_seen   TEXT NOT NULL,
    last_updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection (
    inspection_id      TEXT PRIMARY KEY,
    business_id        TEXT NOT NULL,
    date               TEXT NOT NULL,
    score              INTEGER,
    result             TEXT,
    type               TEXT,
    inspection_comment TEXT,
    first_seen         TEXT NOT NULL,
    last_updated       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS violation (
    inspection_id     TEXT NOT NULL,
    code              TEXT NOT NULL,
    description       TEXT,
    critical          INTEGER DEFAULT 0,
    violation_comment TEXT,
    first_seen        TEXT NOT NULL,
    last_updated      TEXT NOT NULL,
    PRIMARY KEY (inspection_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inspection_business_date ON inspection (business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_business_id ON inspection (business_id);
CREATE INDEX IF NOT EXISTS idx_violation_inspection_id ON violation (inspection_id);
