import { PrismaClient } from "@prisma/client";
import { DocumentService } from "../src/services/dms/document-service";
import { RevisionService } from "../src/services/dms/revision-service";
import { transitionDocumentStatus } from "../src/lib/dms/workflowEngine";
import { TRANSITION_MATRIX } from "../src/lib/dms/transition-matrix";

const MOCK_USER = {
    sub: 12345,
    id: 12345,
    email: "test-admin@verity.system",
    fullName: "Test Admin",
    roles: ["ADMIN"],
    permissions: ["DMS_DOCUMENT_CREATE", "DMS_DOCUMENT_APPROVE", "DMS_DOCUMENT_OBSOLETE", "DMS_DOCUMENT_READ", "DMS_DOCUMENT_WRITE"],
    tenantId: 1,
    roleIds: [1],
    mfaEnabled: false
};

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting Manual Obsolete Verification...");
    const tenantId = 1;

    try {
        // 0. Setup: Create Test User
        console.log("\n--- Step 0: Create Test User ---");
        const uniqueEmail = `test-obs-manual-${Date.now()}@verity.system`;
        const newUser = await prisma.user.create({
            data: {
                email: uniqueEmail,
                fullName: "Test Obsolete Manual",
                tenantId,
                passwordHash: "hashes",
                mfaEnabled: false
            }
        });

        MOCK_USER.id = newUser.id;
        MOCK_USER.sub = newUser.id;
        MOCK_USER.email = newUser.email;
        MOCK_USER.fullName = newUser.fullName;

        console.log(`✅ Created User: ${newUser.id} (${newUser.email})`);

        // 0. Setup: Get Real User
        // const realUser = await prisma.user.findFirst();
        // if (!realUser) throw new Error("No users found in DB. Please seed data.");

        // MOCK_USER.id = realUser.id;
        // MOCK_USER.sub = realUser.id;
        // MOCK_USER.email = realUser.email;
        // MOCK_USER.fullName = realUser.fullName;

        // 0. Setup: Create a Folder
        console.log("\n--- Step 0: Create Test Folder ---");
        const folder = await prisma.folder.create({
            data: {
                name: "Obsolete Test Folder",
                tenantId,
                createdById: MOCK_USER.sub,
                updatedById: MOCK_USER.sub
            }
        });
        console.log(`✅ Created Folder: ${folder.name} (${folder.id})`);

        // 1. Setup: Create a clean APPROVED document (Doc A)
        console.log("\n--- Step 1: Create & Approve Document A (Baseline) ---");

        const docA = await DocumentService.createDocument({
            title: "Manual Obsolete Test Doc",
            typeId: "PROCEDURE",
            folderId: folder.id,
            tenantId,
            user: MOCK_USER
        });
        console.log(`✅ Created Doc A: ${docA.documentNumber} (${docA.id})`);

        await prisma.document.update({
            where: { id: docA.id },
            data: { status: "SUBMITTED" } // Cheat to skip submit step
        });

        console.log("Calling transitionDocumentStatus...");

        await transitionDocumentStatus(
            prisma,
            docA.id,
            tenantId,
            "approve",
            MOCK_USER,
            "Approving for test"
        );
        console.log(`✅ Approved Doc A`);


        // 2. TC-OBS-001: Positive Case - Obsolete an APPROVED document (No Revision)
        console.log("\n--- Step 2: TC-OBS-001 Obsolete APPROVED Document (Positive) ---");
        const docB = await DocumentService.createDocument({
            title: "To Be Obsoleted",
            typeId: "PROCEDURE",
            folderId: folder.id,
            tenantId,
            user: MOCK_USER
        });
        await prisma.document.update({ where: { id: docB.id }, data: { status: "SUBMITTED" } });
        await transitionDocumentStatus(prisma, docB.id, tenantId, "approve", MOCK_USER);

        const obsoleteB = await transitionDocumentStatus(
            prisma,
            docB.id,
            tenantId,
            "obsolete",
            MOCK_USER
        );

        if (obsoleteB.status === "OBSOLETE") {
            console.log("✅ TC-OBS-001 Passed: Document B is now OBSOLETE.");
        } else {
            throw new Error(`❌ TC-OBS-001 Failed: Status is ${obsoleteB.status}`);
        }

        // 3. TC-OBS-002: Negative Case - Obsolete a SUPERSEDED document
        console.log("\n--- Step 3: TC-OBS-002 Obsolete SUPERSEDED Document (Negative) ---");

        const docAv2 = await RevisionService.reviseDocument({
            documentId: docA.id,
            tenantId,
            user: MOCK_USER
        });
        console.log(`✅ Created Revision Doc A v2: ${docAv2.documentNumber}`);

        const docA_refetched = await DocumentService.getDocumentById(docA.id, tenantId, MOCK_USER);
        if (!docA_refetched?.supersededBy) {
            throw new Error("❌ Setup Failed: Doc A should have supersededBy set.");
        }

        try {
            await transitionDocumentStatus(
                prisma,
                docA.id,
                tenantId,
                "obsolete",
                MOCK_USER
            );
            console.error("❌ TC-OBS-002 Failed: Should have thrown error, but succeeded!");
            process.exit(1);
        } catch (error: any) {
            console.log(`Error message received: ${error.message}`);
            if (error.message.includes("supersended") || error.message.includes("superseded")) {
                console.log("✅ TC-OBS-002 Passed: Blocked obsoletion of superseded document.");
            } else {
                console.error(`❌ TC-OBS-002 Failed with unexpected error: ${error.message}`);
                throw error;
            }
        }

        // 4. TC-OBS-003: Negative Case - Obsolete DRAFT
        console.log("\n--- Step 4: TC-OBS-003 Obsolete DRAFT Document (Negative) ---");
        try {
            await transitionDocumentStatus(
                prisma,
                docAv2.id,
                tenantId,
                "obsolete",
                MOCK_USER
            );
            console.error("❌ TC-OBS-003 Failed: Should not obsolete DRAFT.");
            process.exit(1);
        } catch (error: any) {
            console.log(`✅ TC-OBS-003 Passed: Caught expected error: ${error.message}`);
        }

        console.log("\n🎉 ALL VERIFICATION TESTS PASSED!");

    } catch (err: any) {
        console.error("\n❌ TEST FAILED:", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
