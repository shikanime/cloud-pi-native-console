-- Update system roles
UPDATE "ProjectRole" SET "type" = 'system' WHERE "name" IN ('Administrateur', 'DevOps', 'Développer', 'Lecture seule');
UPDATE "AdminRole" SET "type" = 'system' WHERE "name" IN ('Admin', 'Admin Locaux');
