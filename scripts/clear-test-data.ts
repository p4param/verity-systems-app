import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const deleted = await prisma.document.deleteMany({
        where: {
            OR: [
                { title: { startsWith: 'Doc_RBAC' } },
                { title: { startsWith: 'Doc_No_ACL' } },
                { title: { startsWith: 'Doc_Contributor' } },
                { title: { startsWith: 'Doc_Viewer' } }
            ]
        }
    });
    console.log(`Deleted ${deleted.count} test documents.`);
}

main().finally(() => prisma.$disconnect());
