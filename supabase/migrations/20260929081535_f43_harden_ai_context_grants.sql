begin;

-- F4.3 keeps the derived AI context owner-scoped. Anonymous callers do not
-- need EXECUTE; authenticated clients retain the existing read path.
revoke execute on function public.garden_get_ai_ask_context() from anon;
revoke execute on function public.garden_get_meaningful_change_results() from anon;

grant execute on function public.garden_get_ai_ask_context() to authenticated;
grant execute on function public.garden_get_meaningful_change_results() to authenticated;

commit;
