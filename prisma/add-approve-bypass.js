const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Running migration to add Approve on Behalf permission...')

    // 1. Create the permission
    const permission = await prisma.permission.upsert({
        where: { id: 43 },
        update: {
            code: 'DMS_DOCUMENT_APPROVE_ON_BEHALF',
            description: 'Approve or reject on behalf of assigned reviewers'
        },
        create: {
            id: 43,
            code: 'DMS_DOCUMENT_APPROVE_ON_BEHALF',
            description: 'Approve or reject on behalf of assigned reviewers'
        }
    })
    console.log(`✅ Permission registered: ${permission.code}`)

    // 2. Assign to Admin role (ID 1)
    await prisma.rolePermission.upsert({
        where: {
            roleId_permissionId: {
                roleId: 1,
                permissionId: 43
            }
        },
        update: {},
        create: {
            roleId: 1,
            permissionId: 43
        }
    })
    console.log('✅ Permission assigned to Admin role')

    console.log('🎉 Done!')
}

main()
    .catch((e) => {
        console.error('❌ Migration failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
