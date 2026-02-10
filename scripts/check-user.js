const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAIL = "test@example.com";

async function checkUser() {
    try {
        console.log(`Checking user: ${EMAIL}...`);
        const user = await prisma.user.findFirst({
            where: { email: EMAIL },
            select: {
                id: true,
                email: true,
                isActive: true,
                isLocked: true,
                mfaEnabled: true,
                mfaSetupRequired: true,
                tenantId: true
            }
        });

        console.log(user);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
