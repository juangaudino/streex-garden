-- Read-only post-deploy checks. Run against a non-production database first.
select to_regprocedure('garden.resolve_cycle_evidence(uuid,uuid,timestamptz,uuid[],uuid[])') is not null as resolver_exists;
select not has_function_privilege('authenticated', 'garden.resolve_cycle_evidence(uuid,uuid,timestamptz,uuid[],uuid[])', 'execute') as resolver_is_not_client_callable;
select has_function_privilege('service_role', 'public.garden_get_guest_plant_story(text)', 'execute') as guest_delivery_can_read;
select not has_function_privilege('anon', 'public.garden_get_guest_plant_story(text)', 'execute') as guest_delivery_is_not_public_rpc;

-- Behavioral checks with an owner-owned fixture cycle:
-- 1. invalidated events are absent from context;
-- 2. events created after p_as_of are absent;
-- 3. notes appear only when their event id is selected;
-- 4. no photo URL is returned; private storage_path stays at the trusted server boundary;
-- 5. an imported historical photo appears only when selected and belongs to the cycle;
-- 6. opening an existing Guest Plant Story still returns its original shape;
-- 7. verify no table/event/Attention row changes after resolver execution.
