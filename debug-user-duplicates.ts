import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Checking users with email: user3@example.com")
    // Bypass middleware by using a fresh client instance here
    const users = await prisma.user.findMany({
        where: { email: 'user3@example.com' },
        include: {
            // We can't include tenant details if we don't know the relation name or if it's just an ID
            // User likely has 'tenant' relation.
        }
    })

    console.log(`Found ${users.length} users:`)
    users.forEach(u => {
        console.log(`- ID: ${u.id}, TenantID: ${u.tenantId}, Status: ${u.status}, Email: ${u.email}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
