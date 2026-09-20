-- Public stats for home “missing dates” progress (no raw audit rows exposed).
create or replace function public.birth_date_fill_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  missing_count int;
  filled_week int;
begin
  select count(*)::int into missing_count
  from public.family_members
  where coalesce(is_deceased, false) = false
    and death_date is null
    and (
      birth_date is null
      or btrim(birth_date) = ''
      or birth_date !~ '^\d{4}-\d{2}-\d{2}$'
    );

  select count(*)::int into filled_week
  from public.family_audit_log
  where at > now() - interval '7 days'
    and details::text ilike '%birthDate%';

  return json_build_object(
    'missing', coalesce(missing_count, 0),
    'filledThisWeek', coalesce(filled_week, 0)
  );
end;
$$;

revoke all on function public.birth_date_fill_stats() from public;
grant execute on function public.birth_date_fill_stats() to anon, authenticated;
