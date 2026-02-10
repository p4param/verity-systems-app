const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Checking users with email: user3@example.com")
    const users = await prisma.user.findMany({
        where: { email: 'user3@example.com' },
        include: { tenant: true }
    })

    console.log(`Found ${users.length} users:`)
    users.forEach(u => {
        console.log(`- ID: ${u.id}, Tenant: ${u.tenantId}, Status: ${u.status}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
