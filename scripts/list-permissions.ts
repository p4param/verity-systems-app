import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Listing Permissions...');

    const permissions = await prisma.permission.findMany();
    console.log(`Found ${permissions.length} permissions.`);

    permissions.forEach(p => {
        console.log(`- ${p.code} (${p.description})`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
