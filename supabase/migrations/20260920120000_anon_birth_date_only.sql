-- Soft-unlock / anon visitors may only change birth_date on family_members.
-- Full editors must use the family@oqariq.family JWT (enterAsFamily signs in).
-- Owner JWT is unchanged.

create or replace function public.restrict_anon_member_updates()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'anon' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
     or new.nickname is distinct from old.nickname
     or new.gender is distinct from old.gender
     or new.death_date is distinct from old.death_date
     or new.is_deceased is distinct from old.is_deceased
     or new.photo is distinct from old.photo
     or new.city is distinct from old.city
     or new.country is distinct from old.country
     or new.occupation is distinct from old.occupation
     or new.biography is distinct from old.biography
  then
    raise exception 'anon may only update birth_date'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists family_members_anon_birth_date_only on public.family_members;
create trigger family_members_anon_birth_date_only
  before update on public.family_members
  for each row
  execute function public.restrict_anon_member_updates();

-- Soft unlock should not insert new people via anon.
drop policy if exists "anon insert members" on public.family_members;
