-- Reset only grades in one selected term. Students, enrollments, courses, users
-- and all audit history survive. A short-lived proof follows password reauthentication.
create table private.grade_reset_proofs (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), actor uuid not null references public.profiles(id),
 term_id uuid not null references public.academic_terms(id),snapshot text not null,expires_at timestamptz not null default now()+interval '5 minutes'
);
create function private.grade_reset_snapshot(term uuid) returns text language sql stable set search_path='' as $$
 select coalesce(string_agg(g.id::text||':'||g.version::text,',' order by g.id),'') from public.student_grades g join public.subject_offerings o on o.id=g.offering_id where o.term_id=term
$$;
create function public.authorize_grade_reset(actor uuid,term uuid,proof_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare total integer; published integer; term_name text;
begin
 if not exists(select 1 from public.profiles where id=actor and active and role in ('ADMIN','DEVELOPER')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select academic_year::text||' · '||name into strict term_name from public.academic_terms where id=term;
 delete from private.grade_reset_proofs where expires_at<now() or grade_reset_proofs.actor=authorize_grade_reset.actor;
 insert into private.grade_reset_proofs(token_hash,actor,term_id,snapshot) values(proof_hash,actor,term,private.grade_reset_snapshot(term));
 select count(*),count(*) filter(where g.state='PUBLISHED') into total,published from public.student_grades g join public.subject_offerings o on o.id=g.offering_id where o.term_id=term;
 return jsonb_build_object('count',total,'published',published,'term',term_name);
end $$;
grant execute on function public.authorize_grade_reset(uuid,uuid,text) to service_role;
create function public.reset_term_grades(term uuid,proof_hash text,phrase text) returns integer language plpgsql security definer set search_path='' as $$
declare proof private.grade_reset_proofs; n integer; offering_ids uuid[];
begin
 perform private.require_admin();
 if phrase is distinct from 'RESET GRADES' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into proof from private.grade_reset_proofs where token_hash=proof_hash and actor=auth.uid() and term_id=term and expires_at>now() for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 -- Same lock order as per-student batch grading. New unseen offerings are never deleted.
 select array_agg(id) into offering_ids from (select id from public.subject_offerings where term_id=term order by id for update) locked;
 if private.grade_reset_snapshot(term) is distinct from proof.snapshot then raise exception 'CONFLICT: Preview changed; reauthenticate again' using errcode='40001'; end if;
 delete from public.student_grades where offering_id=any(offering_ids);
 get diagnostics n=row_count;
 delete from private.grade_reset_proofs where token_hash=proof_hash;
 insert into public.audit_logs(actor,action,entity,entity_id,after_data) values(auth.uid(),'HARD_RESET_GRADES','academic_terms',term,jsonb_build_object('deleted_grades',n));
 return n;
end $$;
grant execute on function public.reset_term_grades(uuid,text,text) to authenticated;
