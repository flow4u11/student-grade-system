-- Global school palettes. Display mode remains a personal browser preference.
alter table public.school_settings
  add column background_color text not null default '#f4f6fc' check (background_color ~ '^#[a-fA-F0-9]{6}$'),
  add column background_color_dark text not null default '#111522' check (background_color_dark ~ '^#[a-fA-F0-9]{6}$');

create or replace function public.update_school_settings(payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if nullif(payload->>'default_scheme_id','') is not null and not exists(select 1 from public.grade_schemes where id=(payload->>'default_scheme_id')::uuid and not archived) then raise exception 'Invalid scheme'; end if;
 update public.school_settings set name=trim(payload->>'name'),short_name=trim(payload->>'short_name'),login_domain=lower(trim(payload->>'login_domain')),
 logo_url=coalesce(payload->>'logo_url',''),primary_color=payload->>'primary_color',secondary_color=payload->>'secondary_color',
 background_color=coalesce(payload->>'background_color',background_color),
 background_color_dark=coalesce(payload->>'background_color_dark',background_color_dark),
 default_language=payload->>'default_language',default_scheme_id=nullif(payload->>'default_scheme_id','')::uuid,support_info=coalesce(payload->>'support_info','') where id;
 insert into public.audit_logs(actor,action,entity,after_data) values(auth.uid(),'UPDATE','school_settings',payload);
end $$;
