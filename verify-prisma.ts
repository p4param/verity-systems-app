
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Verifying Prisma Client...')

    // Check if userInvite exists on prisma instance
    if ('userInvite' in prisma) {
        console.log('✅ prisma.userInvite exists')
    } else {
        console.error('❌ prisma.userInvite MISSING')
    }

    // Check if we can select 'status' from User
    try {
        const user = await prisma.user.findFirst({
            select: { id: true, status: true }
        })
        console.log('✅ User query with status field successful')
        if (user) {
            console.log('Sample user status:', user.status)
        }
    } catch (e) {
        console.error('❌ User query with status field FAILED', e)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
