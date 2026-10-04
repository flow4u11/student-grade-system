-- Reject excess precision before numeric(9,2) storage can round it.
create or replace function public.save_grades(offering uuid, rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; current_grade public.student_grades; sid uuid; n integer:=0; begin
 perform private.require_staff();
 if rows is null or jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Save must contain 1 to 1000 rows'; end if;
 perform 1 from public.subject_offerings where id=offering for update;
 if not found then raise exception 'Offering not found'; end if;
 for r in select * from jsonb_array_elements(rows) loop
  sid:=(r->>'student_id')::uuid;
  if r->>'score' is not null and (r->>'score') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Invalid score precision'; end if;
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
-- Academic year/term identity cannot move after grades exist.
create function private.term_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.academic_year,new.name) is distinct from (old.academic_year,old.name) and exists(
 select 1 from public.subject_offerings o join public.student_grades g on g.offering_id=o.id where o.term_id=old.id)
 then raise exception 'Term has grades and its identity cannot be changed'; end if;
 return new;
end $$;
create trigger term_guard before update on public.academic_terms for each row execute function private.term_guard();
revoke all on function private.term_guard() from public,anon,authenticated;
