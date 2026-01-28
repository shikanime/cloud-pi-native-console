-- Update AdminRole system roles
UPDATE "AdminRole" SET "type" = 'system' WHERE "name" IN ('Admin', 'Admin Locaux');

-- Update ProjectRole system roles
UPDATE "ProjectRole" SET "type" = 'system' WHERE "name" IN ('Administrateur', 'DevOps', 'Développer', 'Lecture seule');
