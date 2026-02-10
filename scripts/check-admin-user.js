const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@dms.com';

    console.log(`Checking user: ${email}...`);
    const user = await prisma.user.findFirst({
        where: { email },
        include: {
            userRoles: {
                include: {
                    role: true
                }
            }
        }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('User:', user.email);
    console.log('Roles:', user.userRoles.map(ur => ur.role.name));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
