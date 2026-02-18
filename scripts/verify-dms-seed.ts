import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Verifying DMS Data...');

    const folders = await prisma.folder.findMany({
        where: { name: { in: ['General Docs', 'Finance', 'HR Policies'] } },
        include: { documents: true },
    });

    console.log(`Found ${folders.length} folders.`);
    for (const folder of folders) {
        console.log(`- Folder: ${folder.name} (${folder.id})`);
        console.log(`  Documents: ${folder.documents.length}`);
        folder.documents.forEach(doc => {
            console.log(`    - ${doc.title} [${doc.status}]`);
        });
    }

    const allDocs = await prisma.document.findMany({
        where: { title: { in: ['Draft Proposal', 'Q1 Report', 'Employee Handbook', 'Old Policy 2020', 'Budget Request'] } },
        include: { type: true }
    });

    console.log(`\nFound ${allDocs.length} total seeded documents.`);
    allDocs.forEach(doc => {
        console.log(`  - ${doc.title} [${doc.status}] - Type: ${doc.type?.name || 'N/A'}`);
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
