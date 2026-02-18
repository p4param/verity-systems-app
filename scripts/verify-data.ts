import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const docs = await prisma.document.findMany({
        where: {
            title: { contains: 'SUBMITTED' }
        },
        select: {
            id: true,
            title: true,
            status: true,
            createdById: true,
            folder: { select: { name: true } }
        }
    });

    console.log('--- SUBMITTED Documents ---');
    docs.forEach(d => {
        console.log(`[${d.status}] ${d.title} (Creator: ${d.createdById}) in ${d.folder?.name}`);
    });

    const contributors = await prisma.user.findMany({
        where: { email: 'dms.contributor@example.com' },
        select: { id: true, email: true }
    });
    console.log('\n--- Contributors ---');
    console.log(contributors);
}

main().finally(() => prisma.$disconnect());
