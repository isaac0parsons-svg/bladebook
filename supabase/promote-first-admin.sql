-- Run this AFTER creating the user in Supabase Authentication > Users.
-- Replace only you@example.com below with the exact email address you created.

do $$
declare
  target_email constant text := 'you@example.com';
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email);

  if target_user_id is null then
    raise exception 'No Supabase Auth user exists for %', target_email;
  end if;

  insert into public.admins (user_id, email)
  values (target_user_id, target_email)
  on conflict (user_id) do update
  set email = excluded.email;
end $$;

select user_id, email, created_at from public.admins order by created_at;
