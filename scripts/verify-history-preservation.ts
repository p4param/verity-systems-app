
import { prisma } from "../src/lib/prisma";
import { RevisionService } from "../src/services/dms/revision-service";
import { DocumentStatus } from "@prisma/client";
import { PermissionId } from "../src/lib/auth/permission-codes";

async function main() {
    console.log("🧪 Verifying Revision History Preservation...");

    // 1. Setup: Create Tenant, User, Folder
    const tenantCode = `history-test-${Date.now()}`;
    const tenant = await prisma.tenant.create({
        data: { code: tenantCode, name: "History Preservation Tenant" }
    });

    // Create Role & User
    const permissions = await prisma.permission.findMany({
        where: { id: { in: [PermissionId.DMS_DOCUMENT_CREATE, PermissionId.DMS_DOCUMENT_EDIT] } }
    });

    const role = await prisma.role.create({
        data: {
            name: "History Tester",
            tenantId: tenant.id,
            rolePermissions: {
                create: permissions.map(p => ({
                    permission: { connect: { id: p.id } }
                }))
            }
        }
    });

    const user = await prisma.user.create({
        data: {
            email: `history-${Date.now()}@example.com`,
            fullName: "History Tester",
            tenantId: tenant.id,
            userRoles: { create: { roleId: role.id } }
        }
    });

    const authUser = {
        id: user.id,
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles: ["History Tester"],
        roleIds: [role.id],
        permissions: permissions.map(p => p.code),
        permissionIds: permissions.map(p => p.id),
        mfaEnabled: false
    };

    const folder = await prisma.folder.create({
        data: {
            name: "History Folder",
            tenantId: tenant.id,
            createdById: user.id,
            updatedById: user.id
        }
    });

    await prisma.documentSequence.create({
        data: { tenantId: tenant.id, year: new Date().getFullYear(), current: 100 }
    });

    try {
        // 2. Create Original Document
        const originalDoc = await prisma.document.create({
            data: {
                title: "Original History Doc",
                documentNumber: `DOC-HIST-${Date.now()}`,
                status: DocumentStatus.APPROVED,
                tenantId: tenant.id,
                folderId: folder.id,
                createdById: user.id,
                updatedById: user.id
            }
        });

        // 3. Create History Records (Versions & Audit Logs)
        // Version 1
        const v1 = await prisma.documentVersion.create({
            data: {
                documentId: originalDoc.id,
                versionNumber: 1,
                fileName: "v1.pdf",
                fileSize: 1024,
                mimeType: "application/pdf",
                storageKey: "keys/v1",
                createdById: user.id,
                tenantId: tenant.id
            }
        });

        // Audit Log 1
        const audit1 = await prisma.auditLog.create({
            data: {
                tenantId: tenant.id,
                action: "DMS_DOCUMENT_CREATED",
                entityId: originalDoc.id,
                entityType: "DOCUMENT",
                actorUserId: user.id,
                details: "Document created"
            }
        });

        console.log(`📄 Created Original Doc: ${originalDoc.id}`);
        console.log(`   - Version: ${v1.id}`);
        console.log(`   - Audit: ${audit1.id}`);

        // 4. Perform Revision
        console.log("\n🔄 Revising Document...");
        const revision = await RevisionService.reviseDocument({
            documentId: originalDoc.id,
            tenantId: tenant.id,
            user: authUser as any
        });
        console.log(`   -> Revision Created: ${revision.id}`);

        // 5. Verification: Check Original History
        console.log("\n🔍 Verifying Original History...");

        const originalAfter = await prisma.document.findUnique({
            where: { id: originalDoc.id },
            include: {
                versions: true
            }
        });

        // Check Version
        if (originalAfter?.versions.length !== 1 || originalAfter.versions[0].id !== v1.id) {
            throw new Error("❌ Original version MISSING or mismatch!");
        }
        console.log("   ✅ Original Version Preserved");

        // Check Audit Log
        const auditAfter = await prisma.auditLog.findFirst({
            where: { id: audit1.id }
        });

        if (!auditAfter) {
            throw new Error("❌ Original Audit Log MISSING!");
        }
        console.log("   ✅ Original Audit Log Preserved");

        // Check Status not deleted
        if (!originalAfter) {
            throw new Error("❌ Original Document Deleted!");
        }
        console.log("   ✅ Original Document Persists");

        console.log("\n✅ HISTORY PRESERVATION VERIFIED");

    } catch (error) {
        console.error("❌ Verification Failed:", error);
        process.exit(1);
    } finally {
        // Cleanup
        // await prisma.tenant.delete({ where: { id: tenant.id } });
        await prisma.$disconnect();
    }
}

main();
