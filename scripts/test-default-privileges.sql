-- Run against local PostgreSQL as postgres. The probe objects always roll back.
\set ON_ERROR_STOP on
begin;
create table public.privilege_probe (id bigint generated always as identity);
create function public.privilege_probe_rpc() returns integer language sql as 'select 1';
create function private.privilege_probe_rpc() returns integer language sql as 'select 1';
do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon','authenticated'] loop
    if has_table_privilege(api_role,'public.privilege_probe','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') then
      raise exception 'Unexpected default table access for %', api_role;
    end if;
    if has_sequence_privilege(api_role,'public.privilege_probe_id_seq','USAGE,SELECT,UPDATE') then
      raise exception 'Unexpected default sequence access for %', api_role;
    end if;
    if has_function_privilege(api_role,'public.privilege_probe_rpc()','EXECUTE') or has_function_privilege(api_role,'private.privilege_probe_rpc()','EXECUTE') then
      raise exception 'Unexpected default RPC access for %', api_role;
    end if;
  end loop;
  if not has_function_privilege('authenticated','public.manage_record(text,jsonb)','EXECUTE') or not has_function_privilege('service_role','public.student_portal(text)','EXECUTE') then
    raise exception 'An existing application RPC grant was lost';
  end if;
end;
$$;
rollback;
\echo 'PASS new tables, sequences and RPCs deny implicit API access; existing RPC grants retained'
