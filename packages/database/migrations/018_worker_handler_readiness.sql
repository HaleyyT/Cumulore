SET LOCAL ROLE cumulore_migration;

CREATE OR REPLACE FUNCTION app.required_handler_versions()
RETURNS TABLE (handler_name text, handler_version integer)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT DISTINCT required.handler_name, required.handler_version
  FROM (
    SELECT handler.handler_name, handler.handler_version
    FROM event_handlers handler
    WHERE handler.active
    UNION ALL
    SELECT job.handler_name, job.handler_version
    FROM jobs job
    WHERE job.state IN ('pending', 'running', 'retry_wait')
  ) required
  ORDER BY required.handler_name, required.handler_version;
$$;

ALTER FUNCTION app.required_handler_versions() OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.required_handler_versions()
  FROM PUBLIC, cumulore_web, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.required_handler_versions() TO cumulore_worker;

RESET ROLE;
