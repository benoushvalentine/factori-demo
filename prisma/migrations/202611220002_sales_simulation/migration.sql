ALTER TABLE "Draft" ADD COLUMN "salesSimulationStatus" TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE "Draft" ADD COLUMN "salesSimulationTurn" INTEGER NOT NULL DEFAULT 0;
