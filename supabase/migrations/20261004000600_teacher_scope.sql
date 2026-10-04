-- A teacher receives access only through explicit administrator assignments.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('ADMIN','DEVELOPER','TEACHER','VIEWER'));
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','DEVELOPER','TEACHER'))
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','DEVELOPER'))
$$;
create function private.require_admin() returns void language plpgsql set search_path='' as $$
begin if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if; end $$;

create table public.teacher_assignments (
 teacher_id uuid not null references public.profiles(id) on delete restrict,
 offering_id uuid not null references public.subject_offerings(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(teacher_id,offering_id)
);
create index assignments_offering on public.teacher_assignments(offering_id);
alter table public.teacher_assignments enable row level security;
grant select on public.teacher_assignments to authenticated;
grant all on public.teacher_assignments to service_role;
create policy assignment_read on public.teacher_assignments for select to authenticated using(public.is_staff() and (teacher_id=auth.uid() or public.is_admin()));

create function public.can_access_offering(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (public.is_staff() and exists(select 1 from public.teacher_assignments where teacher_id=auth.uid() and offering_id=target))
$$;
create function public.can_access_class(term uuid,classroom uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (public.is_staff() and exists(select 1 from public.teacher_assignments a join public.subject_offerings o on o.id=a.offering_id where a.teacher_id=auth.uid() and o.term_id=term and o.class_id=classroom))
$$;
create function public.can_access_student(learner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (public.is_staff() and exists(select 1 from public.enrollments e join public.subject_offerings o on o.class_id=e.class_id and o.term_id=e.term_id join public.teacher_assignments a on a.offering_id=o.id where a.teacher_id=auth.uid() and e.student_id=learner))
$$;
grant execute on function public.can_access_offering(uuid),public.can_access_class(uuid,uuid),public.can_access_student(uuid) to authenticated;

drop policy staff_read on public.students;
create policy scoped_read on public.students for select to authenticated using(public.can_access_student(id));
drop policy staff_read on public.enrollments;
create policy scoped_read on public.enrollments for select to authenticated using(public.can_access_class(term_id,class_id));
drop policy staff_read on public.subject_offerings;
create policy scoped_read on public.subject_offerings for select to authenticated using(public.can_access_offering(id));
drop policy staff_read on public.student_grades;
create policy scoped_read on public.student_grades for select to authenticated using(public.can_access_offering(offering_id));
drop policy staff_read on public.academic_terms;
create policy scoped_read on public.academic_terms for select to authenticated using(public.is_admin() or exists(select 1 from public.subject_offerings o where o.term_id=academic_terms.id));
drop policy staff_read on public.classes;
create policy scoped_read on public.classes for select to authenticated using(public.is_admin() or exists(select 1 from public.subject_offerings o where o.class_id=classes.id));
drop policy staff_read on public.subjects;
create policy scoped_read on public.subjects for select to authenticated using(public.is_admin() or exists(select 1 from public.subject_offerings o where o.subject_id=subjects.id));
drop policy staff_read on public.grade_schemes;
create policy scoped_read on public.grade_schemes for select to authenticated using(public.is_admin() or exists(select 1 from public.subject_offerings o where o.scheme_id=grade_schemes.id));
drop policy staff_read on public.grade_scheme_rules;
create policy scoped_read on public.grade_scheme_rules for select to authenticated using(public.is_admin() or exists(select 1 from public.grade_schemes s where s.id=grade_scheme_rules.scheme_id));

create function public.assign_teacher(teacher uuid,offering uuid,assigned boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 perform 1 from public.subject_offerings where id=offering for update;
 if not found then raise exception 'Invalid offering'; end if;
 if not exists(select 1 from public.profiles where id=teacher and role in ('ADMIN','DEVELOPER','TEACHER') and active) then raise exception 'Invalid teacher'; end if;
 if assigned then insert into public.teacher_assignments(teacher_id,offering_id) values(teacher,offering) on conflict do nothing;
 else delete from public.teacher_assignments where teacher_id=teacher and offering_id=offering; end if;
 insert into public.audit_logs(actor,action,entity,entity_id,after_data) values(auth.uid(),case when assigned then 'ASSIGN' else 'UNASSIGN' end,'teacher_assignments',teacher,jsonb_build_object('offering_id',offering));
end $$;
grant execute on function public.assign_teacher(uuid,uuid,boolean) to authenticated;

create or replace function public.manage_record(kind text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; begin
 perform private.require_admin();
 rid:=public.manage_record_v1(kind,payload);
 if kind='students' and payload ? 'roll_number' then
  update public.enrollments set roll_number=nullif(payload->>'roll_number','')::integer where student_id=rid and term_id=(payload->>'term_id')::uuid;
 end if;
 return rid;
end $$;

create or replace function public.delete_record(kind text, record_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 case kind
 when 'students' then
  perform 1 from public.students where id=record_id for update;
  if not found then raise exception 'Record not found'; end if;
  if exists(select 1 from public.student_grades where student_id=record_id) then
   raise exception 'DEPENDENCIES: Student has grades; deactivate to preserve history';
  end if;
  delete from public.enrollments where student_id=record_id;
  delete from public.students where id=record_id;
 when 'classes' then delete from public.classes where id=record_id;
 when 'terms' then delete from public.academic_terms where id=record_id;
 when 'subjects' then delete from public.subjects where id=record_id;
 when 'offerings' then delete from public.subject_offerings where id=record_id;
 when 'schemes' then
  perform 1 from public.grade_schemes where id=record_id for update;
  if not found then raise exception 'Record not found'; end if;
  if exists(select 1 from public.subject_offerings where scheme_id=record_id) then
   raise exception 'DEPENDENCIES: Scheme is in use';
  end if;
  delete from public.grade_scheme_rules where scheme_id=record_id;
  delete from public.grade_schemes where id=record_id;
 else raise exception 'Unsupported record type';
 end case;
exception when foreign_key_violation then
 raise exception 'DEPENDENCIES: Remove dependent records first or deactivate this record';
end $$;

create or replace function public.remove_record(kind text,record_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 begin
  perform public.delete_record(kind,record_id);
  return 'deleted';
 exception when raise_exception then
  if sqlerrm not like 'DEPENDENCIES:%' then raise; end if;
 end;
 case kind
 when 'students' then
  update public.students set active=false where id=record_id;
  delete from private.student_sessions where student_id=record_id;
 when 'classes' then update public.classes set active=false where id=record_id;
 when 'terms' then update public.academic_terms set active=false where id=record_id;
 when 'subjects' then update public.subjects set active=false where id=record_id;
 when 'offerings' then update public.subject_offerings set archived=true where id=record_id;
 when 'schemes' then update public.grade_schemes set archived=true where id=record_id;
 else raise exception 'Unsupported removal';
 end case;
 return 'archived';
end $$;

create or replace function public.restore_record(kind text,record_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 case kind
 when 'offerings' then update public.subject_offerings set archived=false where id=record_id;
 when 'schemes' then update public.grade_schemes set archived=false where id=record_id;
 else raise exception 'Unsupported restoration';
 end case;
end $$;

create or replace function public.create_offerings(payload jsonb, class_ids uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
declare cid uuid; n integer:=0;
begin
 perform private.require_admin();
 if coalesce(array_length(class_ids,1),0) not between 1 and 1000 or payload ? 'id'
 or cardinality(class_ids)<>(select count(distinct c) from unnest(class_ids) c)
 then raise exception 'Invalid classroom selection'; end if;
 for cid in select c from unnest(class_ids) c order by c loop
  if not exists(select 1 from public.classes where id=cid and active) then raise exception 'Class is inactive'; end if;
  perform public.manage_record('offerings',payload || jsonb_build_object('class_id',cid));
  n:=n+1;
 end loop;
 return n;
end $$;

create or replace function public.import_students(rows jsonb, term uuid) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; class_ref uuid; n integer:=0; begin
 perform private.require_admin();
 if jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Import must contain 1 to 1000 students'; end if;
 for r in select * from jsonb_array_elements(rows) loop
  select id into class_ref from public.classes where name=trim(r->>'class_name') and active;
  if class_ref is null then raise exception 'Class not found'; end if;
  perform public.manage_record('students',jsonb_build_object('student_number',r->>'student_number','first_name',r->>'first_name','last_name',r->>'last_name','class_id',class_ref,'term_id',term,'roll_number',r->'roll_number'));
  n:=n+1;
 end loop;
 insert into public.audit_logs(actor,action,entity,after_data) values(auth.uid(),'IMPORT','students',jsonb_build_object('count',n,'term_id',term));
 return n;
end $$;

create or replace function public.save_grades(offering uuid, rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
 if not public.can_access_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
 if exists(select 1 from public.student_grades g where g.offering_id=offering and g.state='PUBLISHED' and g.student_id in(select (v->>'student_id')::uuid from jsonb_array_elements(rows) v)) then raise exception 'PUBLISHED_LOCKED'; end if;
 if exists(select 1 from public.subject_offerings where id=offering and archived) then raise exception 'Archived offering'; end if;
 return public.save_grades_v1(offering,rows);
end $$;

create or replace function public.publish_grades(offering uuid, rows jsonb, publish boolean) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; n integer:=0; begin
 perform private.require_staff();
 if not public.can_access_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
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

create or replace function public.write_student_grades(learner uuid, term uuid, rows jsonb, publish boolean default null) returns integer
language plpgsql security definer set search_path='' as $$
declare r jsonb; oid uuid; n integer:=0;
begin
 perform private.require_staff();
 if rows is null or jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Invalid grade rows'; end if;
 if jsonb_array_length(rows)<>(select count(distinct v->>'offering_id') from jsonb_array_elements(rows) v) then raise exception 'Duplicate offering'; end if;
 for r in select v from jsonb_array_elements(rows) v order by v->>'offering_id' loop
  oid:=(r->>'offering_id')::uuid;
  if not public.can_access_offering(oid) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.subject_offerings o join public.enrollments e on e.term_id=o.term_id and e.class_id=o.class_id
   where o.id=oid and o.term_id=term and e.student_id=learner for update of o;
  if not found then raise exception 'Offering does not match student enrollment and term'; end if;
  if publish is null then
   perform public.save_grades(oid,jsonb_build_array((r-'offering_id') || jsonb_build_object('student_id',learner)));
  else
   perform public.publish_grades(oid,jsonb_build_array(jsonb_build_object('student_id',learner,'version',r->'version')),publish);
  end if;
  n:=n+1;
 end loop;
 return n;
end $$;

create or replace function public.list_students(filters jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; chosen_term uuid; term_filter uuid; class_filter uuid;
 sort_by text:=coalesce(filters->>'sort','class'); descending boolean:=filters->>'direction'='desc';
 amount integer:=greatest(1,least(1000,coalesce((filters->>'take')::integer,50)));
 skip integer:=greatest(0,least(500000,coalesce((filters->>'skip')::integer,0)));
begin
 if not public.is_staff() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 term_filter:=nullif(filters->>'term','')::uuid;
 class_filter:=nullif(filters->>'class','')::uuid;
 chosen_term:=coalesce(term_filter,nullif(filters->>'group_term','')::uuid,(select id from public.academic_terms order by active desc,academic_year desc,name desc limit 1));
 with filtered as (
  select s.*, e.roll_number, c.name as class_name,
   (select array_agg((m[1])::numeric) from regexp_matches(c.name,'[0-9]+','g') m) as class_numbers,
   coalesce((select jsonb_agg(jsonb_build_object('class_id',a.class_id,'term_id',a.term_id)) from public.enrollments a where a.student_id=s.id),'[]'::jsonb) as enrollments
  from public.students s
  left join public.enrollments e on e.student_id=s.id and e.term_id=chosen_term
  left join public.classes c on c.id=e.class_id
  where (term_filter is null or e.id is not null) and (class_filter is null or e.class_id=class_filter)
   and (coalesce(filters->>'status','') not in ('active','inactive') or s.active=((filters->>'status')='active'))
   and (coalesce(filters->>'search','')='' or position(lower(left(filters->>'search',100)) in lower(s.student_number||' '||s.first_name||' '||s.last_name))>0)
 ), ordered as (
  select * from filtered order by
   case when sort_by='class' then class_name is null end asc,
   case when sort_by='class' and not coalesce(descending,false) then class_numbers end asc nulls last,
   case when sort_by='class' and descending then class_numbers end desc nulls last,
   case when sort_by='class' and not coalesce(descending,false) then class_name end asc nulls last,
   case when sort_by='class' and descending then class_name end desc nulls last,
   case when sort_by in ('class','roll') and not coalesce(descending,false) then roll_number end asc nulls last,
   case when sort_by in ('class','roll') and descending then roll_number end desc nulls last,
   case when sort_by='name' and not coalesce(descending,false) then first_name end asc,
   case when sort_by='name' and descending then first_name end desc,
   case when not coalesce(descending,false) then student_number end asc,
   case when descending then student_number end desc,id
  limit amount offset skip
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(o)-'class_numbers') from ordered o),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
 return result;
end $$;

-- Legacy helpers remain inaccessible even if called directly through PostgREST.
revoke all on function public.manage_record_v1(text,jsonb),public.save_grades_v1(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.require_admin() from public,anon,authenticated;
