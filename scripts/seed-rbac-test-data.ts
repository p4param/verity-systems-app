import { PrismaClient, DocumentStatus, FolderPermissionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧪 Seeding RBAC Test Data...');

    const tenant = await prisma.tenant.findFirst();
    const adminUser = await prisma.user.findFirst({ where: { email: 'dms.admin@example.com' } });
    const managerRole = await prisma.role.findFirst({ where: { name: 'DMS Manager', tenantId: tenant?.id } });
    const contributorRole = await prisma.role.findFirst({ where: { name: 'DMS Contributor', tenantId: tenant?.id } });
    const viewerRole = await prisma.role.findFirst({ where: { name: 'DMS Viewer', tenantId: tenant?.id } });

    if (!tenant || !adminUser || !managerRole || !contributorRole || !viewerRole) {
        console.error('❌ Missing base data (Tenant, User, or Roles). Run seed-dms-users.ts first.');
        process.exit(1);
    }

    const tenantId = tenant.id;
    const userId = adminUser.id; // Admin creates the test data

    // 1. Create Root Test Folder
    const rootFn = async () => {
        const existing = await prisma.folder.findFirst({ where: { name: 'RBAC_TEST_ROOT', tenantId } });
        if (existing) return existing;
        return await prisma.folder.create({
            data: { name: 'RBAC_TEST_ROOT', tenantId, createdById: userId }
        });
    }
    const rootFolder = await rootFn();

    // 2. Define Scenarios
    // We want to test Folder Permissions.
    // Scenarios:
    // A. No ACL (Standard RBAC fallback)
    // B. Contributor has READ only (Restrictive)
    // C. Contributor has WRITE (Permissive)
    // D. Viewer has WRITE (Elevation? Should be blocked by Global check usually, but let's see)

    const folderScenarios = [
        { suffix: 'No_ACL', perms: [] },
        {
            suffix: 'Contributor_READ',
            perms: [{ roleId: contributorRole.id, permission: FolderPermissionType.READ }]
        },
        {
            suffix: 'Contributor_WRITE',
            perms: [{ roleId: contributorRole.id, permission: FolderPermissionType.WRITE }]
        },
        {
            suffix: 'Viewer_WRITE',
            perms: [{ roleId: viewerRole.id, permission: FolderPermissionType.WRITE }]
        }
    ];

    const statuses: DocumentStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'OBSOLETE'];

    for (const scenario of folderScenarios) {
        const folderName = `RBAC_${scenario.suffix}`;

        // Create/Find Folder
        let folder = await prisma.folder.findFirst({ where: { name: folderName, parentId: rootFolder.id } });
        if (!folder) {
            folder = await prisma.folder.create({
                data: {
                    name: folderName,
                    parentId: rootFolder.id,
                    tenantId,
                    createdById: userId
                }
            });
            console.log(`  📂 Created Folder: ${folderName}`);

            // Apply Permissions
            for (const p of scenario.perms) {
                await prisma.folderPermission.create({
                    data: {
                        folderId: folder.id,
                        roleId: p.roleId,
                        permission: p.permission,
                        tenantId
                    }
                });
            }
        } else {
            console.log(`  📂 Found Folder: ${folderName}`);
        }

        // Create Documents for each status
        for (const status of statuses) {
            const title = `Doc_${scenario.suffix}_${status}`;
            const existingDoc = await prisma.document.findFirst({ where: { title, folderId: folder.id } });

            if (!existingDoc) {
                await prisma.document.create({
                    data: {
                        title,
                        status,
                        folderId: folder.id,
                        tenantId,
                        createdById: userId, // Created by Admin usually
                        // We might need a doc created by Contributor to test "Creator" logic?
                        // Let's create a separate set for that if needed. 
                        // For now, these are Admin created.
                    }
                });
                console.log(`    📄 Created Doc: ${title}`);
            }
        }

        // Add documents created by Contributor for "Creator" tests
        const contributorUser = await prisma.user.findFirst({ where: { email: 'dms.contributor@example.com' } });
        if (contributorUser) {
            const scenariosByContributor = [
                { title: `Doc_${scenario.suffix}_DRAFT_ByContributor`, status: DocumentStatus.DRAFT },
                { title: `Doc_${scenario.suffix}_SUBMITTED_ByContributor`, status: DocumentStatus.SUBMITTED },
            ];

            for (const s of scenariosByContributor) {
                if (!await prisma.document.findFirst({ where: { title: s.title, folderId: folder.id } })) {
                    await prisma.document.create({
                        data: {
                            title: s.title,
                            status: s.status,
                            folderId: folder.id,
                            tenantId,
                            createdById: contributorUser.id,
                        }
                    });
                    console.log(`    📄 Created Doc: ${s.title} (By Contributor)`);
                }
            }
        }
    }

    console.log('✅ RBAC Test Data Seeded.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
