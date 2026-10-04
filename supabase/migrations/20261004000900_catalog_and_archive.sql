-- Catalog defaults do not alter the credits of existing academic offerings.
alter table public.subjects add column default_credits numeric(5,2) check(default_credits between 0 and 100);
alter table public.subjects add column archived boolean not null default false;
alter table public.classes add column archived boolean not null default false;
alter table public.academic_terms add column archived boolean not null default false;

alter function public.manage_record(text,jsonb) rename to manage_record_v2;
revoke all on function public.manage_record_v2(text,jsonb) from public,anon,authenticated;
create function public.manage_record(kind text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; credits numeric; begin
 perform private.require_admin();
 if kind='subjects' and payload ? 'default_credits' then
  credits:=nullif(payload->>'default_credits','')::numeric;
  if credits<0 or credits>100 or credits<>round(credits,2) then raise exception 'Invalid credits'; end if;
 end if;
 rid:=public.manage_record_v2(kind,payload);
 if kind='subjects' and payload ? 'default_credits' then
  update public.subjects set default_credits=credits where id=rid;
 end if;
 return rid;
end $$;
revoke all on function public.manage_record(text,jsonb) from public,anon;
grant execute on function public.manage_record(text,jsonb) to authenticated;

alter function public.remove_record(text,uuid) rename to remove_record_v2;
revoke all on function public.remove_record_v2(text,uuid) from public,anon,authenticated;
create function public.remove_record(kind text,record_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare result text; begin
 perform private.require_admin();
 result:=public.remove_record_v2(kind,record_id);
 if result='archived' then
  case kind
   when 'subjects' then update public.subjects set archived=true where id=record_id;
   when 'classes' then update public.classes set archived=true where id=record_id;
   when 'terms' then update public.academic_terms set archived=true where id=record_id;
   else null;
  end case;
 end if;
 return result;
end $$;
revoke all on function public.remove_record(text,uuid) from public,anon;
grant execute on function public.remove_record(text,uuid) to authenticated;

create or replace function public.restore_record(kind text,record_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 case kind
 when 'offerings' then update public.subject_offerings set archived=false where id=record_id;
 when 'schemes' then update public.grade_schemes set archived=false where id=record_id;
 when 'subjects' then update public.subjects set archived=false,active=true where id=record_id;
 when 'classes' then update public.classes set archived=false,active=true where id=record_id;
 -- Restore history without changing the school's currently active term.
 when 'terms' then update public.academic_terms set archived=false where id=record_id;
 else raise exception 'Unsupported restoration';
 end case;
end $$;

-- Upgrade the original default palette; keep any customized school colors.
update public.school_settings set primary_color='#4264ad',secondary_color='#f9dfeb'
where primary_color='#126c61' and secondary_color='#f9dfeb';
