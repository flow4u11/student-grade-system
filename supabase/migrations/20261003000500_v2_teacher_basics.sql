alter table public.enrollments add column roll_number integer check(roll_number between 1 and 1000);
create unique index enrollment_roll_number on public.enrollments(term_id,class_id,roll_number) where roll_number is not null;
alter table public.subject_offerings add column archived boolean not null default false;
alter table public.grade_schemes add column archived boolean not null default false;

alter function public.manage_record(text,jsonb) rename to manage_record_v1;
revoke all on function public.manage_record_v1(text,jsonb) from public,anon,authenticated;
create function public.manage_record(kind text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; begin
 perform private.require_staff();
 rid:=public.manage_record_v1(kind,payload);
 if kind='students' and payload ? 'roll_number' then
  update public.enrollments set roll_number=nullif(payload->>'roll_number','')::integer where student_id=rid and term_id=(payload->>'term_id')::uuid;
 end if;
 return rid;
end $$;
grant execute on function public.manage_record(text,jsonb) to authenticated;

-- Keep explicit publication a separate, versioned action.
alter function public.save_grades(uuid,jsonb) rename to save_grades_v1;
revoke all on function public.save_grades_v1(uuid,jsonb) from public,anon,authenticated;
create function public.save_grades(offering uuid, rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
 perform 1 from public.subject_offerings where id=offering for update;
 if exists(select 1 from public.student_grades g where g.offering_id=offering and g.state='PUBLISHED' and g.student_id in(select (v->>'student_id')::uuid from jsonb_array_elements(rows) v)) then raise exception 'PUBLISHED_LOCKED'; end if;
 if exists(select 1 from public.subject_offerings where id=offering and archived) then raise exception 'Archived offering'; end if;
 return public.save_grades_v1(offering,rows);
end $$;
grant execute on function public.save_grades(uuid,jsonb) to authenticated;
create function private.protect_published_score() returns trigger language plpgsql set search_path='' as $$
begin
 if old.state='PUBLISHED' and (new.score,new.result,new.grade_points) is distinct from (old.score,old.result,old.grade_points) then raise exception 'PUBLISHED_LOCKED'; end if;
 return new;
end $$;
create trigger published_score_lock before update on public.student_grades for each row execute function private.protect_published_score();
revoke all on function private.protect_published_score() from public,anon,authenticated;

create function public.remove_record(kind text,record_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
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
revoke all on function public.remove_record(text,uuid) from public,anon;
grant execute on function public.remove_record(text,uuid) to authenticated;

create or replace function public.list_students(filters jsonb) returns jsonb
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


create or replace function public.import_students(rows jsonb, term uuid) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; class_ref uuid; n integer:=0; begin
 perform private.require_staff();
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

create function public.restore_record(kind text,record_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
 case kind
 when 'offerings' then update public.subject_offerings set archived=false where id=record_id;
 when 'schemes' then update public.grade_schemes set archived=false where id=record_id;
 else raise exception 'Unsupported restoration';
 end case;
end $$;
revoke all on function public.restore_record(text,uuid) from public,anon;
grant execute on function public.restore_record(text,uuid) to authenticated;
create function public.teacher_work(term uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from (
 select o.*, count(e.student_id) filter(where s.active) as total,
 count(g.id) filter(where s.active) as recorded,
 count(g.id) filter(where s.active and g.state='PUBLISHED') as published
 from public.subject_offerings o
 left join public.enrollments e on e.class_id=o.class_id and e.term_id=o.term_id
 left join public.students s on s.id=e.student_id
 left join public.student_grades g on g.offering_id=o.id and g.student_id=e.student_id
 where o.term_id=term and not o.archived group by o.id order by o.created_at
 ) w
$$;
grant execute on function public.teacher_work(uuid) to authenticated;
