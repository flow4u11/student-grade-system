-- Local databases only. Fixtures, role changes and audit records all roll back.
begin;
create temp table scope_ids(k text primary key,v uuid);
grant select on scope_ids to authenticated;
create function pg_temp.scope_id(key text) returns uuid language sql as $$ select v from scope_ids where k=key $$;
create function pg_temp.scope_check(ok boolean,label text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.scope_denied(statement text) returns void language plpgsql as $$ begin execute statement; raise exception 'Unauthorized operation succeeded'; exception when insufficient_privilege then null; end $$;
grant execute on function pg_temp.scope_id(text),pg_temp.scope_check(boolean,text),pg_temp.scope_denied(text) to authenticated;
do $$
declare k text; u uuid; tid uuid; ca uuid; cb uuid; sub uuid; sub2 uuid; scheme uuid; oa uuid; ob uuid; shared uuid; sa uuid; sb uuid; stamp text:=substr(gen_random_uuid()::text,1,8); p jsonb;
begin
 foreach k in array array['admin','a','b','unassigned','developer'] loop
  u:=gen_random_uuid(); insert into auth.users(id) values(u); insert into public.profiles(id,display_name,role) values(u,k,case k when 'admin' then 'ADMIN' when 'developer' then 'DEVELOPER' else 'TEACHER' end); insert into scope_ids values(k,u);
 end loop;
 perform set_config('request.jwt.claim.sub',pg_temp.scope_id('admin')::text,true);
 tid:=public.manage_record('terms',jsonb_build_object('academic_year',2026,'name','SCOPE-'||stamp));insert into scope_ids values('term',tid);
 ca:=public.manage_record('classes',jsonb_build_object('name','SCOPE-A-'||stamp));cb:=public.manage_record('classes',jsonb_build_object('name','SCOPE-B-'||stamp));
 insert into scope_ids values('class_a',ca);
 sub:=public.manage_record('subjects',jsonb_build_object('code','SCA-'||stamp,'name_th','A','name_en','A'));sub2:=public.manage_record('subjects',jsonb_build_object('code','SCB-'||stamp,'name_th','B','name_en','B'));
 select id into strict scheme from public.grade_schemes limit 1;
 p:=jsonb_build_object('subject_id',sub,'term_id',tid,'class_id',ca,'grading_type','NUMERIC_GRADE','max_score',100,'credits',1,'scheme_id',scheme,'include_in_gpa',true,'pass_mode','AUTOMATIC','pass_threshold',60);
 oa:=public.manage_record('offerings',p);ob:=public.manage_record('offerings',p||jsonb_build_object('class_id',cb));shared:=public.manage_record('offerings',p||jsonb_build_object('subject_id',sub2));
 insert into scope_ids values('oa',oa),('ob',ob),('shared',shared);
 sa:=public.manage_record('students',jsonb_build_object('student_number','SCA-'||stamp,'first_name','A','last_name','Example','term_id',tid,'class_id',ca));
 sb:=public.manage_record('students',jsonb_build_object('student_number','SCB-'||stamp,'first_name','B','last_name','Example','term_id',tid,'class_id',cb));insert into scope_ids values('sa',sa),('sb',sb);
 perform public.assign_teacher(pg_temp.scope_id('a'),oa,true);perform public.assign_teacher(pg_temp.scope_id('b'),ob,true);perform public.assign_teacher(pg_temp.scope_id('b'),shared,true);
 perform public.save_grades(shared,jsonb_build_array(jsonb_build_object('student_id',sa,'score',80,'version',0)));
end $$;

do $$ declare other_term uuid; other_offering uuid; begin
 perform public.save_grades(pg_temp.scope_id('oa'),jsonb_build_array(jsonb_build_object('student_id',pg_temp.scope_id('sa'),'score',60,'version',0)));
 perform public.save_grades(pg_temp.scope_id('ob'),jsonb_build_array(jsonb_build_object('student_id',pg_temp.scope_id('sb'),'score',90,'version',0)));
 perform public.publish_grades(pg_temp.scope_id('oa'),jsonb_build_array(jsonb_build_object('student_id',pg_temp.scope_id('sa'),'version',1)),true);
 other_term:=public.manage_record('terms',jsonb_build_object('academic_year',2027,'name','RESET-'||substr(gen_random_uuid()::text,1,8)));
 insert into public.enrollments(student_id,term_id,class_id) values(pg_temp.scope_id('sa'),other_term,pg_temp.scope_id('class_a'));
 insert into public.subject_offerings(subject_id,term_id,class_id,grading_type,max_score,credits,scheme_id,include_in_gpa) select subject_id,other_term,class_id,grading_type,max_score,credits,scheme_id,include_in_gpa from public.subject_offerings where id=pg_temp.scope_id('oa') returning id into other_offering;
 perform public.save_grades(other_offering,jsonb_build_array(jsonb_build_object('student_id',pg_temp.scope_id('sa'),'score',70,'version',0)));
 insert into scope_ids values('other_offering',other_offering);
end $$;
select public.authorize_grade_reset(pg_temp.scope_id('admin'),pg_temp.scope_id('term'),repeat('a',64))->>'count' = '3' as preview_correct;
set local role authenticated;
select pg_temp.scope_check(not has_function_privilege('authenticated','public.authorize_grade_reset(uuid,uuid,text)','execute'),'Clients cannot mint reauthentication proofs');
select pg_temp.scope_denied(format('select public.reset_term_grades(%L,%L,%L)',pg_temp.scope_id('term'),repeat('b',64),'RESET GRADES'));
select pg_temp.scope_denied(format('select public.reset_term_grades(%L,%L,%L)',pg_temp.scope_id('term'),repeat('a',64),'wrong'));
select pg_temp.scope_check(true,'Unknown proof and wrong phrase are blocked');
select set_config('request.jwt.claim.sub',pg_temp.scope_id('developer')::text,true) is not null as identity_set;
select pg_temp.scope_denied(format('select public.reset_term_grades(%L,%L,%L)',pg_temp.scope_id('term'),repeat('a',64),'RESET GRADES'));
select pg_temp.scope_check(true,'Proof is bound to the reauthenticated account');
select set_config('request.jwt.claim.sub',pg_temp.scope_id('admin')::text,true) is not null as identity_set;
select public.save_grades(pg_temp.scope_id('shared'),jsonb_build_array(jsonb_build_object('student_id',pg_temp.scope_id('sa'),'score',95,'version',1)));
do $$ begin perform public.reset_term_grades(pg_temp.scope_id('term'),repeat('a',64),'RESET GRADES');raise exception 'Changed preview accepted';exception when serialization_failure then null;end $$;
select pg_temp.scope_check((select count(*)=3 from public.student_grades where offering_id in (pg_temp.scope_id('oa'),pg_temp.scope_id('ob'),pg_temp.scope_id('shared'))),'Changed preview aborts without partial deletion');
reset role;
update private.grade_reset_proofs set expires_at=now()-interval '1 minute' where token_hash=repeat('a',64);
set local role authenticated;
select pg_temp.scope_denied(format('select public.reset_term_grades(%L,%L,%L)',pg_temp.scope_id('term'),repeat('a',64),'RESET GRADES'));
select pg_temp.scope_check(true,'Expired proof is blocked');
reset role;
select public.authorize_grade_reset(pg_temp.scope_id('admin'),pg_temp.scope_id('term'),repeat('c',64)) is not null as authorized;
set local role authenticated;
select pg_temp.scope_check(public.reset_term_grades(pg_temp.scope_id('term'),repeat('c',64),'RESET GRADES')=3,'Confirmed reset removes selected term grades including published results');
select pg_temp.scope_check((select count(*)=1 from public.student_grades where offering_id=pg_temp.scope_id('other_offering')),'Other term grades survive');
select pg_temp.scope_check((select count(*)=2 from public.students where id in (pg_temp.scope_id('sa'),pg_temp.scope_id('sb'))) and (select count(*)=3 from public.enrollments where student_id in (pg_temp.scope_id('sa'),pg_temp.scope_id('sb'))),'Students and enrollment records survive');
select pg_temp.scope_check((select count(*)=1 from public.audit_logs where action='HARD_RESET_GRADES' and entity_id=pg_temp.scope_id('term')) and (select count(*)>=3 from public.audit_logs where action='DELETE' and entity='student_grades'),'Reset and per-grade audit history retained');
select pg_temp.scope_denied(format('select public.reset_term_grades(%L,%L,%L)',pg_temp.scope_id('term'),repeat('c',64),'RESET GRADES'));
select pg_temp.scope_check(true,'Consumed proof cannot be replayed');
reset role;
rollback;
