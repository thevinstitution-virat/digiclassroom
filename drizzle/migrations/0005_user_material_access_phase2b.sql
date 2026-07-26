ALTER TABLE `user_material_access`
  MODIFY COLUMN `user_id` VARCHAR(255) NULL;

ALTER TABLE `user_material_access`
  ADD COLUMN `material_id` VARCHAR(36) NULL
    COMMENT 'The specific material that was accessed. NULL = legacy search-log row.',
  ADD COLUMN `access_count` INT NOT NULL DEFAULT 1
    COMMENT 'Incremented on each subsequent access via onDuplicateKeyUpdate.',
  ADD CONSTRAINT `fk_uma_material`
    FOREIGN KEY (`material_id`)
    REFERENCES `materials` (`id`)
    ON DELETE CASCADE;

ALTER TABLE `user_material_access`
  ADD UNIQUE KEY `uq_uma_user_material` (`user_id`, `material_id`);

ALTER TABLE `user_material_access`
  ADD INDEX `idx_uma_org_user` (`organization_id`, `user_id`),
  ADD INDEX `idx_uma_material` (`material_id`);
