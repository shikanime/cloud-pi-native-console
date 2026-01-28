-- AlterTable
ALTER TABLE "AdminRole" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'custom';

-- AlterTable
ALTER TABLE "ProjectRole" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'custom';
