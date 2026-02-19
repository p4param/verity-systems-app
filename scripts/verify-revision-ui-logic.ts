
import { PrismaClient } from "@prisma/client";
import { DocumentService } from "../src/services/dms/document-service";
import { RevisionService } from "../src/services/dms/revision-service";

const prisma = new PrismaClient();

async function main() {
    const tenantId = 1;
    const userId = 1;
    const user = {
        sub: userId,
        email: "admin@verity.com",
        tenantId,
        role: "ADMIN",
        permissions: ["DMS_DOCUMENT_CREATE", "DMS_DOCUMENT_APPROVE", "DMS_DOCUMENT_EDIT", "DMS_DOCUMENT_SUBMIT"]
    } as any;

    console.log("🚀 Starting Revision UI Logic Verification...");

    try {
        // 1. Create Doc A -> Approve
        const docA = await prisma.document.create({
            data: {
                title: "Revision UI Test v1",
                documentNumber: `REV-UI-${Date.now()}`,
                status: "APPROVED", // Shortcut to approved for test
                tenantId,
                createdById: userId,
                description: "Original"
            }
        });
        console.log(`✅ Created Doc A (Approved): ${docA.id}`);

        // 2. Create Revision (Doc B)
        const docB = await RevisionService.reviseDocument({
            documentId: docA.id,
            tenantId,
            user
        });
        console.log(`✅ Created Revision Doc B: ${docB.id} (supersedes ${docA.id})`);

        // 3. Verify getDocumentById returns supersededBy
        const docAData = await DocumentService.getDocumentById(docA.id, tenantId, user);
        console.log("🔍 Fetched Doc A Data:", JSON.stringify(docAData?.supersededBy, null, 2));

        if (!docAData?.supersededBy) {
            throw new Error("❌ DocumentService failed to return supersededBy relation!");
        }
        if (docAData.supersededBy.id !== docB.id) {
            throw new Error("❌ supersededBy ID mismatch!");
        }
        console.log("✅ DocumentService correctly returns supersededBy relation.");

        // 4. Try to revise Doc A AGAIN (Should Fail)
        console.log("🔄 Attempting to revise Doc A again (Expected Failure)...");
        try {
            await RevisionService.reviseDocument({
                documentId: docA.id,
                tenantId,
                user
            });
            throw new Error("❌ Failed to block duplicate revision!");
        } catch (error: any) {
            if (error.message.includes("already been superseded")) {
                console.log("✅ Correctly rejected duplicate revision: " + error.message);
            } else {
                throw error;
            }
        }

        console.log("\n🎉 SUCCESS: All Revision UI Logic Checks Passed!");

    } catch (error) {
        console.error("\n❌ Verification Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
