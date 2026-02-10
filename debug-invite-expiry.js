
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    const userId = 2
    console.log(`🔍 Checking invite status for User ID ${userId}...`)

    // 1. Get User
    const user = await prisma.user.findUnique({
        where: { id: userId }
    })

    if (!user) {
        console.error('❌ User not found')
        return
    }
    console.log(`User found: ${user.email}`)

    // 2. Get Latest Invite
    const lastInvite = await prisma.userInvite.findFirst({
        where: {
            email: user.email
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    if (!lastInvite) {
        console.log('No invites found for this user.')
        return
    }

    // 3. Check Dates
    const now = new Date()
    const expiresAt = new Date(lastInvite.expiresAt)

    console.log('\n--- Date Comparison ---')
    console.log(`Current Time (Server): ${now.toISOString()} (${now.toString()})`)
    console.log(`Invite ExpiresAt:      ${expiresAt.toISOString()} (${expiresAt.toString()})`)

    const isExpired = expiresAt < now
    console.log(`\nIs Expired? (expiresAt < now) -> ${isExpired}`)

    const isUsed = lastInvite.usedAt !== null
    console.log(`Is Used? (usedAt !== null)    -> ${isUsed}`)

    if (!isExpired && !isUsed) {
        console.log('\n❌ Result: ACTIVE invite exists (Resend would fail)')
    } else {
        console.log('\n✅ Result: No active invite (Resend should work)')
    }

}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
