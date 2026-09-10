-- Read-only verification for the authenticated AI context adapter.
select to_regprocedure('public.garden_get_ai_cycle_context(uuid,uuid,uuid)') as ai_context_function;
select has_function_privilege('authenticated', 'public.garden_get_ai_cycle_context(uuid,uuid,uuid)', 'execute') as authenticated_execute;
select has_function_privilege('anon', 'public.garden_get_ai_cycle_context(uuid,uuid,uuid)', 'execute') as anon_execute;
select has_function_privilege('public', 'garden.resolve_cycle_evidence(uuid,uuid,timestamptz,uuid[],uuid[])', 'execute') as public_resolver_execute;
