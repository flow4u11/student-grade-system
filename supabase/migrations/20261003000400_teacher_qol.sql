-- Explicit, audited deletion of unused records; academic history is protected.
create function public.delete_record(kind text, record_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
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

-- A single transaction: conflicts cannot leave some classrooms unconfigured.
create function public.create_offerings(payload jsonb, class_ids uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
declare cid uuid; n integer:=0;
begin
 perform private.require_staff();
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

-- Reuse authoritative grade calculations and version checks for a student's subjects.
create function public.write_student_grades(learner uuid, term uuid, rows jsonb, publish boolean default null) returns integer
language plpgsql security definer set search_path='' as $$
declare r jsonb; oid uuid; n integer:=0;
begin
 perform private.require_staff();
 if rows is null or jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 1000 then raise exception 'Invalid grade rows'; end if;
 if jsonb_array_length(rows)<>(select count(distinct v->>'offering_id') from jsonb_array_elements(rows) v) then raise exception 'Duplicate offering'; end if;
 for r in select v from jsonb_array_elements(rows) v order by v->>'offering_id' loop
  oid:=(r->>'offering_id')::uuid;
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

-- Sort before pagination, including students without enrollment in the displayed term.
create function public.list_students(filters jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; chosen_term uuid; term_filter uuid; class_filter uuid;
 sort_by text:=coalesce(filters->>'sort','class'); descending boolean:=filters->>'direction'='desc';
 amount integer:=greatest(1,least(1000,coalesce((filters->>'take')::integer,50)));
 skip integer:=greatest(0,least(500000,coalesce((filters->>'skip')::integer,0)));
begin
 perform private.require_staff();
 term_filter:=nullif(filters->>'term','')::uuid;
 class_filter:=nullif(filters->>'class','')::uuid;
 chosen_term:=coalesce(term_filter,nullif(filters->>'group_term','')::uuid,(select id from public.academic_terms order by active desc,academic_year desc,name desc limit 1));
 with filtered as (
  select s.*, c.name as class_name,
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
   case when sort_by='name' and not coalesce(descending,false) then first_name end asc,
   case when sort_by='name' and descending then first_name end desc,
   case when not coalesce(descending,false) then student_number end asc,
   case when descending then student_number end desc,id
  limit amount offset skip
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(o)-'class_numbers') from ordered o),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
 return result;
end $$;

revoke all on function public.delete_record(text,uuid),public.create_offerings(jsonb,uuid[]),public.write_student_grades(uuid,uuid,jsonb,boolean),public.list_students(jsonb) from public,anon,authenticated;
grant execute on function public.delete_record(text,uuid),public.create_offerings(jsonb,uuid[]),public.write_student_grades(uuid,uuid,jsonb,boolean),public.list_students(jsonb) to authenticated;
