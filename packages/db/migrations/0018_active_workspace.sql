-- Server-side pin for "which of my workspaces is active", so every client
-- (not just the browser that made the switch) agrees on it. Web previously
-- only kept this in localStorage — fine for switching on one browser, but
-- mobile has no such storage and needs to read the same choice to show a
-- correct read-only "Workspace" affiliation (see 0017_organizations.sql for
-- why a caller can now belong to more than one workspace).
--
-- Nullable: unset means "no pin yet", same as @rr/api's in-memory default,
-- which falls back to whichever membership sorts first.
alter table profiles add column active_workspace_id uuid references workspaces on delete set null;
