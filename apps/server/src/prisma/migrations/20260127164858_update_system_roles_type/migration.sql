-- Update system roles
UPDATE "ProjectRole" SET "type" = 'system' WHERE "name" IN ('Administrateur', 'DevOps', 'Développer', 'Lecture seule');
UPDATE "AdminRole" SET "type" = 'system' WHERE "name" IN ('Admin', 'Admin Locaux');

-- Remove 'security' role references from ProjectMembers
UPDATE "ProjectMembers"
SET "roleIds" = array_remove("roleIds", (
  SELECT id::text FROM "ProjectRole"
  WHERE "name" = 'security'
  AND "projectId" = "ProjectMembers"."projectId"
  LIMIT 1
))
WHERE EXISTS (
  SELECT 1 FROM "ProjectRole"
  WHERE "name" = 'security'
  AND "projectId" = "ProjectMembers"."projectId"
);

-- Delete 'security' roles
DELETE FROM "ProjectRole" WHERE "name" = 'security';