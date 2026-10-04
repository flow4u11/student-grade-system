-- Configuration contains no invitation secret. Codes are random, hashed and private.
create table public.school_settings (
 id boolean primary key default true check(id),
 name text not null default 'School Ledger' check(length(name) between 1 and 120),
 short_name text not null default 'School Ledger' check(length(short_name) between 1 and 40),
 login_domain text not null default 'school-ledger.test' check(login_domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' and length(login_domain)<=180 and position('..' in login_domain)=0),
 logo_url text not null default '' check(logo_url='' or (logo_url like 'https://%' and length(logo_url)<=500)),
 primary_color text not null default '#126c61' check(primary_color ~ '^#[a-fA-F0-9]{6}$'),
 secondary_color text not null default '#f9dfeb' check(secondary_color ~ '^#[a-fA-F0-9]{6}$'),
 default_language text not null default 'th' check(default_language in ('th','en')),
 default_scheme_id uuid references public.grade_schemes(id) on delete restrict,
 support_info text not null default '' check(length(support_info)<=1000)
);
insert into public.school_settings(id) values(true);
alter table public.school_settings enable row level security;
grant select on public.school_settings to authenticated;
grant all on public.school_settings to service_role;
create policy settings_read on public.school_settings for select to authenticated using(public.is_staff());
create table private.teacher_invites (
 id uuid primary key default gen_random_uuid(), code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 active boolean not null default true, expires_at timestamptz not null,
 max_uses integer not null check(max_uses between 1 and 100), used integer not null default 0 check(used>=0)
);
create table private.teacher_registrations (
 id uuid primary key default gen_random_uuid(), invite_id uuid not null references private.teacher_invites(id),
 username text not null unique, first_name text not null check(length(first_name) between 1 and 120),
 last_name text not null check(length(last_name) between 1 and 120),
 expires_at timestamptz not null default now()+interval '10 minutes', completed boolean not null default false
);
alter table public.profiles add column official_first_name text not null default '' check(length(official_first_name)<=120),
 add column official_last_name text not null default '' check(length(official_last_name)<=120),
 add column school_username text unique,
 add column nickname text not null default '' check(length(nickname)<=60),
 add column contact_email text not null default '' check(length(contact_email)<=254),
 add column contact_phone text not null default '' check(length(contact_phone)<=40),
 add column bio text not null default '' check(length(bio)<=500),
 add column teaching_request text not null default '' check(length(teaching_request)<=500),
 add column avatar text not null default 'teacher' check(avatar in ('teacher','book','leaf','star')),
 add column onboarding_complete boolean not null default false;
update public.profiles p set school_username=u.email from auth.users u where u.id=p.id;

create function public.school_branding() returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(s)||jsonb_build_object('registration_open',exists(select 1 from private.teacher_invites where active and expires_at>now() and used<max_uses)) from public.school_settings s where id
$$;
grant execute on function public.school_branding() to anon,authenticated,service_role;
create function public.update_school_settings(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if nullif(payload->>'default_scheme_id','') is not null and not exists(select 1 from public.grade_schemes where id=(payload->>'default_scheme_id')::uuid and not archived) then raise exception 'Invalid scheme'; end if;
 update public.school_settings set name=trim(payload->>'name'),short_name=trim(payload->>'short_name'),login_domain=lower(trim(payload->>'login_domain')),
 logo_url=coalesce(payload->>'logo_url',''),primary_color=payload->>'primary_color',secondary_color=payload->>'secondary_color',
 default_language=payload->>'default_language',default_scheme_id=nullif(payload->>'default_scheme_id','')::uuid,support_info=coalesce(payload->>'support_info','') where id;
 insert into public.audit_logs(actor,action,entity,after_data) values(auth.uid(),'UPDATE','school_settings',payload);
end $$;
create function public.issue_teacher_invite(code_hash text,days integer,max_uses integer) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if days not between 1 and 30 then raise exception 'Invalid expiry'; end if;
 update private.teacher_invites set active=false where active;
 insert into private.teacher_invites(code_hash,expires_at,max_uses) values(code_hash,now()+make_interval(days=>days),max_uses);
 insert into public.audit_logs(actor,action,entity) values(auth.uid(),'ROTATE_INVITE','school_settings');
end $$;
create function public.close_teacher_registration() returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_admin(); update private.teacher_invites set active=false where active;
 insert into public.audit_logs(actor,action,entity) values(auth.uid(),'CLOSE_REGISTRATION','school_settings'); end $$;
create function public.teacher_invite_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform private.require_admin(); return (select jsonb_build_object('expires_at',expires_at,'remaining',max_uses-used) from private.teacher_invites where active order by expires_at desc limit 1); end $$;
grant execute on function public.update_school_settings(jsonb),public.issue_teacher_invite(text,integer,integer),public.close_teacher_registration(),public.teacher_invite_status() to authenticated;

create function public.reserve_teacher_registration(code_hash text,base_name text,first_name text,last_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation private.teacher_invites; domain text; candidate text; suffix integer:=1; reservation uuid;
begin
 if base_name !~ '^[a-z]{1,48}\.[a-z]{1,4}$' then raise exception 'Invalid login name'; end if;
 perform pg_advisory_xact_lock(728302);
 -- Recover expired reservations so failed network requests cannot exhaust invitations.
 with expired as (delete from private.teacher_registrations where not completed and expires_at<now() returning invite_id), totals as (select invite_id,count(*) n from expired group by invite_id)
 update private.teacher_invites i set used=greatest(0,used-t.n) from totals t where i.id=t.invite_id;
 select * into invitation from private.teacher_invites i where i.code_hash=reserve_teacher_registration.code_hash and active and expires_at>now() and used<max_uses for update;
 if not found then raise exception 'REGISTRATION_DENIED'; end if;
 select login_domain into strict domain from public.school_settings where id;
 loop
  candidate:=base_name||case when suffix=1 then '' else '.'||suffix::text end||'@'||domain;
  exit when not exists(select 1 from auth.users where lower(email)=candidate) and not exists(select 1 from private.teacher_registrations where username=candidate) and not exists(select 1 from public.profiles where school_username=candidate);
  suffix:=suffix+1; if suffix>10000 then raise exception 'REGISTRATION_DENIED'; end if;
 end loop;
 insert into private.teacher_registrations(invite_id,username,first_name,last_name) values(invitation.id,candidate,trim(first_name),trim(last_name)) returning id into reservation;
 update private.teacher_invites set used=used+1 where id=invitation.id;
 return jsonb_build_object('id',reservation,'username',candidate);
end $$;
create function public.cancel_teacher_registration(reservation uuid) returns void language plpgsql security definer set search_path='' as $$
declare invite uuid;
begin
 perform pg_advisory_xact_lock(728302);
 delete from private.teacher_registrations where id=reservation and not completed returning invite_id into invite;
 if invite is not null then update private.teacher_invites set used=greatest(0,used-1) where id=invite; end if;
end $$;
grant execute on function public.reserve_teacher_registration(text,text,text,text),public.cancel_teacher_registration(uuid) to service_role;
-- Auth and profile creation are atomic. Only trusted app_metadata can reference a reservation.
create function private.provision_invited_teacher() returns trigger language plpgsql security definer set search_path='' as $$
declare r private.teacher_registrations;
begin
 if not coalesce(new.raw_app_meta_data ? 'school_registration',false) then return new; end if;
 if tg_op='UPDATE' and old.raw_app_meta_data->>'school_registration' is not distinct from new.raw_app_meta_data->>'school_registration' then return new; end if;
 select * into r from private.teacher_registrations where id=(new.raw_app_meta_data->>'school_registration')::uuid and not completed and expires_at>now() for update;
 if not found or lower(new.email) is distinct from r.username or not exists(select 1 from private.teacher_invites where id=r.invite_id and active and expires_at>now()) then raise exception 'REGISTRATION_DENIED'; end if;
 insert into public.profiles(id,display_name,role,official_first_name,official_last_name,school_username) values(new.id,left(r.first_name||' '||r.last_name,120),'TEACHER',r.first_name,r.last_name,r.username);
 update private.teacher_registrations set completed=true where id=r.id;
 return new;
end $$;
create trigger provision_invited_teacher after insert or update of raw_app_meta_data on auth.users for each row execute function private.provision_invited_teacher();

create function public.update_teacher_profile(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_staff();
 if payload - array['nickname','contact_email','contact_phone','bio','teaching_request','avatar'] <> '{}'::jsonb then raise exception 'Locked profile field' using errcode='42501'; end if;
 update public.profiles set nickname=trim(coalesce(payload->>'nickname','')),contact_email=trim(coalesce(payload->>'contact_email','')),contact_phone=trim(coalesce(payload->>'contact_phone','')),
 bio=trim(coalesce(payload->>'bio','')),teaching_request=trim(coalesce(payload->>'teaching_request','')),avatar=coalesce(payload->>'avatar','teacher'),onboarding_complete=true where id=auth.uid();
end $$;
grant execute on function public.update_teacher_profile(jsonb) to authenticated;

create table public.feedback (
 id uuid primary key default gen_random_uuid(),author uuid not null references public.profiles(id) on delete restrict,
 type text not null check(type in ('PROBLEM','SUGGESTION','FEATURE','OTHER')),
 message text not null check(length(trim(message)) between 1 and 3000),
 page text not null default '' check(length(page)<=120),contact text not null default '' check(length(contact)<=254),
 status text not null default 'NEW' check(status in ('NEW','READ','DONE')),created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
grant select on public.feedback to authenticated;
grant all on public.feedback to service_role;
create policy feedback_read on public.feedback for select to authenticated using(public.is_staff() and (author=auth.uid() or public.is_admin()));
create function public.submit_feedback(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 perform private.require_staff();
 if not public.consume_limit('feedback:'||auth.uid()::text,10) then raise exception 'RATE_LIMIT'; end if;
 insert into public.feedback(author,type,message,page,contact) values(auth.uid(),payload->>'type',trim(payload->>'message'),coalesce(payload->>'page',''),coalesce(payload->>'contact','')) returning id into rid;
 return rid;
end $$;
create function public.review_feedback(feedback_id uuid,new_status text) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_admin(); update public.feedback set status=new_status where id=feedback_id;
 insert into public.audit_logs(actor,action,entity,entity_id,after_data) values(auth.uid(),'REVIEW','feedback',feedback_id,jsonb_build_object('status',new_status)); end $$;
grant execute on function public.submit_feedback(jsonb),public.review_feedback(uuid,text) to authenticated;
