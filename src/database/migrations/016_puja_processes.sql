-- 016_puja_processes.sql
-- Reusable puja process templates with ordered steps.
-- Services may optionally link to one process via services.puja_process_id.

CREATE TABLE IF NOT EXISTS puja_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(170) NOT NULL UNIQUE,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_puja_processes_updated ON puja_processes;
CREATE TRIGGER trg_puja_processes_updated
  BEFORE UPDATE ON puja_processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS puja_process_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    puja_process_id UUID NOT NULL REFERENCES puja_processes(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_puja_process_steps_updated ON puja_process_steps;
CREATE TRIGGER trg_puja_process_steps_updated
  BEFORE UPDATE ON puja_process_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_puja_process_steps_process ON puja_process_steps(puja_process_id);
CREATE INDEX IF NOT EXISTS idx_puja_process_steps_order ON puja_process_steps(puja_process_id, display_order);

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS puja_process_id UUID REFERENCES puja_processes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_services_puja_process ON services(puja_process_id);
