-- Homeroom access grants full class visibility, never implied grade-writing rights.
-- Keep can_access_offering unchanged because existing RLS uses it for reads.
create function public.can_edit_offering(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (public.is_staff() and exists(select 1 from public.teacher_assignments where teacher_id=auth.uid() and offering_id=target))
$$;
revoke all on function public.can_edit_offering(uuid) from public,anon;
grant execute on function public.can_edit_offering(uuid) to authenticated;


create or replace function public.save_grades(offering uuid, rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
 if not public.can_edit_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
 -- Assignment changes also lock the offering; recheck after acquiring that lock.
 if not public.can_edit_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if exists(select 1 from public.student_grades g where g.offering_id=offering and g.state='PUBLISHED' and g.student_id in(select (v->>'student_id')::uuid from jsonb_array_elements(rows) v)) then raise exception 'PUBLISHED_LOCKED'; end if;
 if exists(select 1 from public.subject_offerings where id=offering and archived) then raise exception 'Archived offering'; end if;
 return public.save_grades_v1(offering,rows);
end $$;

create or replace function public.publish_grades(offering uuid, rows jsonb, publish boolean) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; n integer:=0; begin
 perform private.require_staff();
 if not public.can_edit_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Select 1 to 1000 grades'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
 -- Assignment changes also lock the offering; recheck after acquiring that lock.
 if not public.can_edit_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
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
  if not public.can_edit_offering(oid) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
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

create or replace function public.clear_course_grades(offering uuid,learner uuid default null,expected_version integer default null,confirmation text default '',expected_rows jsonb default null) returns integer language plpgsql security definer set search_path='' as $$
declare n integer; current_rows jsonb; begin
 perform private.require_staff();
 if not public.can_edit_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if confirmation is distinct from 'RESET' then raise exception 'Invalid confirmation'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
 -- Assignment changes also lock the offering; recheck after acquiring that lock.
 if not public.can_edit_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if learner is not null and not exists(select 1 from public.student_grades where offering_id=offering and student_id=learner and version=expected_version) then raise exception 'CONFLICT' using errcode='40001'; end if;
 if learner is null then
  select coalesce(jsonb_agg(jsonb_build_object('student_id',g.student_id,'version',g.version) order by g.student_id),'[]'::jsonb) into current_rows from public.student_grades g where g.offering_id=offering;
  if expected_rows is null or jsonb_typeof(expected_rows)<>'array' then raise exception 'CONFLICT' using errcode='40001';end if;
  select coalesce(jsonb_agg(jsonb_build_object('student_id',(r->>'student_id')::uuid,'version',(r->>'version')::integer) order by (r->>'student_id')::uuid),'[]'::jsonb) into expected_rows from jsonb_array_elements(expected_rows) r;
  if expected_rows is distinct from current_rows then raise exception 'CONFLICT' using errcode='40001';end if;
 end if;
 delete from public.student_grades where offering_id=offering and (learner is null or student_id=learner);
 get diagnostics n=row_count;
 insert into public.audit_logs(actor,action,entity,entity_id,after_data) values(auth.uid(),'RESET_COURSE_GRADES','subject_offerings',offering,jsonb_build_object('student',learner,'count',n));
 return n;
end $$;

create or replace function public.update_assigned_student(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=(payload->>'id')::uuid; tid uuid:=(payload->>'term_id')::uuid; cid uuid:=(payload->>'class_id')::uuid; old_class uuid;
begin
 perform private.require_staff();
 if payload ? 'pin' and not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.students where id=sid for update;
 if not found then raise exception 'Invalid student'; end if;
 select e.class_id into old_class from public.enrollments e where e.student_id=sid and e.term_id=tid for update;
 if not public.is_admin() and (old_class is null or not public.can_access_class(tid,old_class) or not public.can_access_class(tid,cid)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if old_class is distinct from cid and old_class is not null then
  perform 1 from public.subject_offerings o where o.term_id=tid and o.class_id=old_class order by o.id for update;
  if exists(select 1 from public.student_grades g join public.subject_offerings o on o.id=g.offering_id where g.student_id=sid and o.term_id=tid) then
   if not coalesce((payload->>'reset_on_move')::boolean,false) then raise exception 'Enrollment has grades; confirm reset before moving'; end if;
   -- Moving a student must not delete grades that this teacher may only read.
   if not public.is_admin() and exists(select 1 from public.student_grades g join public.subject_offerings o on o.id=g.offering_id where g.student_id=sid and o.term_id=tid and not public.can_edit_offering(o.id)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   delete from public.student_grades g using public.subject_offerings o where g.offering_id=o.id and g.student_id=sid and o.term_id=tid;
  end if;
 end if;
 -- The legacy helper still performs validation and PIN/session revocation.
 perform public.manage_record_v1('students',payload);
 if payload ? 'roll_number' then update public.enrollments set roll_number=nullif(payload->>'roll_number','')::integer where student_id=sid and term_id=tid; end if;
 return sid;
end $$;

-- Return names only, after class authorization; do not expose teacher contacts.
create function public.class_homeroom_teachers(term uuid,classroom uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_staff();
 if not public.can_access_class(term,classroom) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name) order by p.display_name,p.id)
  from public.homeroom_assignments h join public.profiles p on p.id=h.teacher_id
  where h.term_id=term and h.class_id=classroom and p.active),'[]'::jsonb);
end $$;
revoke all on function public.class_homeroom_teachers(uuid,uuid) from public,anon;
grant execute on function public.class_homeroom_teachers(uuid,uuid) to authenticated;

create or replace function public.teacher_work(term uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from (
 select o.*,public.can_edit_offering(o.id) as can_edit,count(e.student_id) filter(where s.active) as total,
 count(g.id) filter(where s.active) as recorded,
 count(g.id) filter(where s.active and g.state='PUBLISHED') as published
 from public.subject_offerings o
 left join public.enrollments e on e.class_id=o.class_id and e.term_id=o.term_id
 left join public.students s on s.id=e.student_id
 left join public.student_grades g on g.offering_id=o.id and g.student_id=e.student_id
 where o.term_id=term and not o.archived group by o.id order by o.created_at
 ) w
$$;
