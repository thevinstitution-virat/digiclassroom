--
-- PostgreSQL database dump
--

\restrict cLNvcPsyho1VfWHLmxQcld6TnD5QBjgV7iC54q2WR7FK0abAgC6XWeQYQziURlO

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: content; Type: SCHEMA; Schema: -; Owner: content_app
--

CREATE SCHEMA content;


ALTER SCHEMA content OWNER TO content_app;

--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: identity_app
--

CREATE SCHEMA identity;


ALTER SCHEMA identity OWNER TO identity_app;

--
-- Name: notes; Type: SCHEMA; Schema: -; Owner: content_app
--

CREATE SCHEMA notes;


ALTER SCHEMA notes OWNER TO content_app;

--
-- Name: taxonomy; Type: SCHEMA; Schema: -; Owner: taxonomy_app
--

CREATE SCHEMA taxonomy;


ALTER SCHEMA taxonomy OWNER TO taxonomy_app;

--
-- Name: TaxonomyApp; Type: TYPE; Schema: taxonomy; Owner: taxonomy_app
--

CREATE TYPE taxonomy."TaxonomyApp" AS ENUM (
    'pdlms',
    'digiclassroom'
);


ALTER TYPE taxonomy."TaxonomyApp" OWNER TO taxonomy_app;

--
-- Name: TaxonomyDomain; Type: TYPE; Schema: taxonomy; Owner: taxonomy_app
--

CREATE TYPE taxonomy."TaxonomyDomain" AS ENUM (
    'school',
    'college',
    'competitive',
    'entrance',
    'misc'
);


ALTER TYPE taxonomy."TaxonomyDomain" OWNER TO taxonomy_app;

--
-- Name: TaxonomyNodeType; Type: TYPE; Schema: taxonomy; Owner: taxonomy_app
--

CREATE TYPE taxonomy."TaxonomyNodeType" AS ENUM (
    'board',
    'state',
    'medium',
    'class',
    'subject',
    'degree',
    'regulatory_body',
    'year_semester',
    'paper',
    'sector',
    'exam_competitive',
    'subject_paper',
    'target_stage',
    'exam_entrance',
    'tag'
);


ALTER TYPE taxonomy."TaxonomyNodeType" OWNER TO taxonomy_app;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: content_asset; Type: TABLE; Schema: content; Owner: content_app
--

CREATE TABLE content.content_asset (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_item_id uuid NOT NULL,
    kind text NOT NULL,
    storage_account text NOT NULL,
    storage_uri text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_asset_storage_account_check CHECK ((storage_account = ANY (ARRAY['digiclassroom-pro'::text, 'vidyaverse'::text])))
);


ALTER TABLE content.content_asset OWNER TO content_app;

--
-- Name: content_chunk; Type: TABLE; Schema: content; Owner: content_app
--

CREATE TABLE content.content_chunk (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_item_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    page_start integer,
    page_end integer,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    chapter text
);


ALTER TABLE content.content_chunk OWNER TO content_app;

--
-- Name: content_grant; Type: TABLE; Schema: content; Owner: content_app
--

CREATE TABLE content.content_grant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_item_id uuid NOT NULL,
    org_id uuid,
    principal_id uuid,
    visibility text DEFAULT 'private'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_grant_check CHECK (((visibility = 'public'::text) OR (org_id IS NOT NULL) OR (principal_id IS NOT NULL))),
    CONSTRAINT content_grant_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'org'::text, 'private'::text])))
);


ALTER TABLE content.content_grant OWNER TO content_app;

--
-- Name: content_item; Type: TABLE; Schema: content; Owner: content_app
--

CREATE TABLE content.content_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    kind text DEFAULT 'book'::text NOT NULL,
    lang text,
    uploaded_by_principal_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE content.content_item OWNER TO content_app;

--
-- Name: content_source_ref; Type: TABLE; Schema: content; Owner: content_app
--

CREATE TABLE content.content_source_ref (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_item_id uuid NOT NULL,
    app text NOT NULL,
    local_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_source_ref_app_check CHECK ((app = ANY (ARRAY['pdlms'::text, 'vidyaverse'::text, 'digiclassroom'::text])))
);


ALTER TABLE content.content_source_ref OWNER TO content_app;

--
-- Name: ingest_run; Type: TABLE; Schema: content; Owner: content_app
--

CREATE TABLE content.ingest_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_item_id uuid NOT NULL,
    source_app text NOT NULL,
    embedding_model text NOT NULL,
    embedding_dim integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    chunk_count integer,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingest_run_source_app_check CHECK ((source_app = ANY (ARRAY['pdlms'::text, 'vidyaverse'::text, 'digiclassroom'::text]))),
    CONSTRAINT ingest_run_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE content.ingest_run OWNER TO content_app;

--
-- Name: org; Type: TABLE; Schema: identity; Owner: identity_app
--

CREATE TABLE identity.org (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE identity.org OWNER TO identity_app;

--
-- Name: org_app_ref; Type: TABLE; Schema: identity; Owner: identity_app
--

CREATE TABLE identity.org_app_ref (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    app text NOT NULL,
    local_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_app_ref_app_check CHECK ((app = ANY (ARRAY['pdlms'::text, 'vidyaverse'::text, 'digiclassroom'::text])))
);


ALTER TABLE identity.org_app_ref OWNER TO identity_app;

--
-- Name: org_curriculum_scope; Type: TABLE; Schema: identity; Owner: identity_app
--

CREATE TABLE identity.org_curriculum_scope (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    taxonomy_node_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE identity.org_curriculum_scope OWNER TO identity_app;

--
-- Name: principal; Type: TABLE; Schema: identity; Owner: identity_app
--

CREATE TABLE identity.principal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    oidc_sub text NOT NULL,
    email public.citext NOT NULL,
    display_name text,
    platform_role text DEFAULT 'student'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE identity.principal OWNER TO identity_app;

--
-- Name: note; Type: TABLE; Schema: notes; Owner: content_app
--

CREATE TABLE notes.note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    principal_id uuid NOT NULL,
    content_item_id uuid,
    source_type text NOT NULL,
    title text,
    body_text text NOT NULL,
    taxonomy_node_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT note_source_type_check CHECK ((source_type = ANY (ARRAY['varta'::text, 'reader_selection'::text, 'ai_tutor'::text])))
);


ALTER TABLE notes.note OWNER TO content_app;

--
-- Name: content_taxonomy_link; Type: TABLE; Schema: taxonomy; Owner: taxonomy_app
--

CREATE TABLE taxonomy.content_taxonomy_link (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_item_id uuid NOT NULL,
    node_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE taxonomy.content_taxonomy_link OWNER TO taxonomy_app;

--
-- Name: taxonomy_nodes; Type: TABLE; Schema: taxonomy; Owner: taxonomy_app
--

CREATE TABLE taxonomy.taxonomy_nodes (
    id uuid NOT NULL,
    domain taxonomy."TaxonomyDomain" NOT NULL,
    node_type taxonomy."TaxonomyNodeType" NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    parent_id uuid,
    ancestor_ids uuid[],
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE taxonomy.taxonomy_nodes OWNER TO taxonomy_app;

--
-- Name: content_asset content_asset_pkey; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_asset
    ADD CONSTRAINT content_asset_pkey PRIMARY KEY (id);


--
-- Name: content_chunk content_chunk_content_item_id_chunk_index_key; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_chunk
    ADD CONSTRAINT content_chunk_content_item_id_chunk_index_key UNIQUE (content_item_id, chunk_index);


--
-- Name: content_chunk content_chunk_pkey; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_chunk
    ADD CONSTRAINT content_chunk_pkey PRIMARY KEY (id);


--
-- Name: content_grant content_grant_pkey; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_grant
    ADD CONSTRAINT content_grant_pkey PRIMARY KEY (id);


--
-- Name: content_item content_item_pkey; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_item
    ADD CONSTRAINT content_item_pkey PRIMARY KEY (id);


--
-- Name: content_source_ref content_source_ref_app_local_id_key; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_source_ref
    ADD CONSTRAINT content_source_ref_app_local_id_key UNIQUE (app, local_id);


--
-- Name: content_source_ref content_source_ref_pkey; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_source_ref
    ADD CONSTRAINT content_source_ref_pkey PRIMARY KEY (id);


--
-- Name: ingest_run ingest_run_pkey; Type: CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.ingest_run
    ADD CONSTRAINT ingest_run_pkey PRIMARY KEY (id);


--
-- Name: org_app_ref org_app_ref_app_local_id_key; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_app_ref
    ADD CONSTRAINT org_app_ref_app_local_id_key UNIQUE (app, local_id);


--
-- Name: org_app_ref org_app_ref_org_id_app_key; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_app_ref
    ADD CONSTRAINT org_app_ref_org_id_app_key UNIQUE (org_id, app);


--
-- Name: org_app_ref org_app_ref_pkey; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_app_ref
    ADD CONSTRAINT org_app_ref_pkey PRIMARY KEY (id);


--
-- Name: org_curriculum_scope org_curriculum_scope_org_id_taxonomy_node_id_key; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_curriculum_scope
    ADD CONSTRAINT org_curriculum_scope_org_id_taxonomy_node_id_key UNIQUE (org_id, taxonomy_node_id);


--
-- Name: org_curriculum_scope org_curriculum_scope_pkey; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_curriculum_scope
    ADD CONSTRAINT org_curriculum_scope_pkey PRIMARY KEY (id);


--
-- Name: org org_pkey; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org
    ADD CONSTRAINT org_pkey PRIMARY KEY (id);


--
-- Name: org org_slug_key; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org
    ADD CONSTRAINT org_slug_key UNIQUE (slug);


--
-- Name: principal principal_oidc_sub_key; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.principal
    ADD CONSTRAINT principal_oidc_sub_key UNIQUE (oidc_sub);


--
-- Name: principal principal_pkey; Type: CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.principal
    ADD CONSTRAINT principal_pkey PRIMARY KEY (id);


--
-- Name: note note_pkey; Type: CONSTRAINT; Schema: notes; Owner: content_app
--

ALTER TABLE ONLY notes.note
    ADD CONSTRAINT note_pkey PRIMARY KEY (id);


--
-- Name: content_taxonomy_link content_taxonomy_link_content_item_id_node_id_key; Type: CONSTRAINT; Schema: taxonomy; Owner: taxonomy_app
--

ALTER TABLE ONLY taxonomy.content_taxonomy_link
    ADD CONSTRAINT content_taxonomy_link_content_item_id_node_id_key UNIQUE (content_item_id, node_id);


--
-- Name: content_taxonomy_link content_taxonomy_link_pkey; Type: CONSTRAINT; Schema: taxonomy; Owner: taxonomy_app
--

ALTER TABLE ONLY taxonomy.content_taxonomy_link
    ADD CONSTRAINT content_taxonomy_link_pkey PRIMARY KEY (id);


--
-- Name: taxonomy_nodes taxonomy_nodes_pkey; Type: CONSTRAINT; Schema: taxonomy; Owner: taxonomy_app
--

ALTER TABLE ONLY taxonomy.taxonomy_nodes
    ADD CONSTRAINT taxonomy_nodes_pkey PRIMARY KEY (id);


--
-- Name: content_asset_item_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX content_asset_item_idx ON content.content_asset USING btree (content_item_id);


--
-- Name: content_chunk_item_chapter_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX content_chunk_item_chapter_idx ON content.content_chunk USING btree (content_item_id, chapter);


--
-- Name: content_chunk_item_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX content_chunk_item_idx ON content.content_chunk USING btree (content_item_id);


--
-- Name: content_grant_item_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX content_grant_item_idx ON content.content_grant USING btree (content_item_id);


--
-- Name: content_grant_org_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX content_grant_org_idx ON content.content_grant USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: content_grant_principal_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX content_grant_principal_idx ON content.content_grant USING btree (principal_id) WHERE (principal_id IS NOT NULL);


--
-- Name: content_source_ref_item_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX content_source_ref_item_idx ON content.content_source_ref USING btree (content_item_id);


--
-- Name: ingest_run_item_idx; Type: INDEX; Schema: content; Owner: content_app
--

CREATE INDEX ingest_run_item_idx ON content.ingest_run USING btree (content_item_id);


--
-- Name: org_curriculum_scope_org_idx; Type: INDEX; Schema: identity; Owner: identity_app
--

CREATE INDEX org_curriculum_scope_org_idx ON identity.org_curriculum_scope USING btree (org_id);


--
-- Name: principal_email_idx; Type: INDEX; Schema: identity; Owner: identity_app
--

CREATE UNIQUE INDEX principal_email_idx ON identity.principal USING btree (email);


--
-- Name: notes_note_content_item_idx; Type: INDEX; Schema: notes; Owner: content_app
--

CREATE INDEX notes_note_content_item_idx ON notes.note USING btree (content_item_id) WHERE (content_item_id IS NOT NULL);


--
-- Name: notes_note_fts_idx; Type: INDEX; Schema: notes; Owner: content_app
--

CREATE INDEX notes_note_fts_idx ON notes.note USING gin (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || body_text)));


--
-- Name: notes_note_principal_idx; Type: INDEX; Schema: notes; Owner: content_app
--

CREATE INDEX notes_note_principal_idx ON notes.note USING btree (principal_id);


--
-- Name: content_taxonomy_link_node_idx; Type: INDEX; Schema: taxonomy; Owner: taxonomy_app
--

CREATE INDEX content_taxonomy_link_node_idx ON taxonomy.content_taxonomy_link USING btree (node_id);


--
-- Name: taxonomy_nodes_domain_node_type_idx; Type: INDEX; Schema: taxonomy; Owner: taxonomy_app
--

CREATE INDEX taxonomy_nodes_domain_node_type_idx ON taxonomy.taxonomy_nodes USING btree (domain, node_type);


--
-- Name: taxonomy_nodes_domain_slug_parent_id_key; Type: INDEX; Schema: taxonomy; Owner: taxonomy_app
--

CREATE UNIQUE INDEX taxonomy_nodes_domain_slug_parent_id_key ON taxonomy.taxonomy_nodes USING btree (domain, slug, parent_id);


--
-- Name: taxonomy_nodes_parent_id_idx; Type: INDEX; Schema: taxonomy; Owner: taxonomy_app
--

CREATE INDEX taxonomy_nodes_parent_id_idx ON taxonomy.taxonomy_nodes USING btree (parent_id);


--
-- Name: taxonomy_nodes_parent_id_slug_key; Type: INDEX; Schema: taxonomy; Owner: taxonomy_app
--

CREATE UNIQUE INDEX taxonomy_nodes_parent_id_slug_key ON taxonomy.taxonomy_nodes USING btree (parent_id, slug);


--
-- Name: content_asset content_asset_content_item_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_asset
    ADD CONSTRAINT content_asset_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content.content_item(id) ON DELETE CASCADE;


--
-- Name: content_chunk content_chunk_content_item_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_chunk
    ADD CONSTRAINT content_chunk_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content.content_item(id) ON DELETE CASCADE;


--
-- Name: content_grant content_grant_content_item_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_grant
    ADD CONSTRAINT content_grant_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content.content_item(id) ON DELETE CASCADE;


--
-- Name: content_grant content_grant_org_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_grant
    ADD CONSTRAINT content_grant_org_id_fkey FOREIGN KEY (org_id) REFERENCES identity.org(id) ON DELETE CASCADE;


--
-- Name: content_grant content_grant_principal_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_grant
    ADD CONSTRAINT content_grant_principal_id_fkey FOREIGN KEY (principal_id) REFERENCES identity.principal(id) ON DELETE CASCADE;


--
-- Name: content_item content_item_uploaded_by_principal_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_item
    ADD CONSTRAINT content_item_uploaded_by_principal_id_fkey FOREIGN KEY (uploaded_by_principal_id) REFERENCES identity.principal(id);


--
-- Name: content_source_ref content_source_ref_content_item_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.content_source_ref
    ADD CONSTRAINT content_source_ref_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content.content_item(id) ON DELETE CASCADE;


--
-- Name: ingest_run ingest_run_content_item_id_fkey; Type: FK CONSTRAINT; Schema: content; Owner: content_app
--

ALTER TABLE ONLY content.ingest_run
    ADD CONSTRAINT ingest_run_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content.content_item(id) ON DELETE CASCADE;


--
-- Name: org_app_ref org_app_ref_org_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_app_ref
    ADD CONSTRAINT org_app_ref_org_id_fkey FOREIGN KEY (org_id) REFERENCES identity.org(id) ON DELETE CASCADE;


--
-- Name: org_curriculum_scope org_curriculum_scope_created_by_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_curriculum_scope
    ADD CONSTRAINT org_curriculum_scope_created_by_fkey FOREIGN KEY (created_by) REFERENCES identity.principal(id);


--
-- Name: org_curriculum_scope org_curriculum_scope_org_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_curriculum_scope
    ADD CONSTRAINT org_curriculum_scope_org_id_fkey FOREIGN KEY (org_id) REFERENCES identity.org(id) ON DELETE CASCADE;


--
-- Name: org_curriculum_scope org_curriculum_scope_taxonomy_node_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: identity_app
--

ALTER TABLE ONLY identity.org_curriculum_scope
    ADD CONSTRAINT org_curriculum_scope_taxonomy_node_id_fkey FOREIGN KEY (taxonomy_node_id) REFERENCES taxonomy.taxonomy_nodes(id) ON DELETE CASCADE;


--
-- Name: note note_content_item_id_fkey; Type: FK CONSTRAINT; Schema: notes; Owner: content_app
--

ALTER TABLE ONLY notes.note
    ADD CONSTRAINT note_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content.content_item(id) ON DELETE SET NULL;


--
-- Name: note note_principal_id_fkey; Type: FK CONSTRAINT; Schema: notes; Owner: content_app
--

ALTER TABLE ONLY notes.note
    ADD CONSTRAINT note_principal_id_fkey FOREIGN KEY (principal_id) REFERENCES identity.principal(id) ON DELETE CASCADE;


--
-- Name: content_taxonomy_link content_taxonomy_link_content_item_id_fkey; Type: FK CONSTRAINT; Schema: taxonomy; Owner: taxonomy_app
--

ALTER TABLE ONLY taxonomy.content_taxonomy_link
    ADD CONSTRAINT content_taxonomy_link_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content.content_item(id) ON DELETE CASCADE;


--
-- Name: content_taxonomy_link content_taxonomy_link_node_id_fkey; Type: FK CONSTRAINT; Schema: taxonomy; Owner: taxonomy_app
--

ALTER TABLE ONLY taxonomy.content_taxonomy_link
    ADD CONSTRAINT content_taxonomy_link_node_id_fkey FOREIGN KEY (node_id) REFERENCES taxonomy.taxonomy_nodes(id) ON DELETE CASCADE;


--
-- Name: taxonomy_nodes taxonomy_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: taxonomy; Owner: taxonomy_app
--

ALTER TABLE ONLY taxonomy.taxonomy_nodes
    ADD CONSTRAINT taxonomy_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES taxonomy.taxonomy_nodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA content; Type: ACL; Schema: -; Owner: content_app
--

GRANT USAGE ON SCHEMA content TO pdlms_content_reader;


--
-- Name: SCHEMA identity; Type: ACL; Schema: -; Owner: identity_app
--

GRANT USAGE ON SCHEMA identity TO content_app;
GRANT USAGE ON SCHEMA identity TO vidyaverse_app;


--
-- Name: SCHEMA taxonomy; Type: ACL; Schema: -; Owner: taxonomy_app
--

GRANT USAGE ON SCHEMA taxonomy TO content_app;
GRANT USAGE ON SCHEMA taxonomy TO identity_app;
GRANT USAGE ON SCHEMA taxonomy TO vidyaverse_app;


--
-- Name: TABLE content_chunk; Type: ACL; Schema: content; Owner: content_app
--

GRANT SELECT ON TABLE content.content_chunk TO pdlms_content_reader;


--
-- Name: TABLE content_grant; Type: ACL; Schema: content; Owner: content_app
--

GRANT SELECT ON TABLE content.content_grant TO pdlms_content_reader;


--
-- Name: TABLE content_item; Type: ACL; Schema: content; Owner: content_app
--

GRANT SELECT ON TABLE content.content_item TO pdlms_content_reader;


--
-- Name: TABLE content_source_ref; Type: ACL; Schema: content; Owner: content_app
--

GRANT SELECT ON TABLE content.content_source_ref TO pdlms_content_reader;


--
-- Name: TABLE org; Type: ACL; Schema: identity; Owner: identity_app
--

GRANT SELECT ON TABLE identity.org TO content_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE identity.org TO vidyaverse_app;


--
-- Name: TABLE org_app_ref; Type: ACL; Schema: identity; Owner: identity_app
--

GRANT SELECT ON TABLE identity.org_app_ref TO content_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE identity.org_app_ref TO vidyaverse_app;


--
-- Name: TABLE org_curriculum_scope; Type: ACL; Schema: identity; Owner: identity_app
--

GRANT SELECT ON TABLE identity.org_curriculum_scope TO content_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE identity.org_curriculum_scope TO vidyaverse_app;


--
-- Name: TABLE principal; Type: ACL; Schema: identity; Owner: identity_app
--

GRANT SELECT ON TABLE identity.principal TO content_app;


--
-- Name: TABLE content_taxonomy_link; Type: ACL; Schema: taxonomy; Owner: taxonomy_app
--

GRANT SELECT ON TABLE taxonomy.content_taxonomy_link TO content_app;
GRANT SELECT ON TABLE taxonomy.content_taxonomy_link TO identity_app;
GRANT SELECT ON TABLE taxonomy.content_taxonomy_link TO vidyaverse_app;


--
-- Name: TABLE taxonomy_nodes; Type: ACL; Schema: taxonomy; Owner: taxonomy_app
--

GRANT SELECT ON TABLE taxonomy.taxonomy_nodes TO content_app;
GRANT SELECT ON TABLE taxonomy.taxonomy_nodes TO identity_app;
GRANT SELECT ON TABLE taxonomy.taxonomy_nodes TO vidyaverse_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: content; Owner: content_app
--

ALTER DEFAULT PRIVILEGES FOR ROLE content_app IN SCHEMA content GRANT SELECT ON TABLES TO pdlms_content_reader;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: content; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA content GRANT ALL ON TABLES TO content_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: identity; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA identity GRANT ALL ON TABLES TO identity_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA identity GRANT SELECT ON TABLES TO content_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: notes; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA notes GRANT ALL ON TABLES TO content_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: taxonomy; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA taxonomy GRANT SELECT ON TABLES TO content_app;


--
-- PostgreSQL database dump complete
--

\unrestrict cLNvcPsyho1VfWHLmxQcld6TnD5QBjgV7iC54q2WR7FK0abAgC6XWeQYQziURlO

