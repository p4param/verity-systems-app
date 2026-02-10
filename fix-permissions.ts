
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Checking permissions...')

    // 1. Ensure Permission Exists
    const auditPerm = await prisma.permission.upsert({
        where: { code: 'AUDIT_VIEW' },
        update: {},
        create: {
            code: 'AUDIT_VIEW',
            description: 'View audit logs'
        }
    })
    console.log(`✅ Permission 'AUDIT_VIEW' ensured (ID: ${auditPerm.id})`)

    // 2. Find Admin Role
    const adminRole = await prisma.role.findFirst({
        where: { name: 'Admin' }
    })

    if (!adminRole) {
        console.error('❌ Admin role not found!')
        return
    }
    console.log(`✅ Admin role found (ID: ${adminRole.id})`)

    // 3. Check if assigned
    const existingAssignment = await prisma.rolePermission.findUnique({
        where: {
            roleId_permissionId: {
                roleId: adminRole.id,
                permissionId: auditPerm.id
            }
        }
    })

    if (existingAssignment) {
        console.log('✅ AUDIT_VIEW already assigned to Admin role')
    } else {
        // 4. Assign if missing
        await prisma.rolePermission.create({
            data: {
                roleId: adminRole.id,
                permissionId: auditPerm.id
            }
        })
        console.log('✅ Assigned AUDIT_VIEW to Admin role')
    }

    // 5. Verify for a sample user
    const adminUser = await prisma.user.findFirst({
        where: { email: 'admin@example.com' }, // Adjust if you know the specific user email
        include: {
            userRoles: {
                include: {
                    role: {
                        include: {
                            rolePermissions: {
                                include: { permission: true }
                            }
                        }
                    }
                }
            }
        }
    })

    if (adminUser) {
        const hasPerm = adminUser.userRoles.some(ur =>
            ur.role.rolePermissions.some(rp => rp.permission.code === 'AUDIT_VIEW')
        )
        console.log(`User ${adminUser.email} has AUDIT_VIEW: ${hasPerm}`)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
