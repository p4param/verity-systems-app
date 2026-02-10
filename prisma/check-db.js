const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkDatabase() {
    console.log('🔍 Checking database state...\n')

    // Check Permissions
    const permissions = await prisma.permission.findMany()
    console.log(`📋 Permissions (${permissions.length}):`)
    permissions.forEach(p => console.log(`   - ${p.code}: ${p.description}`))

    // Check Roles
    const roles = await prisma.role.findMany({
        include: {
            rolePermissions: {
                include: {
                    permission: true
                }
            }
        }
    })
    console.log(`\n👥 Roles (${roles.length}):`)
    roles.forEach(r => {
        console.log(`   - ${r.name} (ID: ${r.id}, System: ${r.isSystem})`)
        console.log(`     Permissions: ${r.rolePermissions.length}`)
        r.rolePermissions.forEach(rp => {
            console.log(`       • ${rp.permission.code}`)
        })
    })

    // Check Users
    const users = await prisma.user.findMany({
        include: {
            userRoles: {
                include: {
                    role: true
                }
            }
        }
    })
    console.log(`\n👤 Users (${users.length}):`)
    users.forEach(u => {
        console.log(`   - ${u.email} (ID: ${u.id}, Status: ${u.status})`)
        console.log(`     Roles: ${u.userRoles.length}`)
        u.userRoles.forEach(ur => {
            console.log(`       • ${ur.role.name}`)
        })
    })

    // Check Tenants
    const tenants = await prisma.tenant.findMany()
    console.log(`\n🏢 Tenants (${tenants.length}):`)
    tenants.forEach(t => console.log(`   - ${t.name} (Code: ${t.code}, ID: ${t.id})`))
}

checkDatabase()
    .catch(e => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
