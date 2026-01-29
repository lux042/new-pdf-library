-- AlterTable
ALTER TABLE "Pdf" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
