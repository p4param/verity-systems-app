
import { prisma } from "../src/lib/prisma";
import { RevisionService } from "../src/services/dms/revision-service";
import { VersionService } from "../src/services/dms/version-service";
import { AuditService } from "../src/services/dms/audit-service";
import { DocumentService } from "../src/services/dms/document-service";
import { DocumentStatus } from "@prisma/client";
import { PermissionId } from "../src/lib/auth/permission-codes";

async function main() {
    console.log("🧪 Verifying Unified History (Versions & Audit)...");

    const tenantCode = `unified-hist-${Date.now()}`;
    const tenant = await prisma.tenant.create({ data: { code: tenantCode, name: "Unified History Tenant" } });

    // Setup User & Permissions
    const permissions = await prisma.permission.findMany({
        where: { id: { in: [PermissionId.DMS_DOCUMENT_CREATE, PermissionId.DMS_DOCUMENT_READ] } }
    });
    const role = await prisma.role.create({
        data: { name: "History User", tenantId: tenant.id, rolePermissions: { create: permissions.map(p => ({ permissionId: p.id })) } }
    });
    const user = await prisma.user.create({
        data: { email: `unified-${Date.now()}@example.com`, fullName: "Unified Tester", tenantId: tenant.id, userRoles: { create: { roleId: role.id } } }
    });
    const authUser = { id: user.id, sub: user.id, email: user.email, tenantId: user.tenantId, roles: ["History User"], roleIds: [role.id], permissions: [], permissionIds: [], mfaEnabled: false };

    const folder = await prisma.folder.create({ data: { name: "Folder", tenantId: tenant.id, createdById: user.id, updatedById: user.id } });
    await prisma.documentSequence.create({ data: { tenantId: tenant.id, year: new Date().getFullYear(), current: 500 } });

    try {
        // 1. Create Original Document (Parent)
        const parentDoc = await prisma.document.create({
            data: {
                title: "Parent Doc",
                documentNumber: `DOC-PARENT-${Date.now()}`,
                status: DocumentStatus.APPROVED,
                tenantId: tenant.id,
                folderId: folder.id,
                createdById: user.id,
                updatedById: user.id
            }
        });

        // Add Version 1 to Parent
        await prisma.documentVersion.create({
            data: {
                documentId: parentDoc.id,
                versionNumber: 1,
                fileName: "parent-v1.pdf",
                fileSize: 100,
                mimeType: "application/pdf",
                storageKey: "key/p1",
                createdById: user.id,
                tenantId: tenant.id
            }
        });

        // Add Audit Log to Parent
        await prisma.auditLog.create({
            data: {
                tenantId: tenant.id,
                action: "DMS_DOCUMENT_CREATED",
                entityId: parentDoc.id,
                entityType: "DOCUMENT",
                actorUserId: user.id,
                details: "Parent Created"
            }
        });

        console.log(`📄 Parent Doc Created: ${parentDoc.id}`);

        // 2. Create Revision (Child)
        console.log("🔄 Creating Revision...");
        // Mock permission check inside revision service might fail if we don't grant permission explicitly in DB or mock hasPermission.
        // For this test, we trust the service logic or bypass if needed, but let's try calling it.
        // Note: RevisionService checks permissions via `hasPermission`. We need to ensure `authUser` has the IDs correctly.
        // Actually, let's just create the revision manually to focus on History Retrieval Logic, 
        // OR rely on the service if we are confident.
        // Let's use service to be integration-test like.
        // update authUser permissions
        authUser.permissions = permissions.map(p => p.code);

        const childDoc = await RevisionService.reviseDocument({
            documentId: parentDoc.id,
            tenantId: tenant.id,
            user: authUser as any
        });
        console.log(`📄 Child Doc Created: ${childDoc.id}`);

        // Add Version 1 to Child (Technically Version 1 of new doc, but maybe conceptually v2)
        // System resets version to 1 for new doc ID unless we logic otherwise. 
        // Let's assume standard behavior.
        await prisma.documentVersion.create({
            data: {
                documentId: childDoc.id,
                versionNumber: 1,
                fileName: "child-v1.pdf",
                fileSize: 100,
                mimeType: "application/pdf",
                storageKey: "key/c1",
                createdById: user.id,
                tenantId: tenant.id
            }
        });

        // Add Audit to Child
        await prisma.auditLog.create({
            data: {
                tenantId: tenant.id,
                action: "DMS_DOCUMENT_UPDATE",
                entityId: childDoc.id,
                entityType: "DOCUMENT",
                actorUserId: user.id,
                details: "Child Updated"
            }
        });


        // 3. Verify Unified History on Child
        console.log("\n🔍 Verifying Child History (Should include Parent)...");

        // A. Ancestors
        const ancestors = await DocumentService.getAncestorDocumentIds(childDoc.id, tenant.id);
        console.log("   Ancestors:", ancestors);
        if (!ancestors.includes(parentDoc.id)) throw new Error("❌ Ancestor List missing parent ID");

        // B. Versions
        const versions = await VersionService.listVersions(childDoc.id, tenant.id);
        console.log("   Versions Found Count:", versions.length);
        console.log("   Versions Details:", versions.map(v => ({ id: v.id, fileName: v.fileName, ver: v.versionNumber })));

        if (versions.length < 2) {
            throw new Error(`❌ Expected at least 2 versions (Parent V1 + Child V1), found ${versions.length}`);
        }
        const hasParentV1 = versions.some(v => v.fileName === "parent-v1.pdf");
        if (!hasParentV1) throw new Error("❌ Parent Version missing from Child History");
        console.log("   ✅ Unified Versions Confirmed");

        // C. Audit Logs
        const audits = await AuditService.getDocumentAuditLogs({
            tenantId: tenant.id,
            documentId: childDoc.id,
            user: authUser as any
        });
        console.log("   Audit Logs Found:", audits.total);
        // Should have Parent Create, Revision Event (on New Doc probably?), Child Update
        // Revision Create logs to New Doc ID? -> Yes, RevisionService: entityId: newDoc.id.
        // So we expect: Parent Create (ParentID), Parent Approve? (skipped), Revision (ChildID), Child Update (ChildID).
        // Unified should fetch ParentID + ChildID events.

        // Parent events: DMS_DOCUMENT_CREATED (entityId=parentDoc.id)
        const hasParentLog = audits.items.some(l => l.entityId === parentDoc.id);
        if (!hasParentLog) {
            const foundLogs = audits.items.map((i: any) => ({ action: i.action, entityId: i.entityId, entityType: i.entityType }));
            const fs = require('fs');
            fs.writeFileSync('verify_error.log', `Missing Parent Log. Found:\n${JSON.stringify(foundLogs, null, 2)}`);
            throw new Error("❌ Parent Audit Log missing from Child History");
        }

        console.log("   ✅ Unified Audit Logs Confirmed");

        console.log("\n✅ UNIFIED HISTORY VERIFIED");

    } catch (e: any) {
        console.error("❌ Test Failed.");
        if (e.message) console.error(e.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
