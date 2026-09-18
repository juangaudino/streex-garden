ALTER TABLE machine_personal_state ADD COLUMN current_garden_since text;
ALTER TABLE machine_personal_state ADD COLUMN garden_history_json text NOT NULL DEFAULT '[]';
ALTER TABLE machine_personal_state ADD COLUMN maintenance_events_json text NOT NULL DEFAULT '[]';
