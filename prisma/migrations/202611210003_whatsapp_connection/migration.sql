CREATE TABLE "WhatsAppConnection" (
  "retailerId" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "startedAt" DATETIME,
  "connectedAt" DATETIME,
  "syncedAt" DATETIME,
  "contactsSynced" INTEGER NOT NULL DEFAULT 0,
  "historiesSynced" INTEGER NOT NULL DEFAULT 0,
  "importedContacts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WhatsAppConnection_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
