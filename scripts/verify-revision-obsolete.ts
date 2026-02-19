
import { PrismaClient } from "@prisma/client";
import { transitionDocumentStatus } from "../src/lib/dms/workflowEngine";

const prisma = new PrismaClient();

async function main() {
    const tenantId = 1; // Default seed tenant
    const userId = 1; // Default seed user (Admin)
    const user = {
        sub: userId,
        email: "admin@verity.com",
        tenantId,
        role: "ADMIN",
        permissions: ["DMS_DOCUMENT_CREATE", "DMS_DOCUMENT_APPROVE", "DMS_DOCUMENT_EDIT", "DMS_DOCUMENT_SUBMIT"]
    } as any;

    console.log("🚀 Starting Automatic Obsolete Transition Verification...");

    try {
        // 1. Create Initial Document (Doc A)
        const docA = await prisma.document.create({
            data: {
                title: "Policy v1",
                documentNumber: `POL-${Date.now()}`,
                status: "DRAFT",
                tenantId,
                createdById: userId,
                description: "Original Policy"
            }
        });
        console.log(`✅ Created Doc A (v1): ${docA.id} [${docA.status}]`);

        // 2. Approve Doc A
        await transitionDocumentStatus(prisma, docA.id, tenantId, "submit", user);
        await transitionDocumentStatus(prisma, docA.id, tenantId, "approve", user);
        console.log(`✅ Approved Doc A`);

        // 3. Create Revision (Doc B) superseding Doc A
        const docB = await prisma.document.create({
            data: {
                title: "Policy v2",
                documentNumber: `POL-${Date.now()}-v2`, // Must be unique per schema
                status: "DRAFT",
                tenantId,
                createdById: userId,
                supersedesId: docA.id, // Linked
                description: "Revised Policy"
            }
        });
        console.log(`✅ Created Doc B (v2): ${docB.id} [${docB.status}] supersedes ${docA.id}`);

        // 4. Approve Doc B (Trigger Auto-Obsolete)
        console.log("🔄 Approving Doc B...");
        await transitionDocumentStatus(prisma, docB.id, tenantId, "submit", user);
        await transitionDocumentStatus(prisma, docB.id, tenantId, "approve", user);
        console.log(`✅ Approved Doc B`);

        // 5. Verify States
        const finalDocA = await prisma.document.findUnique({ where: { id: docA.id } });
        const finalDocB = await prisma.document.findUnique({ where: { id: docB.id } });

        console.log("\n--- Verification Results ---");
        console.log(`Doc A Status: ${finalDocA?.status} (Expected: OBSOLETE)`);
        console.log(`Doc B Status: ${finalDocB?.status} (Expected: APPROVED)`);

        if (finalDocA?.status !== "OBSOLETE") {
            throw new Error("❌ Doc A was NOT auto-obsoleted!");
        }
        if (finalDocB?.status !== "APPROVED") {
            throw new Error("❌ Doc B was NOT approved!");
        }

        // 6. Verify Audit Logs
        const auditLog = await prisma.auditLog.findFirst({
            where: {
                entityId: docA.id,
                action: "DMS.DOCUMENT_OBSOLETED_AUTO"
            }
        });

        if (!auditLog) {
            throw new Error("❌ Audit Log for Auto-Obsolete NOT found!");
        }
        console.log(`✅ Audit Log Found: ${auditLog.action} for ${auditLog.entityId}`);

        console.log("\n🎉 SUCCESS: All Checks Passed!");

    } catch (error) {
        console.error("\n❌ Verification Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
