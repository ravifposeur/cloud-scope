CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('researcher', 'viewer');
CREATE TYPE audit_status AS ENUM ('success', 'failure');
CREATE TYPE pixel_type AS ENUM ('uint8', 'uint16', 'uint32', 'float32', 'float64', 'int8', 'int16', 'int32');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    affiliation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_users (
    project_id INTEGER REFERENCES projects(id),
    user_id INTEGER REFERENCES users(id),
    role user_role,
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    macro_text TEXT NOT NULL,
    imagej_version TEXT NOT NULL,
    bioformats_version TEXT NOT NULL,
    parameters TEXT NOT NULL,
    input_checksum TEXT NOT NULL,
    output_checksum TEXT NOT NULL,
    status audit_status NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    project_id INTEGER REFERENCES projects(id),
    user_id INTEGER REFERENCES users(id)
);

CREATE TABLE metadata (
    id SERIAL PRIMARY KEY,
    operator_name BYTEA NOT NULL,
    instrument_serial BYTEA NOT NULL,
    clinical_notes BYTEA,
    size_x INTEGER NOT NULL,
    size_y INTEGER NOT NULL,
    size_z INTEGER NOT NULL,
    size_c INTEGER NOT NULL,
    pixel_type pixel_type NOT NULL,
    dimension_order TEXT NOT NULL
);
