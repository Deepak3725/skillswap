-- Migration 001: allow one-way swap requests
--
-- A one-way request asks to learn a skill without offering one in return,
-- so swap_requests.offered_skill_id may be NULL.
--
-- STATUS: already applied to the development database (Nov 2026).
-- Do not run it again there. Run it once on any database that was created
-- from an older copy of database/schema.sql.
--
-- Safe and non-destructive: existing rows keep their offered skill.
-- The foreign key to skills(skill_id) still applies when a value is present.

ALTER TABLE swap_requests
ALTER COLUMN offered_skill_id DROP NOT NULL;
