-- Explicit administrator assignment controls homeroom access.
create table public.homeroom_assignments (
 teacher_id uuid not null references public.profiles(id) on delete cascade,
 term_id uuid not null references public.academic_terms(id) on delete cascade,
 class_id uuid not null references public.classes(id) on delete cascade,
 primary key(teacher_id,term_id,class_id)
);
alter table public.homeroom_assignments enable row level security;
grant select on public.homeroom_assignments to authenticated;
grant all on public.homeroom_assignments to service_role;
create policy homeroom_read on public.homeroom_assignments for select to authenticated using(public.is_staff() and (teacher_id=auth.uid() or public.is_admin()));
create function public.is_homeroom(term uuid,classroom uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_staff() and exists(select 1 from public.homeroom_assignments h where h.teacher_id=auth.uid() and h.term_id=term and h.class_id=classroom)
$$;
create or replace function public.can_access_offering(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (public.is_staff() and (exists(select 1 from public.teacher_assignments where teacher_id=auth.uid() and offering_id=target) or exists(select 1 from public.subject_offerings o where o.id=target and public.is_homeroom(o.term_id,o.class_id))))
$$;
create or replace function public.can_access_class(term uuid,classroom uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or public.is_homeroom(term,classroom) or (public.is_staff() and exists(select 1 from public.teacher_assignments a join public.subject_offerings o on o.id=a.offering_id where a.teacher_id=auth.uid() and o.term_id=term and o.class_id=classroom))
$$;
create or replace function public.can_access_student(learner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (public.is_staff() and exists(select 1 from public.enrollments e where e.student_id=learner and public.can_access_class(e.term_id,e.class_id)))
$$;
drop policy scoped_read on public.academic_terms;
create policy scoped_read on public.academic_terms for select to authenticated using(public.is_admin() or exists(select 1 from public.homeroom_assignments h where h.teacher_id=auth.uid() and h.term_id=academic_terms.id) or exists(select 1 from public.subject_offerings o where o.term_id=academic_terms.id));
drop policy scoped_read on public.classes;
create policy scoped_read on public.classes for select to authenticated using(public.is_admin() or exists(select 1 from public.homeroom_assignments h where h.teacher_id=auth.uid() and h.class_id=classes.id) or exists(select 1 from public.subject_offerings o where o.class_id=classes.id));
create function public.assign_homeroom(teacher uuid,term uuid,classroom uuid,assigned boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if not exists(select 1 from public.profiles where id=teacher and active and role='TEACHER') then raise exception 'Invalid teacher'; end if;
 if assigned then insert into public.homeroom_assignments values(teacher,term,classroom) on conflict do nothing;
 else delete from public.homeroom_assignments h where h.teacher_id=teacher and h.term_id=term and h.class_id=classroom; end if;
 insert into public.audit_logs(actor,action,entity,entity_id,after_data) values(auth.uid(),case when assigned then 'ASSIGN' else 'UNASSIGN' end,'homeroom_assignments',teacher,jsonb_build_object('term',term,'class',classroom));
end $$;

-- Teachers may update an existing visible student, within an authorized term/class.
create function public.update_assigned_student(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
   if not public.is_admin() and not public.is_homeroom(tid,old_class) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   delete from public.student_grades g using public.subject_offerings o where g.offering_id=o.id and g.student_id=sid and o.term_id=tid;
  end if;
 end if;
 -- The legacy helper still performs validation and PIN/session revocation.
 perform public.manage_record_v1('students',payload);
 if payload ? 'roll_number' then update public.enrollments set roll_number=nullif(payload->>'roll_number','')::integer where student_id=sid and term_id=tid; end if;
 return sid;
end $$;
create or replace function public.manage_record(kind text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; credits numeric; begin
 if kind='students' and nullif(payload->>'id','') is not null then return public.update_assigned_student(payload); end if;
 perform private.require_admin();
 if kind='subjects' and payload ? 'default_credits' then
  credits:=nullif(payload->>'default_credits','')::numeric;
  if credits<0 or credits>100 or credits<>round(credits,2) then raise exception 'Invalid credits'; end if;
 end if;
 rid:=public.manage_record_v2(kind,payload);
 if kind='subjects' and payload ? 'default_credits' then update public.subjects set default_credits=credits where id=rid; end if;
 return rid;
end $$;

-- Archive and permanent removal are separate commands. No automatic fallback.
create function public.archive_record(kind text,record_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 case kind
 when 'students' then update public.students set active=false where id=record_id;delete from private.student_sessions where student_id=record_id;
 when 'subjects' then update public.subjects set archived=true,active=false where id=record_id;
 when 'classes' then update public.classes set archived=true,active=false where id=record_id;
 when 'terms' then update public.academic_terms set archived=true,active=false where id=record_id;
 when 'offerings' then update public.subject_offerings set archived=true where id=record_id;
 when 'schemes' then update public.grade_schemes set archived=true where id=record_id;
 else raise exception 'Invalid kind'; end case;
end $$;
create function public.purge_record(kind text,record_id uuid,confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare offering_ids uuid[];
begin
 perform private.require_admin();
 if confirmation is distinct from 'DELETE' then raise exception 'Invalid confirmation'; end if;
 if kind not in ('students','subjects','classes','terms','offerings','schemes') then raise exception 'Invalid kind'; end if;
 -- Serialize grade writers before deleting any academic dependencies.
 select array_agg(o.id order by o.id) into offering_ids from public.subject_offerings o where
 (kind='offerings' and o.id=record_id) or (kind='subjects' and o.subject_id=record_id) or (kind='classes' and o.class_id=record_id) or (kind='terms' and o.term_id=record_id) or (kind='schemes' and o.scheme_id=record_id) or (kind='students' and exists(select 1 from public.student_grades g where g.offering_id=o.id and g.student_id=record_id));
 perform 1 from public.subject_offerings where id=any(offering_ids) order by id for update;
 if kind='students' then
  perform 1 from public.students where id=record_id for update;
  delete from public.student_grades where student_id=record_id;
  delete from public.enrollments where student_id=record_id;
  delete from public.students where id=record_id;
 else
  delete from public.student_grades where offering_id=any(offering_ids);
  delete from public.subject_offerings where id=any(offering_ids);
  case kind
  when 'subjects' then delete from public.subjects where id=record_id;
  when 'classes' then delete from public.enrollments where class_id=record_id;delete from public.classes where id=record_id;
  when 'terms' then delete from public.enrollments where term_id=record_id;delete from public.academic_terms where id=record_id;
  when 'schemes' then update public.school_settings set default_scheme_id=null where default_scheme_id=record_id;delete from public.grade_scheme_rules where scheme_id=record_id;delete from public.grade_schemes where id=record_id;
  else null; end case;
 end if;
 insert into public.audit_logs(actor,action,entity,entity_id) values(auth.uid(),'PERMANENT_DELETE',kind,record_id);
end $$;
create function public.clear_course_grades(offering uuid,learner uuid default null,expected_version integer default null,confirmation text default '',expected_rows jsonb default null) returns integer language plpgsql security definer set search_path='' as $$
declare n integer; current_rows jsonb; begin
 perform private.require_staff();
 if not public.can_access_offering(offering) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if confirmation is distinct from 'RESET' then raise exception 'Invalid confirmation'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
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
create function public.student_neighbors(learner uuid,term uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with own as(select e.class_id from public.enrollments e where e.student_id=learner and e.term_id=term), ordered as(
 select s.id,s.first_name||' '||s.last_name as name,
 lag(s.id) over w as previous,lead(s.id) over w as next
 from public.enrollments e join public.students s on s.id=e.student_id join own on own.class_id=e.class_id
 where e.term_id=term and s.active window w as(order by e.roll_number nulls last,s.student_number,s.id))
 select coalesce((select jsonb_build_object('previous',previous,'next',next) from ordered where id=learner),'{}'::jsonb)
$$;
create function public.create_course(payload jsonb,class_ids uuid[],subject jsonb default null) returns integer language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 perform private.require_admin();
 if subject is not null then sid:=public.manage_record('subjects',subject);payload:=payload||jsonb_build_object('subject_id',sid);end if;
 return public.create_offerings(payload,class_ids);
end $$;

-- Real photos are private Storage objects; server signs authorized reads.
alter table public.profiles add column avatar_path text check(avatar_path is null or avatar_path=id::text||'/avatar.jpg'),
 add column official_first_name_th text not null default '' check(length(official_first_name_th)<=120),
 add column official_last_name_th text not null default '' check(length(official_last_name_th)<=120);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('teacher-avatars','teacher-avatars',false,1048576,array['image/jpeg']) on conflict(id) do nothing;
create function public.set_teacher_photo(path text) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_staff();
 if path is not null and path<>auth.uid()::text||'/avatar.jpg' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update public.profiles set avatar_path=path where id=auth.uid();
end $$;
alter table private.teacher_registrations add column first_name_th text not null default '',add column last_name_th text not null default '';
alter function public.reserve_teacher_registration(text,text,text,text) rename to reserve_teacher_registration_v2;
revoke all on function public.reserve_teacher_registration_v2(text,text,text,text) from public,anon,authenticated,service_role;
create function public.reserve_teacher_registration(code_hash text,base_name text,first_name text,last_name text,first_name_th text default '',last_name_th text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation private.teacher_invites; domain text; candidate text; suffix integer:=1; reservation uuid;
begin
 if length(first_name_th)>120 or length(last_name_th)>120 then raise exception 'Invalid Thai name';end if;
 if base_name !~ '^[a-z]{1,48}\.[a-z]{1,4}$' then raise exception 'Invalid login name'; end if;
 perform pg_advisory_xact_lock(728302);
 -- Recover expired reservations so failed network requests cannot exhaust invitations.
 with expired as (delete from private.teacher_registrations where not completed and expires_at<now() returning invite_id), totals as (select invite_id,count(*) n from expired group by invite_id)
 update private.teacher_invites i set used=greatest(0,used-t.n) from totals t where i.id=t.invite_id;
 select * into invitation from private.teacher_invites i where i.code_hash=reserve_teacher_registration.code_hash and active and expires_at>now() and used<max_uses for update;
 if not found then raise exception 'REGISTRATION_DENIED'; end if;
 select login_domain into strict domain from public.school_settings where id;
 loop
  candidate:=base_name||case when suffix=1 then '' else '.'||suffix::text end||'@'||domain;
  exit when not exists(select 1 from auth.users where lower(email)=candidate) and not exists(select 1 from private.teacher_registrations where username=candidate) and not exists(select 1 from public.profiles where school_username=candidate);
  suffix:=suffix+1; if suffix>10000 then raise exception 'REGISTRATION_DENIED'; end if;
 end loop;
 insert into private.teacher_registrations(invite_id,username,first_name,last_name,first_name_th,last_name_th) values(invitation.id,candidate,trim(first_name),trim(last_name),trim(first_name_th),trim(last_name_th)) returning id into reservation;
 update private.teacher_invites set used=used+1 where id=invitation.id;
 return jsonb_build_object('id',reservation,'username',candidate);
end $$;
revoke all on function public.reserve_teacher_registration(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_teacher_registration(text,text,text,text,text,text) to service_role;
create or replace function private.provision_invited_teacher() returns trigger language plpgsql security definer set search_path='' as $$
declare r private.teacher_registrations;
begin
 if not coalesce(new.raw_app_meta_data ? 'school_registration',false) then return new;end if;
 if tg_op='UPDATE' and old.raw_app_meta_data->>'school_registration' is not distinct from new.raw_app_meta_data->>'school_registration' then return new;end if;
 select * into r from private.teacher_registrations where id=(new.raw_app_meta_data->>'school_registration')::uuid and not completed and expires_at>now() for update;
 if not found or lower(new.email) is distinct from r.username or not exists(select 1 from private.teacher_invites where id=r.invite_id and active and expires_at>now()) then raise exception 'REGISTRATION_DENIED';end if;
 insert into public.profiles(id,display_name,role,official_first_name,official_last_name,school_username,official_first_name_th,official_last_name_th) values(new.id,left(coalesce(nullif(r.first_name_th||' '||r.last_name_th,' '),r.first_name||' '||r.last_name),120),'TEACHER',r.first_name,r.last_name,r.username,r.first_name_th,r.last_name_th);
 update private.teacher_registrations set completed=true where id=r.id;return new;
end $$;

-- Delete a teacher Auth account and profile/dependencies, retaining student results.
alter table private.grade_reset_proofs drop constraint grade_reset_proofs_actor_fkey;
alter table private.grade_reset_proofs add constraint grade_reset_proofs_actor_fkey foreign key(actor) references public.profiles(id) on delete cascade;
alter table private.grade_reset_proofs drop constraint grade_reset_proofs_term_id_fkey;
alter table private.grade_reset_proofs add constraint grade_reset_proofs_term_id_fkey foreign key(term_id) references public.academic_terms(id) on delete cascade;
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key(id) references auth.users(id) on delete cascade;
alter table public.teacher_assignments drop constraint teacher_assignments_teacher_id_fkey;
alter table public.teacher_assignments add constraint teacher_assignments_teacher_id_fkey foreign key(teacher_id) references public.profiles(id) on delete cascade;
alter table public.feedback drop constraint feedback_author_fkey;
alter table public.feedback add constraint feedback_author_fkey foreign key(author) references public.profiles(id) on delete cascade;
alter table public.student_grades drop constraint student_grades_updated_by_fkey;
alter table public.student_grades add constraint student_grades_updated_by_fkey foreign key(updated_by) references public.profiles(id) on delete set null;
alter table public.audit_logs drop constraint audit_logs_actor_fkey;
alter table public.audit_logs add constraint audit_logs_actor_fkey foreign key(actor) references auth.users(id) on delete set null;
create function public.prepare_teacher_delete(teacher uuid,confirmation text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if teacher=auth.uid() or confirmation is distinct from 'DELETE' or not exists(select 1 from public.profiles where id=teacher and role='TEACHER') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update public.profiles set active=false where id=teacher;
 insert into public.audit_logs(actor,action,entity,entity_id) values(auth.uid(),'DELETE_TEACHER','profiles',teacher);
end $$;
-- Do not store a deleted teacher's photo/contact/profile as an audit copy.
create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor,action,entity,entity_id,before_data,after_data)
 values(auth.uid(),tg_op,tg_table_name,coalesce(new.id,old.id),case when tg_op<>'INSERT' then case when tg_table_name='profiles' and tg_op='DELETE' then jsonb_build_object('id',old.id) else to_jsonb(old) end end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
-- Explicit grants: these functions are not public RPCs for anonymous callers.
do $$ declare fn text;begin
 foreach fn in array array['is_homeroom(uuid,uuid)','assign_homeroom(uuid,uuid,uuid,boolean)','update_assigned_student(jsonb)','archive_record(text,uuid)','purge_record(text,uuid,text)','clear_course_grades(uuid,uuid,integer,text,jsonb)','student_neighbors(uuid,uuid)','create_course(jsonb,uuid[],jsonb)','set_teacher_photo(text)','prepare_teacher_delete(uuid,text)'] loop
 execute 'revoke all on function public.'||fn||' from public,anon';
 execute 'grant execute on function public.'||fn||' to authenticated';
 end loop;
end $$;
create function private.cleanup_deleted_teacher() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='TEACHER' then
  delete from private.teacher_registrations where username=old.school_username;
  update public.audit_logs set before_data=null,after_data=null where entity='profiles' and entity_id=old.id;
 end if;
 return old;
end $$;
create trigger cleanup_deleted_teacher before delete on public.profiles for each row execute function private.cleanup_deleted_teacher();
revoke all on function private.cleanup_deleted_teacher() from public,anon,authenticated;
