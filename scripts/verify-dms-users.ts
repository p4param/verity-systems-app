import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Verifying DMS Users...');

    const users = await prisma.user.findMany({
        where: {
            email: {
                in: [
                    'dms.admin@example.com',
                    'dms.manager@example.com',
                    'dms.contributor@example.com',
                    'dms.viewer@example.com'
                ]
            }
        },
        include: {
            userRoles: {
                include: {
                    role: true
                }
            }
        }
    });

    console.log(`Found ${users.length} seeded users.`);

    for (const user of users) {
        const roles = user.userRoles.map(ur => ur.role.name).join(', ');
        console.log(`- User: ${user.fullName} (${user.email})`);
        console.log(`  Roles: ${roles || 'None'}`);
        console.log(`  Status: ${user.status}`);
    }

    if (users.length !== 4) {
        console.warn(`⚠️ Expected 4 users, found ${users.length}.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
