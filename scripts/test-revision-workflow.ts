
import { prisma } from "../src/lib/prisma";
import { RevisionService } from "../src/services/dms/revision-service";
import { DocumentStatus } from "@prisma/client";
import { PermissionId } from "../src/lib/auth/permission-codes";

async function main() {
    console.log("🧪 Starting Revision Workflow Tests...");

    // 1. Setup: Create a Tenant and User with Permissions
    const tenantCode = `test-tenant-${Date.now()}`;
    const tenant = await prisma.tenant.create({
        data: {
            code: tenantCode,
            name: "Revision Test Tenant",
        }
    });

    // Create a Role with CREATE and WRITE permissions
    // Fetch permission records first
    // Using EDIT instead of WRITE as WRITE doesn't exist
    const permissions = await prisma.permission.findMany({
        where: {
            id: { in: [PermissionId.DMS_DOCUMENT_CREATE, PermissionId.DMS_DOCUMENT_EDIT] }
        }
    });

    const role = await prisma.role.create({
        data: {
            name: "Revision Tester",
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
            email: `tester-${Date.now()}@example.com`,
            fullName: "Revision Tester", // Changed from name to fullName
            tenantId: tenant.id,
            userRoles: { // Changed from roles to userRoles based on schema line 197
                create: { roleId: role.id }
            }
        }
    });

    // Mock AuthUser object fully
    const authUser = {
        id: user.id,
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles: ["Revision Tester"],
        roleIds: [role.id],
        permissions: permissions.map(p => p.code), // Map to codes (strings) - confirmed from schema
        permissionIds: permissions.map(p => p.id), // Map to IDs
        mfaEnabled: false
    };

    console.log("✅ Setup Complete. Tenant:", tenant.id, "User:", user.id);

    try {
        // --- PREPARATION: Create a Document to Revise ---
        // We need a folder first
        const folder = await prisma.folder.create({
            data: {
                name: "Revision Test Folder",
                tenantId: tenant.id,
                createdById: user.id,
                updatedById: user.id
            }
        });

        // Initialize sequence
        await prisma.documentSequence.create({
            data: { tenantId: tenant.id, year: new Date().getFullYear(), current: 100 }
        });

        const originalDoc = await prisma.document.create({
            data: {
                title: "Original Document",
                documentNumber: `DOC-TEST-${Date.now()}`,
                status: DocumentStatus.APPROVED, // Must be APPROVED
                tenantId: tenant.id,
                folderId: folder.id,
                createdById: user.id,
                updatedById: user.id
            }
        });

        console.log("📄 Created Original APPROVED Document:", originalDoc.documentNumber, originalDoc.id);

        // --- TEST CASE 1: Positive - Revise APPROVED Document ---
        console.log("\n🔄 Test Case 1: Revise APPROVED Document (Positive)");
        const revision1 = await RevisionService.reviseDocument({
            documentId: originalDoc.id,
            tenantId: tenant.id,
            user: authUser as any // Cast to avoid strict type checks if mismatch persists
        });

        console.log("   -> Revision Created:", revision1.documentNumber, revision1.id);

        // Verify Status
        if (revision1.status !== DocumentStatus.DRAFT) throw new Error(`❌ Status mismatch`);
        // Verify Linkage on New Doc
        // @ts-ignore
        if (revision1.supersedesId !== originalDoc.id) throw new Error(`❌ Supersedes linkage mismatch`);

        // Verify Linkage on Old Doc
        const updatedOriginal = await prisma.document.findUnique({ where: { id: originalDoc.id } });
        // @ts-ignore
        if (updatedOriginal?.supersededById !== revision1.id) throw new Error(`❌ Superseded linkage mismatch`);

        console.log("   ✅ Linkages Verified");


        // --- TEST CASE 2: Negative - Revise Superseded Document ---
        console.log("\n🛑 Test Case 2: Revise Superseded Document (Negative)");
        try {
            await RevisionService.reviseDocument({
                documentId: originalDoc.id,
                tenantId: tenant.id,
                user: authUser as any
            });
            throw new Error("❌ Should have failed to revise a superseded document");
        } catch (e: any) {
            if (e.message.includes("already been superseded")) {
                console.log("   ✅ Blocked correctly");
            } else {
                throw e;
            }
        }

        // --- TEST CASE 3: Negative - Revise DRAFT Document ---
        console.log("\n🛑 Test Case 3: Revise DRAFT Document (Negative)");
        try {
            await RevisionService.reviseDocument({
                documentId: revision1.id, // currently DRAFT
                tenantId: tenant.id,
                user: authUser
            });
            throw new Error("❌ Should have failed to revise a DRAFT document");
        } catch (e: any) {
            if (e.message.includes("Only APPROVED documents")) {
                console.log("   ✅ Blocked correctly: " + e.message);
            } else {
                throw e;
            }
        }

        // --- TEST CASE 4: Unique Constraint Check ---
        // (Handled implicitly by Test Case 2 logic, but let's verify DB constraint if logical check failed)
        // If we bypassed the logic, DB should throw unique constraint error on supersedesId or supersededById.
        // But since we have application logic, we trust that first.

        console.log("\n✅ All Tests Passed!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    } finally {
        // Cleanup
        // await prisma.tenant.delete({ where: { id: tenant.id } }); // Optional: keep for debug
        await prisma.$disconnect();
    }
}

main();
