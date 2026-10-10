-- Read-only application catalog. No business rows, secrets or migration DML.
set search_path = public, extensions;
select jsonb_build_object(
  'columns', (select md5(jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attname)::text)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind='r'),
  'constraints', (select md5(jsonb_agg(jsonb_build_array(c.relname,con.conname,pg_get_constraintdef(con.oid)) order by c.relname,con.conname)::text)
    from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
  'indexes', (select md5(jsonb_agg(jsonb_build_array(tablename,indexname,indexdef) order by tablename,indexname)::text) from pg_indexes where schemaname='public'),
  'policies', (select md5(jsonb_agg(jsonb_build_array(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check) order by schemaname,tablename,policyname)::text) from pg_policies where schemaname in ('public','private','storage')),
  'triggers', (select md5(jsonb_agg(jsonb_build_array(c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) order by c.relname,t.tgname)::text)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and not t.tgisinternal),
  'tables_rls_grants', (select md5(jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text) order by c.relname)::text) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
  'functions', (select jsonb_object_agg(n.nspname||'.'||p.proname, jsonb_build_object('body',md5(lower(regexp_replace(p.prosrc,'\s','','g'))),'contract',md5(jsonb_build_array(pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),p.prosecdef,p.proconfig,p.proacl::text)::text)) order by n.nspname,p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e'))
) as catalog;
