import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Checking recent AuditLogs (last 10)...")
    const logs = await prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    })

    console.log(`Found ${logs.length} logs.`)
    logs.forEach(l => {
        console.log(`[${l.createdAt.toISOString()}] Tenant:${l.tenantId} User:${l.actorUserId} Action:${l.action} Details:${l.details}`)
    })

    console.log("\nChecking specifically for USER.LOGIN_FAILED in last 24h...")
    const failedCount = await prisma.auditLog.count({
        where: {
            action: "USER.LOGIN_FAILED"
        }
    })
    console.log(`Total USER.LOGIN_FAILED count (all time): ${failedCount}`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
