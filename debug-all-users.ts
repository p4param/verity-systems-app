import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Listing ALL users:")
    const users = await prisma.user.findMany()
    users.forEach(u => {
        console.log(`[${u.id}] ${u.email} (Tenant: ${u.tenantId}, Status: ${u.status})`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
