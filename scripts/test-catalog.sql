-- Disposable fixtures. Safe on local databases; never run against production.
begin;
create function pg_temp.check_catalog(ok boolean,label text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
do $$
declare admin_id uuid:=gen_random_uuid(); teacher_id uuid:=gen_random_uuid(); tid uuid; cid uuid; sid uuid; oid uuid; learner uuid; scheme uuid; unused uuid; k text; stamp text:=substr(gen_random_uuid()::text,1,8); grade_id uuid;
begin
 insert into auth.users(id) values(admin_id),(teacher_id);
 insert into public.profiles(id,display_name,role) values(admin_id,'Catalog admin','ADMIN'),(teacher_id,'Catalog teacher','TEACHER');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 tid:=public.manage_record('terms',jsonb_build_object('academic_year',2026,'name','CAT-'||stamp,'active',false));
 cid:=public.manage_record('classes',jsonb_build_object('name','CAT-'||stamp));
 sid:=public.manage_record('subjects',jsonb_build_object('code','CAT-'||stamp,'name_th','วิชาทดสอบ','name_en','Test','default_credits',null));
 perform pg_temp.check_catalog((select default_credits is null from public.subjects where id=sid),'Unknown credit remains NULL');
 perform public.manage_record('subjects',jsonb_build_object('id',sid,'code','CAT-'||stamp,'name_th','วิชาทดสอบ','name_en','Test','default_credits',1.5));
 perform pg_temp.check_catalog((select default_credits=1.5 from public.subjects where id=sid),'Fractional catalog credits saved');
 begin
  perform public.manage_record('subjects',jsonb_build_object('code','BAD-'||stamp,'name_th','Bad','name_en','Bad','default_credits',1.234));
  raise exception 'TEST_INVALID_CREDIT_ACCEPTED';
 exception when raise_exception then if sqlerrm <> 'Invalid credits' then raise; end if; end;
 perform pg_temp.check_catalog(true,'Excess credit precision rejected');
 scheme:=public.manage_record('schemes',jsonb_build_object('name','CAT-'||stamp,'rules','[{"minimum":80,"points":4},{"minimum":0,"points":0}]'::jsonb));
 oid:=public.manage_record('offerings',jsonb_build_object('subject_id',sid,'term_id',tid,'class_id',cid,'grading_type','NUMERIC_GRADE','max_score',100,'credits',2,'scheme_id',scheme,'include_in_gpa',true,'pass_mode','AUTOMATIC','pass_threshold',60));
 learner:=public.manage_record('students',jsonb_build_object('student_number','CAT-'||stamp,'first_name','Fictional','last_name','Example','class_id',cid,'term_id',tid));
 perform public.save_grades(oid,jsonb_build_array(jsonb_build_object('student_id',learner,'score',80,'version',0)));
 select id into grade_id from public.student_grades where offering_id=oid;
 foreach k in array array['subjects','classes','terms','offerings','schemes'] loop
  unused:=case k when 'subjects' then sid when 'classes' then cid when 'terms' then tid when 'offerings' then oid else scheme end;
  perform pg_temp.check_catalog(public.remove_record(k,unused)='archived',k||' with history archives');
 end loop;
 perform pg_temp.check_catalog((select archived and not active from public.subjects where id=sid) and (select archived and not active from public.classes where id=cid) and (select archived and not active from public.academic_terms where id=tid),'Central records flagged archived');
 perform pg_temp.check_catalog(exists(select 1 from public.student_grades where id=grade_id and score=80) and (select credits=2 from public.subject_offerings where id=oid),'Removal preserves grades and offering credits');
 foreach k in array array['subjects','classes','terms','offerings','schemes'] loop
  perform public.restore_record(k,case k when 'subjects' then sid when 'classes' then cid when 'terms' then tid when 'offerings' then oid else scheme end);
 end loop;
 perform pg_temp.check_catalog((select not archived and active from public.subjects where id=sid) and (select not archived and active from public.classes where id=cid) and (select not archived and not active from public.academic_terms where id=tid) and (select not archived from public.subject_offerings where id=oid) and (select not archived from public.grade_schemes where id=scheme),'All restore; historic term does not become current');
 foreach k in array array['subjects','classes','terms','schemes'] loop
  unused:=public.manage_record(k,case k when 'subjects' then jsonb_build_object('code','UNUSED-'||stamp,'name_th','Unused','name_en','Unused') when 'classes' then jsonb_build_object('name','UNUSED-'||stamp) when 'terms' then jsonb_build_object('academic_year',2026,'name','UNUSED-'||stamp,'active',false) else jsonb_build_object('name','UNUSED-'||stamp,'rules','[{"minimum":80,"points":4},{"minimum":0,"points":0}]'::jsonb) end);
  perform pg_temp.check_catalog(public.remove_record(k,unused)='deleted',k||' without history deletes');
 end loop;
 perform set_config('request.jwt.claim.sub',teacher_id::text,true);
 begin perform public.restore_record('subjects',sid); raise exception 'Unauthorized restoration'; exception when insufficient_privilege then null; end;
 begin perform public.remove_record('subjects',sid); raise exception 'Unauthorized deletion'; exception when insufficient_privilege then null; end;
 perform pg_temp.check_catalog(true,'Teacher cannot remove or restore shared catalog');
 perform pg_temp.check_catalog(not has_function_privilege('authenticated','public.remove_record_v2(text,uuid)','EXECUTE') and not has_function_privilege('authenticated','public.manage_record_v2(text,jsonb)','EXECUTE'),'Legacy helper privileges revoked');
end $$;
rollback;
