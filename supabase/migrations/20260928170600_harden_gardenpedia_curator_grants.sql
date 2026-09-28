begin;

-- Curator operations are authenticated-only APIs. The function bodies also
-- enforce curator membership, but anon must not receive executable access.
revoke all on function public.gardenpedia_research_begin(uuid) from public, anon;
revoke all on function public.gardenpedia_research_failed(uuid, text) from public, anon;
revoke all on function public.gardenpedia_submit_proposal(uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.gardenpedia_research_begin(uuid) to authenticated;
grant execute on function public.gardenpedia_research_failed(uuid, text) to authenticated;
grant execute on function public.gardenpedia_submit_proposal(uuid, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
