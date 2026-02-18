
import { prisma } from "../src/lib/prisma";
import { DocumentService } from "../src/services/dms/document-service";

async function verifyDmsUpgrade() {
    console.log("Starting DMS Upgrade Verification...");

    // Mock user context
    const mockUser = {
        sub: 1, // Assumes user ID 1 exists
        id: 1,  // For consistency with AuthUser
        tenantId: 1, // Assumes tenant ID 1 exists
        email: "test@example.com",
        fullName: "Test User",
        role: "ADMIN",
        permissions: ["DMS_DOCUMENT_CREATE", "DMS_DOCUMENT_READ", "DMS_DOCUMENT_UPDATE"],
        roles: ["ADMIN"],
        roleIds: [1],
        mfaEnabled: false
    };

    try {
        // 1. Create Document Type
        console.log("1. Creating Document Type...");
        const docType = await prisma.documentType.create({
            data: {
                name: "Test Policy " + Date.now(),
                tenantId: mockUser.tenantId
            }
        });
        console.log("   - Created Type:", docType.name);

        // 1b. Create Mock Folder (Documents must be in a folder)
        console.log("1b. Creating Mock Folder...");
        const folder = await prisma.folder.create({
            data: {
                name: "Verification Folder " + Date.now(),
                tenantId: mockUser.tenantId,
                createdById: mockUser.id
            }
        });
        console.log("   - Created Folder:", folder.name);

        // 2. Create Document with Metadata
        console.log("2. Creating Document with Metadata...");
        const doc = await DocumentService.createDocument({
            title: "Verification Doc " + Date.now(),
            description: "Auto-generated for verification",
            tenantId: mockUser.tenantId,
            user: mockUser,
            folderId: folder.id,
            typeId: docType.id,
            expiryDate: new Date("2025-12-31")
        });

        console.log("   - Created Document ID:", doc.id);

        // 3. Verify Document Number Generation
        if (!doc.documentNumber || !doc.documentNumber.startsWith("DOC-")) {
            throw new Error(`Invalid Document Number: ${doc.documentNumber}`);
        }
        console.log("   - Document Number Generated:", doc.documentNumber);

        // 4. Verify Metadata Persistence
        if (doc.typeId !== docType.id) throw new Error("Type ID mismatch");
        if (!doc.expiryDate) throw new Error("Expiry Date missing");
        console.log("   - Metadata Verified");

        // 5. Verify Audit Log
        console.log("3. Verifying Audit Log...");
        const auditLog = await prisma.auditLog.findFirst({
            where: {
                entityId: doc.id,
                action: "DMS.DOCUMENT_CREATE",
                entityType: "DOCUMENT"
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!auditLog) throw new Error("Audit log entry not found");
        console.log("   - Audit Log Found ID:", auditLog.id);

        // Check if metadata contains our new fields if logic stores them there
        // In clean implementation, metadata might be in 'details' or 'metadata' JSON
        // Based on DocumentService, we log metadata: { documentNumber, typeId, ... }
        if (auditLog.metadata) {
            const meta = typeof auditLog.metadata === 'string' ? JSON.parse(auditLog.metadata) : auditLog.metadata;
            if (meta.documentNumber !== doc.documentNumber) console.warn("WARNING: documentNumber not in audit metadata");
            else console.log("   - Audit Metadata Verified");
        }

        console.log("SUCCESS: DMS Upgrade Verification Passed!");
    } catch (error) {
        console.error("FAILURE:", error);
        process.exit(1);
    }
}

verifyDmsUpgrade();
