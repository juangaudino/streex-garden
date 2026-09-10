-- Read-only verification for Garden AI Foundation MVP.
select to_regclass('garden.ai_requests') as ai_requests_table;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'garden'
  and table_name = 'ai_requests'
order by ordinal_position;

select relrowsecurity as rls_enabled
from pg_class
where oid = 'garden.ai_requests'::regclass;

select has_function_privilege(
  'public',
  'garden.cleanup_expired_ai_requests()',
  'execute'
) as public_cleanup_execute;
