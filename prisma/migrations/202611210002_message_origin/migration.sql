-- Separate historical sample messages from newly simulated sends for honest analytics.
ALTER TABLE "Message" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'live';
