-- Read-only: execute the same RPC used by the app as the owner of the latest
-- confirmed HEIC observation. ROLLBACK removes the temporary request context.
begin;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from garden.events
where id = '016bae41-dfdd-4ade-b77c-54351d12ee95';

select public.garden_get_cycle(grow_cycle_id) as cycle_projection
from garden.events
where id = '016bae41-dfdd-4ade-b77c-54351d12ee95';

rollback;
