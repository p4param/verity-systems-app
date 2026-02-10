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
        { code: 'USER_VIEW', description: 'View users' },
        { code: 'USER_CREATE', description: 'Create users' },
        { code: 'USER_UPDATE', description: 'Update users' },
        { code: 'USER_DELETE', description: 'Delete users' },
        { code: 'ROLE_VIEW', description: 'View roles' },
        { code: 'ROLE_CREATE', description: 'Create roles' },
        { code: 'ROLE_UPDATE', description: 'Update roles' },
        { code: 'ROLE_DELETE', description: 'Delete roles' },
        { code: 'ROLE_ASSIGN', description: 'Assign roles to users' },
        { code: 'PERMISSION_VIEW', description: 'View permissions' },
        { code: 'AUDIT_VIEW', description: 'View audit logs' },
        { code: 'ADMIN_ACCESS', description: 'Access admin panel' },
    ]

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { code: perm.code },
            update: {},
            create: perm,
        })
    }
    console.log(`✅ Created ${permissions.length} permissions`)

    // 3. Create Admin Role
    console.log('Creating admin role...')
    const adminRole = await prisma.role.upsert({
        where: {
            tenantId_name: {
                tenantId: tenant.id,
                name: 'Admin',
            },
        },
        update: {},
        create: {
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
        where: {
            tenantId_name: {
                tenantId: tenant.id,
                name: 'User',
            },
        },
        update: {},
        create: {
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
                in: ['USER_VIEW'],
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
