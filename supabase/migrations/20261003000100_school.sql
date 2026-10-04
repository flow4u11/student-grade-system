create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  role text not null check (role in ('ADMIN','TEACHER','VIEWER')),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.academic_terms (
  id uuid primary key default gen_random_uuid(), academic_year integer not null check(academic_year between 2000 and 3000),
  name text not null check(length(trim(name)) between 1 and 100), active boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(academic_year,name)
);
create unique index one_active_term on public.academic_terms(active) where active;
create table public.classes (
  id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name)) between 1 and 60),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.students (
  id uuid primary key default gen_random_uuid(), student_number text not null unique check(student_number = trim(student_number) and student_number ~ '^[A-Za-z0-9_-]{1,40}$'),
  first_name text not null check(length(trim(first_name)) between 1 and 120), last_name text not null check(length(trim(last_name)) between 1 and 120),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index students_name_idx on public.students(last_name,first_name);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students on delete restrict,
  term_id uuid not null references public.academic_terms on delete restrict, class_id uuid not null references public.classes on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(student_id,term_id)
);
create index enrollments_class_term on public.enrollments(class_id,term_id,student_id);
create table public.grade_schemes (
  id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Lower bounds partition [0,100]; each interval ends at the next lower bound.
create table public.grade_scheme_rules (
  id uuid primary key default gen_random_uuid(), scheme_id uuid not null references public.grade_schemes on delete restrict,
  minimum numeric(5,2) not null check(minimum between 0 and 100), points numeric(3,2) not null check(points between 0 and 4), unique(scheme_id,minimum)
);
create index rules_scheme on public.grade_scheme_rules(scheme_id,minimum desc);
create table public.subjects (
  id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code)) between 1 and 40),
  name_th text not null check(length(trim(name_th)) between 1 and 150), name_en text not null check(length(trim(name_en)) between 1 and 150),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subject_offerings (
  id uuid primary key default gen_random_uuid(), subject_id uuid not null references public.subjects on delete restrict,
  term_id uuid not null references public.academic_terms on delete restrict, class_id uuid not null references public.classes on delete restrict,
  grading_type text not null check(grading_type in ('NUMERIC_GRADE','PASS_FAIL')),
  max_score numeric(9,2) not null default 100 check(max_score > 0 and max_score <= 100000),
  credits numeric(5,2) not null default 1 check(credits between 0 and 100),
  scheme_id uuid references public.grade_schemes on delete restrict,
  include_in_gpa boolean not null default true,
  pass_mode text not null default 'AUTOMATIC' check(pass_mode in ('AUTOMATIC','MANUAL')),
  pass_threshold numeric(5,2) not null default 60 check(pass_threshold between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(subject_id,term_id,class_id),
  check((grading_type='NUMERIC_GRADE' and scheme_id is not null) or (grading_type='PASS_FAIL' and not include_in_gpa))
);
create index offerings_term_class on public.subject_offerings(term_id,class_id);
create table public.student_grades (
  id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.subject_offerings on delete restrict,
  student_id uuid not null references public.students on delete restrict, score numeric(9,2), grade_points numeric(3,2),
  result text check(result in ('PASS','FAIL')), state text not null default 'DRAFT' check(state in ('DRAFT','PUBLISHED')),
  version integer not null default 1 check(version>0), updated_by uuid references public.profiles on delete restrict,
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(offering_id,student_id), check(score is null or score>=0), check(grade_points is null or grade_points between 0 and 4),
  check((state='PUBLISHED')=(published_at is not null))
);
create index grades_student_state on public.student_grades(student_id,state);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor uuid references auth.users on delete restrict,
  action text not null, entity text not null, entity_id uuid, before_data jsonb, after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_created on public.audit_logs(created_at desc);
create table private.student_credentials (
  student_id uuid primary key references public.students on delete cascade,
  pin_hash text not null, updated_at timestamptz not null default now()
);
create table private.student_sessions (
  token_hash text primary key, student_id uuid not null references public.students on delete cascade,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index student_sessions_expiry on private.student_sessions(expires_at);
create index student_sessions_student on private.student_sessions(student_id);
create table private.rate_limits (
  bucket text primary key, attempts integer not null, window_start timestamptz not null
);

create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','TEACHER'))
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role='ADMIN')
$$;
create function private.require_staff() returns void language plpgsql set search_path='' as $$
begin if not public.is_staff() then raise exception 'Staff authorization required' using errcode='42501'; end if; end $$;

do $$ declare t text; begin
 foreach t in array array['profiles','academic_terms','classes','students','enrollments','grade_schemes','grade_scheme_rules','subjects','subject_offerings','student_grades','audit_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t='audit_logs' then
   execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);
  elsif t='profiles' then
   execute format('create policy profile_read on public.%I for select to authenticated using (id=auth.uid() or public.is_admin())',t);
  else
   execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())',t);
  end if;
 end loop;
end $$;

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor,action,entity,entity_id,before_data,after_data)
 values(auth.uid(),tg_op,tg_table_name,coalesce(new.id,old.id),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create function private.touch_updated() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','academic_terms','classes','students','enrollments','grade_schemes','subjects','subject_offerings','student_grades'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch_updated()',t);
 end loop;
end $$;

create function private.grade_guard() returns trigger language plpgsql set search_path='' as $$
declare o public.subject_offerings; begin
 select * into strict o from public.subject_offerings where id=new.offering_id;
 if not exists(select 1 from public.enrollments where student_id=new.student_id and term_id=o.term_id and class_id=o.class_id) then raise exception 'Student is not enrolled in offering class'; end if;
 if new.score is not null and (new.score<0 or new.score>o.max_score) then raise exception 'Score outside allowed range'; end if;
 new.grade_points=null;
 if o.grading_type='NUMERIC_GRADE' then
  if new.score is null then raise exception 'Score is required'; end if;
  select points into new.grade_points from public.grade_scheme_rules where scheme_id=o.scheme_id and minimum<=new.score*100/o.max_score order by minimum desc limit 1;
  if new.grade_points is null then raise exception 'Invalid grade scheme'; end if;
  new.result=null;
 elsif o.pass_mode='AUTOMATIC' then
  if new.score is null then raise exception 'Score is required'; end if;
  new.result=case when new.score*100>=o.pass_threshold*o.max_score then 'PASS' else 'FAIL' end;
 else
  new.score=null;
  if new.result is null or new.result not in ('PASS','FAIL') then raise exception 'Pass or fail is required'; end if;
 end if;
 return new;
end $$;
create trigger grade_guard before insert or update on public.student_grades for each row execute function private.grade_guard();

create function private.offering_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.student_grades where offering_id=old.id) and
 (new.subject_id,new.term_id,new.class_id,new.grading_type,new.max_score,new.credits,new.scheme_id,new.include_in_gpa,new.pass_mode,new.pass_threshold)
 is distinct from (old.subject_id,old.term_id,old.class_id,old.grading_type,old.max_score,old.credits,old.scheme_id,old.include_in_gpa,old.pass_mode,old.pass_threshold)
 then raise exception 'Offering has grades; create a new offering to preserve history'; end if;
 return new;
end $$;
create trigger offering_guard before update on public.subject_offerings for each row execute function private.offering_guard();
create function private.enrollment_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.student_id,new.term_id,new.class_id) is distinct from (old.student_id,old.term_id,old.class_id) and exists(
 select 1 from public.student_grades g join public.subject_offerings o on o.id=g.offering_id where g.student_id=old.student_id and o.term_id=old.term_id)
 then raise exception 'Enrollment has grades and cannot be reassigned in this term'; end if;
 return new;
end $$;
create trigger enrollment_guard before update on public.enrollments for each row execute function private.enrollment_guard();

create function public.manage_record(kind text, payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); rule jsonb; begin
 perform private.require_staff();
 case kind
 when 'terms' then
  perform pg_advisory_xact_lock(728301);
  if coalesce((payload->>'active')::boolean,false) then update public.academic_terms set active=false where active and id<>rid; end if;
  insert into public.academic_terms(id,academic_year,name,active) values(rid,(payload->>'academic_year')::integer,trim(payload->>'name'),coalesce((payload->>'active')::boolean,false))
  on conflict(id) do update set academic_year=excluded.academic_year,name=excluded.name,active=excluded.active;
 when 'classes' then
  insert into public.classes(id,name,active) values(rid,trim(payload->>'name'),coalesce((payload->>'active')::boolean,true))
  on conflict(id) do update set name=excluded.name,active=excluded.active;
 when 'students' then
  insert into public.students(id,student_number,first_name,last_name,active) values(rid,trim(payload->>'student_number'),trim(payload->>'first_name'),trim(payload->>'last_name'),coalesce((payload->>'active')::boolean,true))
  on conflict(id) do update set student_number=excluded.student_number,first_name=excluded.first_name,last_name=excluded.last_name,active=excluded.active;
  if nullif(payload->>'class_id','') is not null then
   insert into public.enrollments(student_id,term_id,class_id) values(rid,(payload->>'term_id')::uuid,(payload->>'class_id')::uuid)
   on conflict(student_id,term_id) do update set class_id=excluded.class_id;
  end if;
  if nullif(payload->>'pin','') is not null then
   if (payload->>'pin') !~ '^[0-9]{6,12}$' then raise exception 'PIN must have 6 to 12 digits'; end if;
   insert into private.student_credentials(student_id,pin_hash) values(rid,extensions.crypt(payload->>'pin',extensions.gen_salt('bf',12)))
   on conflict(student_id) do update set pin_hash=excluded.pin_hash,updated_at=now();
   delete from private.student_sessions where student_id=rid;
   insert into public.audit_logs(actor,action,entity,entity_id) values(auth.uid(),'PIN_RESET','students',rid);
  end if;
  if not (select active from public.students where id=rid) then delete from private.student_sessions where student_id=rid; end if;
 when 'subjects' then
  insert into public.subjects(id,code,name_th,name_en,active) values(rid,trim(payload->>'code'),trim(payload->>'name_th'),trim(payload->>'name_en'),coalesce((payload->>'active')::boolean,true))
  on conflict(id) do update set code=excluded.code,name_th=excluded.name_th,name_en=excluded.name_en,active=excluded.active;
 when 'offerings' then
  insert into public.subject_offerings(id,subject_id,term_id,class_id,grading_type,max_score,credits,scheme_id,include_in_gpa,pass_mode,pass_threshold)
  values(rid,(payload->>'subject_id')::uuid,(payload->>'term_id')::uuid,(payload->>'class_id')::uuid,payload->>'grading_type',(payload->>'max_score')::numeric,(payload->>'credits')::numeric,nullif(payload->>'scheme_id','')::uuid,(payload->>'include_in_gpa')::boolean,payload->>'pass_mode',(payload->>'pass_threshold')::numeric)
  on conflict(id) do update set subject_id=excluded.subject_id,term_id=excluded.term_id,class_id=excluded.class_id,grading_type=excluded.grading_type,max_score=excluded.max_score,credits=excluded.credits,scheme_id=excluded.scheme_id,include_in_gpa=excluded.include_in_gpa,pass_mode=excluded.pass_mode,pass_threshold=excluded.pass_threshold;
 when 'schemes' then
  if jsonb_array_length(payload->'rules') not between 2 and 30 or not exists(select 1 from jsonb_array_elements(payload->'rules') r where (r->>'minimum')::numeric=0) then raise exception 'Scheme must partition 0 to 100 with unique lower bounds starting at 0'; end if;
  if exists(select 1 from public.subject_offerings where scheme_id=rid) then raise exception 'Used schemes are immutable; save a new version'; end if;
  insert into public.grade_schemes(id,name) values(rid,trim(payload->>'name')) on conflict(id) do update set name=excluded.name;
  delete from public.grade_scheme_rules where scheme_id=rid;
  for rule in select * from jsonb_array_elements(payload->'rules') loop
   insert into public.grade_scheme_rules(scheme_id,minimum,points) values(rid,(rule->>'minimum')::numeric,(rule->>'points')::numeric);
  end loop;
 else raise exception 'Unsupported record type';
 end case;
 return rid;
end $$;

create function public.import_students(rows jsonb, term uuid) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; class_ref uuid; n integer:=0; begin
 perform private.require_staff();
 if jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Import must contain 1 to 1000 students'; end if;
 for r in select * from jsonb_array_elements(rows) loop
  select id into class_ref from public.classes where name=trim(r->>'class_name') and active;
  if class_ref is null then raise exception 'Class not found'; end if;
  perform public.manage_record('students',jsonb_build_object('student_number',r->>'student_number','first_name',r->>'first_name','last_name',r->>'last_name','class_id',class_ref,'term_id',term));
  n:=n+1;
 end loop;
 insert into public.audit_logs(actor,action,entity,after_data) values(auth.uid(),'IMPORT','students',jsonb_build_object('count',n,'term_id',term));
 return n;
end $$;

create function public.save_grades(offering uuid, rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; current_grade public.student_grades; sid uuid; n integer:=0; begin
 perform private.require_staff();
 if jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Save must contain 1 to 1000 rows'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
 if not found then raise exception 'Offering not found'; end if;
 for r in select * from jsonb_array_elements(rows) loop
  sid:=(r->>'student_id')::uuid;
  if not exists(select 1 from public.students where id=sid and active) then raise exception 'Student is inactive'; end if;
  select * into current_grade from public.student_grades where offering_id=offering and student_id=sid for update;
  if coalesce(current_grade.version,0)<>coalesce((r->>'version')::integer,-1) then raise exception 'CONFLICT: Grades changed. Reload before saving.' using errcode='40001'; end if;
  insert into public.student_grades(offering_id,student_id,score,result,updated_by)
  values(offering,sid,nullif(r->>'score','')::numeric,nullif(r->>'result',''),auth.uid())
  on conflict(offering_id,student_id) do update set score=excluded.score,result=excluded.result,state='DRAFT',published_at=null,version=student_grades.version+1,updated_by=auth.uid();
  n:=n+1;
 end loop;
 return n;
end $$;
create function public.publish_grades(offering uuid, rows jsonb, publish boolean) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; n integer:=0; begin
 perform private.require_staff();
 if jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Select 1 to 1000 grades'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
 for r in select * from jsonb_array_elements(rows) loop
  update public.student_grades set state=case when publish then 'PUBLISHED' else 'DRAFT' end,published_at=case when publish then now() end,version=version+1,updated_by=auth.uid()
  where offering_id=offering and student_id=(r->>'student_id')::uuid and version=(r->>'version')::integer;
  if not found then raise exception 'CONFLICT: Grades changed. Reload before publishing.' using errcode='40001'; end if;
  n:=n+1;
 end loop;
 return n;
end $$;

create function public.consume_limit(bucket_key text, max_attempts integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; begin
 -- Server-only callers supply keyed hashes; no raw IDs/IP addresses are retained.
 insert into private.rate_limits(bucket,attempts,window_start) values(bucket_key,1,now()) on conflict(bucket) do update
 set attempts=case when rate_limits.window_start<now()-interval '15 minutes' then 1 else rate_limits.attempts+1 end,
 window_start=case when rate_limits.window_start<now()-interval '15 minutes' then now() else rate_limits.window_start end returning attempts into n;
 delete from private.rate_limits where window_start<now()-interval '1 day';
 return n<=max_attempts;
end $$;
create function public.student_login(number text, pin text, token_hash text, account_bucket text, ip_bucket text) returns boolean language plpgsql security definer set search_path='' as $$
declare sid uuid; stored_hash text; account_ok boolean; ip_ok boolean; begin
 account_ok:=public.consume_limit(account_bucket,10); ip_ok:=public.consume_limit(ip_bucket,30);
 if not account_ok or not ip_ok then return false; end if;
 select s.id,c.pin_hash into sid,stored_hash from public.students s join private.student_credentials c on c.student_id=s.id where s.student_number=number and s.active;
 if stored_hash is null then perform extensions.crypt(pin,extensions.gen_salt('bf',12)); return false; end if;
 if extensions.crypt(pin,stored_hash)<>stored_hash then return false; end if;
 delete from private.student_sessions where expires_at<now();
 insert into private.student_sessions(token_hash,student_id,expires_at) values(token_hash,sid,now()+interval '8 hours');
 return true;
end $$;
create function public.student_logout(session_hash text) returns void language sql security definer set search_path='' as $$
 delete from private.student_sessions where token_hash=session_hash
$$;
create function public.student_portal(session_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; result jsonb; begin
 select s.student_id into sid from private.student_sessions s join public.students st on st.id=s.student_id and st.active where s.token_hash=session_hash and s.expires_at>now();
 if sid is null then return null; end if;
 select jsonb_build_object('student',jsonb_build_object('student_number',s.student_number,'first_name',s.first_name,'last_name',s.last_name),
 'enrollments',coalesce((select jsonb_agg(jsonb_build_object('term_id',t.id,'academic_year',t.academic_year,'name',t.name,'active',t.active,'class_name',c.name) order by t.academic_year desc,t.name) from public.enrollments e join public.academic_terms t on t.id=e.term_id join public.classes c on c.id=e.class_id where e.student_id=sid),'[]'::jsonb),
 'grades',coalesce((select jsonb_agg(jsonb_build_object('term_id',o.term_id,'code',sub.code,'name_th',sub.name_th,'name_en',sub.name_en,'score',g.score,'max_score',o.max_score,'grade_points',g.grade_points,'result',g.result,'credits',o.credits,'include_in_gpa',o.include_in_gpa,'grading_type',o.grading_type,'state',g.state) order by sub.code)
 from public.student_grades g join public.subject_offerings o on o.id=g.offering_id join public.subjects sub on sub.id=o.subject_id where g.student_id=sid and g.state='PUBLISHED'),'[]'::jsonb)) into result from public.students s where s.id=sid;
 return result;
end $$;

-- Revoke default function EXECUTE before granting only the intended entry points.
revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function public.is_staff(),public.is_admin() to authenticated;
grant execute on function public.manage_record(text,jsonb),public.import_students(jsonb,uuid),public.save_grades(uuid,jsonb),public.publish_grades(uuid,jsonb,boolean) to authenticated;
grant execute on function public.consume_limit(text,integer),public.student_login(text,text,text,text,text),public.student_logout(text),public.student_portal(text) to service_role;
-- Service role is used exclusively by trusted server auth and guarded provisioning scripts.
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

insert into public.grade_schemes(id,name) values('10000000-0000-4000-8000-000000000001','Standard 0–4');
insert into public.grade_scheme_rules(scheme_id,minimum,points) select '10000000-0000-4000-8000-000000000001', minimum, points from (values (0,0),(50,1),(55,1.5),(60,2),(65,2.5),(70,3),(75,3.5),(80,4)) as r(minimum,points);
