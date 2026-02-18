import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Listing Folders...');

    const folders = await prisma.folder.findMany({
        orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${folders.length} folders.`);

    folders.forEach(f => {
        console.log(`- [${f.id}] ${f.name} (Parent: ${f.parentId})`);
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
