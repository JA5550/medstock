-- MedStock: Hospital Stock Management PostgreSQL Schema
-- Two Core Areas: CONSUMABLES (Surgical / Non-Surgical) & EQUIPMENTS
-- 3-Tier RBAC: SUPER_ADMIN, STOREKEEPER (scoped), VIEWER (read-only, can_edit = FALSE)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE departments (
  dept_id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  emp_id VARCHAR(32) UNIQUE NOT NULL,
  full_name VARCHAR(120),
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'STOREKEEPER', 'VIEWER')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Super Admin assigns Storekeepers to specific department & area (no duplicates per dept)
CREATE TABLE storekeeper_assignments (
  assign_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('CONSUMABLES_ONLY', 'EQUIPMENT_ONLY', 'BOTH')),
  assigned_by INT REFERENCES users(user_id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dept_id)
);

-- Storekeepers assign Viewers strictly without editing policy (can_edit = FALSE)
CREATE TABLE viewer_dept_access (
  access_id SERIAL PRIMARY KEY,
  viewer_user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  assigned_by INT NOT NULL REFERENCES users(user_id),
  can_edit BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_edit = FALSE),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viewer_user_id, dept_id)
);

CREATE TABLE items_master (
  item_id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  area VARCHAR(20) NOT NULL CHECK (area IN ('CONSUMABLES', 'EQUIPMENTS')),
  sub_category VARCHAR(20) CHECK (
    (area = 'CONSUMABLES' AND sub_category IN ('SURGICAL', 'NON_SURGICAL')) OR
    (area = 'EQUIPMENTS' AND sub_category IS NULL)
  ),
  min_threshold INT NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consumable_batches (
  batch_id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES items_master(item_id) ON DELETE CASCADE,
  dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  batch_no VARCHAR(80) NOT NULL,
  expiry_date DATE NOT NULL,
  qty INT NOT NULL CHECK (qty >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE equipment_assets (
  asset_id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES items_master(item_id) ON DELETE CASCADE,
  dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  serial_no VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UNDER_REPAIR', 'CONDEMNED')),
  service_due DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tender_intakes (
  intake_id SERIAL PRIMARY KEY,
  tender_no VARCHAR(80) NOT NULL,
  dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES items_master(item_id) ON DELETE CASCADE,
  qty INT NOT NULL CHECK (qty > 0),
  entered_by INT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE indents (
  indent_id SERIAL PRIMARY KEY,
  requesting_unit VARCHAR(120) NOT NULL,
  store_dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES items_master(item_id) ON DELETE CASCADE,
  req_qty INT NOT NULL CHECK (req_qty > 0),
  issued_qty INT NOT NULL DEFAULT 0 CHECK (issued_qty >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ISSUED')),
  handled_by INT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inter_store_loans (
  loan_id SERIAL PRIMARY KEY,
  borrower_dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  lender_dept_name VARCHAR(120) NOT NULL,
  item_id INT NOT NULL REFERENCES items_master(item_id) ON DELETE CASCADE,
  qty INT NOT NULL CHECK (qty > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'BORROWED' CHECK (status IN ('BORROWED', 'RETURNED')),
  created_by INT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Departments (alphabetical)
INSERT INTO departments (name) VALUES
  ('Gastro'),
  ('General Ward'),
  ('ICU'),
  ('Operation Theatre');

-- Seed Demo Users (default password hash for '123456' generated at app bootstrap or via bcrypt)
-- Note: In production, run `node src/seed.js` or hash '123456' with bcrypt.
