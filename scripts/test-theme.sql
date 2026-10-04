-- Local-only fixtures. All changes, accounts and audit records roll back.
\set ON_ERROR_STOP on
begin;
create temporary table theme_ids(name text primary key, id uuid);
insert into theme_ids values ('admin',gen_random_uuid()),('teacher',gen_random_uuid());
grant select on theme_ids to authenticated;
insert into auth.users(id,email) select id,'theme-'||id||'@local.test' from theme_ids;
insert into public.profiles(id,display_name,role) select id,'Theme test',case name when 'admin' then 'ADMIN' else 'TEACHER' end from theme_ids;
create temporary table theme_original as select (to_jsonb(s)-'id')||jsonb_build_object('default_scheme_id',coalesce(s.default_scheme_id::text,'')) as payload from public.school_settings s;
grant select on theme_original to authenticated;
create function pg_temp.theme_check(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL %',label; end if; raise notice 'PASS %',label; end $$;
create function pg_temp.theme_reject(statement text,code text) returns void language plpgsql as $$ begin execute statement; raise exception 'Expected rejection'; exception when others then if sqlstate<>code then raise; end if; end $$;
grant execute on function pg_temp.theme_check(boolean,text),pg_temp.theme_reject(text,text) to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from theme_ids where name='teacher'),true) is not null;
select pg_temp.theme_reject('select public.update_school_settings((select payload from theme_original))','42501');
select pg_temp.theme_check(true,'Teacher cannot change school backgrounds');
select set_config('request.jwt.claim.sub',(select id::text from theme_ids where name='admin'),true) is not null;
select public.update_school_settings((select payload from theme_original)||'{"background_color":"#abc123","background_color_dark":"#123abc"}');
select pg_temp.theme_check((select background_color='#abc123' and background_color_dark='#123abc' from public.school_settings),'Admin saves both backgrounds');
select public.update_school_settings((select payload from theme_original)-'background_color'-'background_color_dark');
select pg_temp.theme_check((select background_color='#abc123' and background_color_dark='#123abc' from public.school_settings),'Legacy clients preserve existing backgrounds');
select pg_temp.theme_reject('select public.update_school_settings((select payload from theme_original)||''{"background_color":"red"}'')','23514');
select pg_temp.theme_check((select background_color='#abc123' and background_color_dark='#123abc' from public.school_settings),'Malformed background rejected atomically');
select pg_temp.theme_check(not has_function_privilege('anon','public.update_school_settings(jsonb)','execute'),'Anonymous theme mutation denied');
reset role;
set local role anon;
select public.school_branding()->>'background_color' as public_background \gset
reset role;
select pg_temp.theme_check(:'public_background'='#abc123','Public branding includes saved background');
rollback;
