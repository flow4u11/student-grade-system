-- Correct legacy teacher identities without changing Auth login, role or academic records.
create function public.admin_update_teacher(teacher uuid, expected_updated_at timestamptz, payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare previous public.profiles;
begin
 perform private.require_admin();
 select * into previous from public.profiles where id=teacher for update;
 if not found or previous.role<>'TEACHER' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if previous.updated_at is distinct from expected_updated_at then raise exception 'Teacher profile changed; reload before editing' using errcode='40001'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload - array['display_name','official_first_name_th','official_last_name_th','official_first_name','official_last_name','nickname','contact_email','contact_phone'] <> '{}'::jsonb
 or not payload ?& array['display_name','official_first_name_th','official_last_name_th','official_first_name','official_last_name','nickname','contact_email','contact_phone']
 or exists(select 1 from jsonb_each(payload) p where jsonb_typeof(p.value)<>'string') then raise exception 'Invalid teacher fields' using errcode='23514'; end if;
 if (length(trim(payload->>'official_first_name_th'))>0) <> (length(trim(payload->>'official_last_name_th'))>0) then raise exception 'Thai names must be paired' using errcode='23514'; end if;
 update public.profiles set display_name=trim(payload->>'display_name'),
 official_first_name_th=trim(payload->>'official_first_name_th'),official_last_name_th=trim(payload->>'official_last_name_th'),
 official_first_name=trim(payload->>'official_first_name'),official_last_name=trim(payload->>'official_last_name'),
 nickname=trim(payload->>'nickname'),contact_email=trim(payload->>'contact_email'),contact_phone=trim(payload->>'contact_phone') where id=teacher;
end $$;
revoke all on function public.admin_update_teacher(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.admin_update_teacher(uuid,timestamptz,jsonb) to authenticated;
