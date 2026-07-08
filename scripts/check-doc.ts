import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDoc() {
  const doc = await prisma.document.findUnique({
    where: { id: "cmlw0ntx90002ec4islpochh9" },
    include: {
      currentVersion: true
    }
  });

  if (!doc) {
    console.log("Doc not found");
    return;
  }

  console.log("Doc details:", {
    id: doc.id,
    status: doc.status,
    contentMode: doc.currentVersion?.contentMode,
    isFrozen: doc.currentVersion?.isFrozen,
    storageKey: doc.currentVersion?.storageKey
  });
}

checkDoc().catch(console.error).finally(() => prisma.$disconnect());
