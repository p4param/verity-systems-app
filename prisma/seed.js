const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting database seed...')

    // 1. Create Tenant
    console.log('Creating tenant...')
    const tenant = await prisma.tenant.upsert({
        where: { code: 'default' },
        update: {},
        create: {
            code: 'default',
            name: 'Default Tenant',
            isActive: true,
        },
    })
    console.log(`✅ Tenant created: ${tenant.name} (ID: ${tenant.id})`)

    // 2. Create Permissions
    console.log('Creating permissions...')
    const permissions = [
        { id: 1, code: 'USER_VIEW', description: 'View users' },
        { id: 2, code: 'USER_CREATE', description: 'Create users' },
        { id: 3, code: 'USER_UPDATE', description: 'Update users' },
        { id: 4, code: 'USER_DELETE', description: 'Delete users' },
        { id: 5, code: 'ROLE_VIEW', description: 'View roles' },
        { id: 6, code: 'ROLE_CREATE', description: 'Create roles' },
        { id: 7, code: 'ROLE_UPDATE', description: 'Update roles' },
        { id: 8, code: 'ROLE_DELETE', description: 'Delete roles' },
        { id: 9, code: 'ROLE_ASSIGN', description: 'Assign roles to users' },
        { id: 10, code: 'PERMISSION_VIEW', description: 'View permissions' },
        { id: 11, code: 'AUDIT_VIEW', description: 'View audit logs' },
        { id: 12, code: 'ADMIN_ACCESS', description: 'Access admin panel' },
        { id: 20, code: 'DMS_VIEW', description: 'View documents and folders' },
        { id: 21, code: 'DMS_DOCUMENT_EDIT', description: 'Edit documents' },
        { id: 22, code: 'DMS_DOCUMENT_APPROVE', description: 'Approve documents' },
        { id: 23, code: 'DMS_DOCUMENT_DELETE', description: 'Delete documents' },
        { id: 24, code: 'DMS_DOCUMENT_SUBMIT', description: 'Submit documents' },
        { id: 25, code: 'DMS_DOCUMENT_REJECT', description: 'Reject documents' },
        { id: 26, code: 'DMS_DOCUMENT_OBSOLETE', description: 'Mark documents as obsolete' },
        { id: 27, code: 'DMS_FOLDER_READ', description: 'Read/View folders' },
        { id: 28, code: 'DMS_FOLDER_CREATE', description: 'Create folders' },
        { id: 29, code: 'DMS_FOLDER_UPDATE', description: 'Update/Move folders' },
        { id: 30, code: 'DMS_FOLDER_DELETE', description: 'Delete folders' },
        { id: 31, code: 'DMS_DOCUMENT_CREATE', description: 'Create new document records' },
        { id: 32, code: 'DMS_DOCUMENT_READ', description: 'Read/View documents' },
        { id: 33, code: 'DMS_DOCUMENT_UPLOAD', description: 'Upload new document versions' },
        { id: 34, code: 'DMS_SHARE_CREATE', description: 'Create document share links' },
        { id: 35, code: 'DMS_SHARE_READ', description: 'Read/View share links' },
        { id: 36, code: 'DMS_SHARE_REVOKE', description: 'Revoke share links' },
        { id: 37, code: 'DMS_DOCUMENT_TYPE_MANAGE', description: 'Manage document types (CRUD)' },
        { id: 38, code: 'DMS_AUDIT_EXPORT', description: 'Export DMS audit logs' },
    ]

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { id: perm.id },
            update: { code: perm.code, description: perm.description },
            create: perm,
        })
    }
    console.log(`✅ Created ${permissions.length} permissions`)

    // 3. Create Admin Role
    console.log('Creating admin role...')
    const adminRole = await prisma.role.upsert({
        where: { id: 1 },
        update: { name: 'Admin', tenantId: tenant.id },
        create: {
            id: 1,
            tenantId: tenant.id,
            name: 'Admin',
            description: 'Full system administrator',
            isSystem: true,
            requiresMfa: false,
            isActive: true,
        },
    })
    console.log(`✅ Admin role created (ID: ${adminRole.id})`)

    // 4. Assign all permissions to Admin role
    console.log('Assigning permissions to admin role...')
    const allPermissions = await prisma.permission.findMany()
    for (const permission of allPermissions) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: adminRole.id,
                    permissionId: permission.id,
                },
            },
            update: {},
            create: {
                roleId: adminRole.id,
                permissionId: permission.id,
            },
        })
    }
    console.log(`✅ Assigned ${allPermissions.length} permissions to Admin role`)

    // 5. Create Admin User
    console.log('Creating admin user...')
    const passwordHash = await bcrypt.hash('Admin@123', 10)

    const adminUser = await prisma.user.upsert({
        where: {
            tenantId_email: {
                tenantId: tenant.id,
                email: 'admin@example.com',
            },
        },
        update: {},
        create: {
            tenantId: tenant.id,
            fullName: 'System Administrator',
            email: 'admin@example.com',
            passwordHash: passwordHash,
            status: 'ACTIVE',
            isActive: true,
            isLocked: false,
            mfaEnabled: false,
        },
    })
    console.log(`✅ Admin user created (ID: ${adminUser.id})`)

    // 6. Assign Admin role to user
    console.log('Assigning admin role to user...')
    await prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: adminUser.id,
                roleId: adminRole.id,
            },
        },
        update: {},
        create: {
            userId: adminUser.id,
            roleId: adminRole.id,
            assignedBy: adminUser.id,
        },
    })
    console.log('✅ Admin role assigned to user')

    // 7. Create User Role (for regular users)
    console.log('Creating user role...')
    const userRole = await prisma.role.upsert({
        where: { id: 2 },
        update: { name: 'User', tenantId: tenant.id },
        create: {
            id: 2,
            tenantId: tenant.id,
            name: 'User',
            description: 'Standard user',
            isSystem: true,
            requiresMfa: false,
            isActive: true,
        },
    })
    console.log(`✅ User role created (ID: ${userRole.id})`)

    // Assign basic permissions to User role
    const userPermissions = await prisma.permission.findMany({
        where: {
            code: {
                in: ['USER_VIEW', 'DMS_VIEW', 'DMS_DOCUMENT_EDIT', 'DMS_DOCUMENT_SUBMIT'],
            },
        },
    })

    for (const permission of userPermissions) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: userRole.id,
                    permissionId: permission.id,
                },
            },
            update: {},
            create: {
                roleId: userRole.id,
                permissionId: permission.id,
            },
        })
    }
    console.log(`✅ Assigned ${userPermissions.length} permissions to User role`)

    console.log('\n🎉 Database seed completed successfully!')
    console.log('\n📋 Admin Credentials:')
    console.log('   Email:    admin@example.com')
    console.log('   Password: Admin@123')
    console.log('\n⚠️  Please change the password after first login!')
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
