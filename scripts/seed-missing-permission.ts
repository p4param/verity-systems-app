import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding DMS_DOCUMENT_WITHDRAW Permission...');

    // Fix Sequence first
    try {
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Permission"', 'id'), coalesce(max(id),0) + 1, false) FROM "Permission";`);
        console.log('✅ Permission sequence reset.');
    } catch (e) {
        console.error('⚠️ Failed to reset Permission sequence.', e);
    }

    const perm = await prisma.permission.upsert({
        where: { code: 'DMS_DOCUMENT_WITHDRAW' },
        update: {},
        create: {
            code: 'DMS_DOCUMENT_WITHDRAW',
            description: 'Withdraw documents from review'
        }
    });

    console.log(`✅ Upserted Permission: ${perm.code} (${perm.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
