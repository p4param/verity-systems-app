import { PrismaClient } from '@prisma/client';
import { DocumentService } from '../src/services/dms/document-service';

const prisma = new PrismaClient();

async function run() {
  const doc = await prisma.document.findFirst();
  if (!doc) {
    console.log("No doc found");
    return;
  }
  
  console.log("Found doc:", doc.id);
  const mockUser = {
    sub: doc.createdById.toString(),
    email: "test@test.com",
    fullName: "Test User",
    tenantId: doc.tenantId,
    roles: [],
    permissions: ["DMS_DOCUMENT_READ"]
  };

  console.time("getDocumentById");
  await DocumentService.getDocumentById(doc.id, doc.tenantId, mockUser as any);
  console.timeEnd("getDocumentById");
  
  console.time("getDocumentById-second");
  await DocumentService.getDocumentById(doc.id, doc.tenantId, mockUser as any);
  console.timeEnd("getDocumentById-second");
}

run().catch(console.error).finally(() => prisma.$disconnect());
