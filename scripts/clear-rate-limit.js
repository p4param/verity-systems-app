const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearRateLimit() {
    try {
        console.log("Clearing rate limits...");
        const { count } = await prisma.passwordResetRequest.deleteMany({});
        console.log(`Deleted ${count} rate limit entries.`);
    } catch (e) {
        console.error("Failed to clear rate limits:", e);
    } finally {
        await prisma.$disconnect();
    }
}

clearRateLimit();
