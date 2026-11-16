-- Remember where the reader stopped in each resource.
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching frontend.
-- Existing resources start at page 1. The existing "Users own their resources"
-- policy already covers updating this column.

alter table resources add column last_page integer not null default 1 check (last_page >= 1);
