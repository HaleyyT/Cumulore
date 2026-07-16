ALTER SCHEMA app OWNER TO cumulore_migration;
ALTER TABLE schema_migrations OWNER TO cumulore_migration;
GRANT SELECT, INSERT, UPDATE ON schema_migrations TO cumulore_migration;
ALTER FUNCTION app.current_user_id() OWNER TO cumulore_migration;
ALTER FUNCTION app.current_workspace_id() OWNER TO cumulore_migration;
ALTER FUNCTION app.active_workspace_member(uuid) OWNER TO cumulore_migration;
ALTER TYPE workspace_member_role OWNER TO cumulore_migration;

SET LOCAL ROLE cumulore_migration;

DROP POLICY member_read ON workspace_members;
CREATE POLICY member_read ON workspace_members FOR SELECT TO cumulore_web
  USING (
    workspace_id = app.current_workspace_id()
    AND user_id = app.current_user_id()
    AND app.active_workspace_member(workspace_id)
  );

CREATE OR REPLACE FUNCTION app.create_folder(
  p_name text,
  p_parent_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE new_folder_id uuid;
BEGIN
  IF app.current_user_id() IS NULL OR app.current_workspace_id() IS NULL
    OR NOT app.active_workspace_member(app.current_workspace_id()) THEN
    RAISE EXCEPTION 'authenticated workspace actor is required' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR char_length(p_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'folder name must contain between 1 and 120 characters' USING ERRCODE = '22023';
  END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM folders
    WHERE workspace_id = app.current_workspace_id() AND id = p_parent_id
  ) THEN
    RAISE EXCEPTION 'parent folder is not in the workspace' USING ERRCODE = '42501';
  END IF;

  INSERT INTO folders (workspace_id, name, parent_id)
  VALUES (app.current_workspace_id(), p_name, p_parent_id)
  RETURNING id INTO new_folder_id;

  INSERT INTO folder_closure (workspace_id, ancestor_id, descendant_id, depth)
  VALUES (app.current_workspace_id(), new_folder_id, new_folder_id, 0);

  IF p_parent_id IS NOT NULL THEN
    INSERT INTO folder_closure (workspace_id, ancestor_id, descendant_id, depth)
    SELECT app.current_workspace_id(), ancestor_id, new_folder_id, depth + 1
    FROM folder_closure
    WHERE workspace_id = app.current_workspace_id() AND descendant_id = p_parent_id;
  END IF;

  RETURN new_folder_id;
END;
$$;

ALTER FUNCTION app.create_folder(text, uuid) OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.create_folder(text, uuid)
  FROM PUBLIC, cumulore_worker, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.create_folder(text, uuid) TO cumulore_web;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON folders, folder_closure
  FROM cumulore_web, cumulore_worker, cumulore_break_glass;

RESET ROLE;
