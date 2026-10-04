-- New application objects must receive deliberate grants in their migration.
-- Global revocations are necessary because schema defaults can only add grants.
-- Existing table policies and explicit application RPC grants are unchanged.
alter default privileges for role postgres revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres revoke all on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;

alter default privileges for role postgres in schema private revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke all on functions from public, anon, authenticated;
