-- Phase 4 RBAC Restructure Migration
-- Add sub-role permission flags to tenant_features

ALTER TABLE tenant_features
  ADD COLUMN teacher_can_upload_videos BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN teacher_can_schedule_live BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN admin_can_manage_zoom BOOLEAN NOT NULL DEFAULT TRUE;
