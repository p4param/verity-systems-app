import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Fixing Sequences...');

    try {
        // Attempt to reset Role sequence
        // Note: Table name case sensitivity depends on DB setup. Prisma usually preserves case if no map.
        // We try "Role" first.
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Role"', 'id'), coalesce(max(id),0) + 1, false) FROM "Role";`);
        console.log('✅ Role sequence reset.');
    } catch (e) {
        console.error('⚠️ Failed to reset Role sequence via "Role". Trying "role"...', e);
        try {
            await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"role"', 'id'), coalesce(max(id),0) + 1, false) FROM "role";`);
            console.log('✅ role sequence reset.');
        } catch (e2) {
            console.error('❌ Failed to reset Role sequence.', e2);
        }
    }

    try {
        // Reset User sequence
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id),0) + 1, false) FROM "User";`);
        console.log('✅ User sequence reset.');
    } catch (e) {
        console.error('⚠️ Failed to reset User sequence.', e);
    }

    console.log('🔧 Sequence Fix Complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
