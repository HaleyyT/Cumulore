CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE ROLE cumulore_migration NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE cumulore_web NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE cumulore_worker NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE cumulore_break_glass NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT cumulore_migration, cumulore_web, cumulore_worker, cumulore_break_glass TO cumulore;

CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO cumulore_web;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app.current_workspace_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid $$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issuer text NOT NULL,
  subject text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject)
);
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id)
);
CREATE TYPE workspace_member_role AS ENUM ('owner', 'member');
CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role workspace_member_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id uuid,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, parent_id) REFERENCES folders(workspace_id, id) ON DELETE RESTRICT,
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE TABLE folder_closure (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ancestor_id uuid NOT NULL,
  descendant_id uuid NOT NULL,
  depth integer NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (workspace_id, ancestor_id, descendant_id),
  FOREIGN KEY (workspace_id, ancestor_id) REFERENCES folders(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, descendant_id) REFERENCES folders(workspace_id, id) ON DELETE CASCADE,
  CHECK ((ancestor_id = descendant_id AND depth = 0) OR (ancestor_id <> descendant_id AND depth > 0))
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users FOR SELECT TO cumulore_web USING (id = app.current_user_id());
CREATE POLICY users_migration ON users FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);
ALTER TABLE external_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY external_identities_self ON external_identities FOR SELECT TO cumulore_web USING (user_id = app.current_user_id());
CREATE POLICY external_identities_migration ON external_identities FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders FORCE ROW LEVEL SECURITY;
ALTER TABLE folder_closure ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_closure FORCE ROW LEVEL SECURITY;

CREATE FUNCTION app.active_workspace_member(workspace uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app AS $$
  SELECT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspace AND user_id = app.current_user_id() AND active)
$$;
CREATE POLICY workspace_access ON workspaces FOR ALL TO cumulore_web
  USING (id = app.current_workspace_id() AND app.active_workspace_member(id))
  WITH CHECK (id = app.current_workspace_id() AND app.active_workspace_member(id));
CREATE POLICY workspaces_migration ON workspaces FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);
CREATE POLICY member_read ON workspace_members FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY members_migration ON workspace_members FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);
CREATE POLICY folder_access ON folders FOR ALL TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id))
  WITH CHECK (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY folders_migration ON folders FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);
CREATE POLICY closure_access ON folder_closure FOR ALL TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id))
  WITH CHECK (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY closure_migration ON folder_closure FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION app.provision_identity(identity_issuer text, identity_subject text, profile_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
DECLARE internal_user_id uuid;
BEGIN
  SELECT user_id INTO internal_user_id FROM external_identities WHERE issuer = identity_issuer AND subject = identity_subject;
  IF internal_user_id IS NULL THEN
    INSERT INTO users DEFAULT VALUES RETURNING id INTO internal_user_id;
    INSERT INTO external_identities (user_id, issuer, subject, email) VALUES (internal_user_id, identity_issuer, identity_subject, profile_email);
  ELSE
    UPDATE external_identities SET email = profile_email, updated_at = now() WHERE issuer = identity_issuer AND subject = identity_subject;
  END IF;
  RETURN internal_user_id;
END $$;
CREATE OR REPLACE FUNCTION app.create_workspace(workspace_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
DECLARE new_workspace_id uuid;
BEGIN
  IF app.current_user_id() IS NULL THEN RAISE EXCEPTION 'authenticated actor is required'; END IF;
  INSERT INTO workspaces (name) VALUES (workspace_name) RETURNING id INTO new_workspace_id;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (new_workspace_id, app.current_user_id(), 'owner');
  RETURN new_workspace_id;
END $$;
CREATE OR REPLACE FUNCTION app.add_workspace_member(target_workspace_id uuid, target_user_id uuid, target_role workspace_member_role) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
BEGIN
  IF target_workspace_id <> app.current_workspace_id() OR NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = target_workspace_id AND user_id = app.current_user_id() AND active AND role = 'owner'
  ) THEN RAISE EXCEPTION 'owner authorization is required'; END IF;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (target_workspace_id, target_user_id, target_role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role, active = true;
END $$;

ALTER FUNCTION app.provision_identity(text, text, text) OWNER TO cumulore_migration;
ALTER FUNCTION app.create_workspace(text) OWNER TO cumulore_migration;
ALTER FUNCTION app.add_workspace_member(uuid, uuid, workspace_member_role) OWNER TO cumulore_migration;
GRANT EXECUTE ON FUNCTION app.provision_identity(text, text, text), app.create_workspace(text), app.add_workspace_member(uuid, uuid, workspace_member_role) TO cumulore_web;
GRANT SELECT ON users, external_identities, workspaces, workspace_members, folders, folder_closure TO cumulore_web;
GRANT INSERT, UPDATE, DELETE ON folders, folder_closure TO cumulore_web;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cumulore_worker, cumulore_break_glass;
ALTER TABLE users OWNER TO cumulore_migration;
ALTER TABLE external_identities OWNER TO cumulore_migration;
ALTER TABLE workspaces OWNER TO cumulore_migration;
ALTER TABLE workspace_members OWNER TO cumulore_migration;
ALTER TABLE folders OWNER TO cumulore_migration;
ALTER TABLE folder_closure OWNER TO cumulore_migration;
