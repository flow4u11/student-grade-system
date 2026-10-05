-- Only an authorized teacher in this student's selected term/class may set a PIN.
-- Public student access continues to require the explicit application feature flag.
create function public.reset_student_pin(learner uuid,term uuid,pin text) returns void
language plpgsql security definer set search_path='' as $$
declare classroom uuid; number text;
begin
 perform private.require_staff();
 select e.class_id,s.student_number into classroom,number
 from public.students s join public.enrollments e on e.student_id=s.id
 where s.id=learner and e.term_id=term and s.active for update of s,e;
 if classroom is null or not public.can_access_class(term,classroom) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if number !~ '^[0-9]{5}$' or pin !~ '^[0-9]{6,12}$' or pin is null then
  raise exception 'Invalid student ID or PIN';
 end if;
 insert into private.student_credentials(student_id,pin_hash)
 values(learner,extensions.crypt(pin,extensions.gen_salt('bf',12)))
 on conflict(student_id) do update set pin_hash=excluded.pin_hash,updated_at=now();
 delete from private.student_sessions where student_id=learner;
 insert into public.audit_logs(actor,action,entity,entity_id,after_data)
 values(auth.uid(),'PIN_RESET','students',learner,jsonb_build_object('term_id',term));
end $$;
revoke all on function public.reset_student_pin(uuid,uuid,text) from public,anon;
grant execute on function public.reset_student_pin(uuid,uuid,text) to authenticated;
