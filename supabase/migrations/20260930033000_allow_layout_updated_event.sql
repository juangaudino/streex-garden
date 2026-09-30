-- The custom-capacity update RPC records a distinct layout_updated event.
-- Keep that audit event valid without changing any existing Garden data.
alter table garden.layout_events
  drop constraint if exists layout_events_operation_check;

alter table garden.layout_events
  add constraint layout_events_operation_check
  check (operation = any (array['site_added'::text, 'site_updated'::text, 'layout_updated'::text]));
