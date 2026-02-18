import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting DMS User Seeding...');

    // 1. Fetch Tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.error('❌ No Tenant found. Seed base data first.');
        process.exit(1);
    }
    const tenantId = tenant.id;
    console.log(`✅ Using Tenant: ${tenant.name} (${tenantId})`);

    // 2. Define Roles and Permissions
    // Note: Assuming Permissions already exist or we need to create them?
    // Let's assume basic permissions exist. If not, we might need another seed step.
    // For now, I'll just map roles to names and assume permissions are assigned manually or via another script.
    // Actually, to make this useful, I should probably assign permissions if I can.
    // Let's focus on creating the Users and Roles first.

    const rolesToCreate = [
        {
            name: 'DMS Admin',
            description: 'Full access to DMS',
            permissions: ['DMS_VIEW', 'DMS_FOLDER_READ', 'DMS_FOLDER_CREATE', 'DMS_FOLDER_UPDATE', 'DMS_FOLDER_DELETE', 'DMS_DOCUMENT_CREATE', 'DMS_DOCUMENT_READ', 'DMS_DOCUMENT_EDIT', 'DMS_DOCUMENT_UPLOAD', 'DMS_DOCUMENT_SUBMIT', 'DMS_DOCUMENT_APPROVE', 'DMS_DOCUMENT_REJECT', 'DMS_DOCUMENT_WITHDRAW', 'DMS_DOCUMENT_OBSOLETE', 'DMS_DOCUMENT_DELETE', 'DMS_SHARE_CREATE', 'DMS_SHARE_READ', 'DMS_SHARE_REVOKE', 'DMS_DOCUMENT_TYPE_MANAGE', 'DMS_AUDIT_EXPORT']
        },
        {
            name: 'DMS Manager',
            description: 'Can approve and manage documents',
            permissions: ['DMS_VIEW', 'DMS_FOLDER_READ', 'DMS_FOLDER_CREATE', 'DMS_FOLDER_UPDATE', 'DMS_DOCUMENT_CREATE', 'DMS_DOCUMENT_READ', 'DMS_DOCUMENT_EDIT', 'DMS_DOCUMENT_UPLOAD', 'DMS_DOCUMENT_SUBMIT', 'DMS_DOCUMENT_APPROVE', 'DMS_DOCUMENT_REJECT', 'DMS_DOCUMENT_WITHDRAW', 'DMS_SHARE_CREATE', 'DMS_SHARE_READ', 'DMS_SHARE_REVOKE']
        },
        {
            name: 'DMS Contributor',
            description: 'Can create and edit documents',
            permissions: ['DMS_VIEW', 'DMS_FOLDER_READ', 'DMS_DOCUMENT_CREATE', 'DMS_DOCUMENT_READ', 'DMS_DOCUMENT_EDIT', 'DMS_DOCUMENT_UPLOAD', 'DMS_DOCUMENT_SUBMIT', 'DMS_DOCUMENT_WITHDRAW', 'DMS_SHARE_CREATE']
        },
        {
            name: 'DMS Viewer',
            description: 'Read-only access',
            permissions: ['DMS_VIEW', 'DMS_FOLDER_READ', 'DMS_DOCUMENT_READ']
        },
    ];

    const createdRoles: Record<string, number> = {};
    const allPermissions = await prisma.permission.findMany();
    const permMap = new Map(allPermissions.map(p => [p.code, p.id])); // Assuming name is the unique key? Schema says 'code'. But verifying output showed 'code' (e.g. DMS_folder_READ).

    // Wait, the output of list-permissions.ts showed: "- DMS_FOLDER_READ (Read/View folders)"
    // The schema says `code` is unique. 
    // Let's assume the permission 'code' is what we are using. verify list-permissions.ts output again.
    // It printed code. So I should use 'code'.

    const permCodeMap = new Map(allPermissions.map(p => [p.code, p.id]));

    for (const r of rolesToCreate) {
        const role = await prisma.role.upsert({
            where: {
                tenantId_name: { tenantId, name: r.name }
            },
            update: {},
            create: {
                name: r.name,
                description: r.description,
                tenantId
            }
        });
        createdRoles[r.name] = role.id;
        console.log(`  - Upserted Role: ${r.name} (${role.id})`);

        // Assign Permissions
        if (r.permissions && r.permissions.length > 0) {
            for (const permCode of r.permissions) {
                const permId = permCodeMap.get(permCode);
                if (permId) {
                    await prisma.rolePermission.upsert({
                        where: {
                            roleId_permissionId: { roleId: role.id, permissionId: permId }
                        },
                        update: {},
                        create: {
                            roleId: role.id,
                            permissionId: permId
                        }
                    });
                } else {
                    console.warn(`    ⚠️ Permission '${permCode}' not found in DB.`);
                }
            }
            console.log(`    - Assigned ${r.permissions.length} permissions.`);
        }
    }

    // 3. Create Users
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const usersToCreate = [
        { name: 'DmsAdmin User', email: 'dms.admin@example.com', role: 'DMS Admin' },
        { name: 'DmsManager User', email: 'dms.manager@example.com', role: 'DMS Manager' },
        { name: 'DmsContributor User', email: 'dms.contributor@example.com', role: 'DMS Contributor' },
        { name: 'DmsViewer User', email: 'dms.viewer@example.com', role: 'DMS Viewer' },
    ];

    for (const u of usersToCreate) {
        // Create/Update User
        const user = await prisma.user.upsert({
            where: {
                tenantId_email: { tenantId, email: u.email }
            },
            update: {
                fullName: u.name,
                passwordHash, // Reset password to known value
                isActive: true,
                status: 'ACTIVE'
            },
            create: {
                email: u.email,
                fullName: u.name,
                passwordHash,
                tenantId,
                status: 'ACTIVE',
                isActive: true
            }
        });
        console.log(`  - Upserted User: ${u.name} (${user.id})`);

        // Assign Role
        const roleId = createdRoles[u.role];
        if (roleId) {
            await prisma.userRole.upsert({
                where: {
                    userId_roleId: { userId: user.id, roleId }
                },
                update: {},
                create: {
                    userId: user.id,
                    roleId
                }
            });
            console.log(`    - Assigned Role: ${u.role}`);
        }
    }

    console.log('✅ DMS User Seeding Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
