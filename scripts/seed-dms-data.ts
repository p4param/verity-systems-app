import { PrismaClient, DocumentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting DMS data seeding...');

    // 1. Fetch First Tenant and User
    const tenant = await prisma.tenant.findFirst();
    const user = await prisma.user.findFirst();

    if (!tenant || !user) {
        console.error('❌ Error: No Tenant or User found. Please seed base data first.');
        process.exit(1);
    }

    console.log(`✅ Using Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`✅ Using User: ${user.fullName} (${user.id})`);

    const tenantId = tenant.id;
    const userId = user.id;

    // 2. Create Folder Structure (Idempotent)
    console.log('📂 Seeding Folders...');

    const findOrCreateFolder = async (name: string, parentId: string | null = null) => {
        const existing = await prisma.folder.findFirst({
            where: {
                tenantId,
                name,
                parentId
            }
        });
        if (existing) {
            console.log(`  - Found existing folder: "${name}" (${existing.id})`);
            return existing;
        }
        const created = await prisma.folder.create({
            data: {
                name,
                tenantId,
                parentId,
                createdById: userId,
            },
        });
        console.log(`  - Created folder: "${name}" (${created.id})`);
        return created;
    };

    const generalFolder = await findOrCreateFolder('General Docs');
    const financeFolder = await findOrCreateFolder('Finance', generalFolder.id);
    const hrFolder = await findOrCreateFolder('HR Policies');


    // 3. Create Document Types (Idempotent)
    console.log('🏷️ Seeding Document Types...');

    const findOrCreateType = async (name: string) => {
        return await prisma.documentType.upsert({
            where: {
                tenantId_name: { tenantId, name }
            },
            update: {},
            create: {
                name,
                tenantId,
            }
        });
    }

    const policyType = await findOrCreateType('Policy');
    const procedureType = await findOrCreateType('Procedure');
    const formType = await findOrCreateType('Form');
    const financeRecordType = await findOrCreateType('Financial Record');

    // 4. Create Documents (Idempotent check by Title)
    console.log('📄 Seeding Documents...');

    const createDocIdempotent = async (data: any) => {
        const existing = await prisma.document.findFirst({
            where: {
                tenantId,
                title: data.title,
                folderId: data.folderId
            }
        });
        if (existing) {
            console.log(`  - Found existing document: "${data.title}"`);
            return existing;
        }
        const created = await prisma.document.create({ data });
        console.log(`  - Created document: "${data.title}" (${data.status})`);
        return created;
    };

    // DRAFT
    await createDocIdempotent({
        title: 'Draft Proposal',
        description: 'A working draft of the Q2 proposal.',
        status: 'DRAFT',
        folderId: generalFolder.id,
        tenantId,
        createdById: userId,
        typeId: formType.id,
    });

    // SUBMITTED
    await createDocIdempotent({
        title: 'Q1 Report',
        description: 'Financial report for Q1, submitted for review.',
        status: 'SUBMITTED',
        folderId: financeFolder.id,
        tenantId,
        createdById: userId,
        typeId: financeRecordType.id,
    });

    // APPROVED
    let approvedDoc = await prisma.document.findFirst({
        where: { tenantId, title: 'Employee Handbook', folderId: hrFolder.id }
    });

    if (!approvedDoc) {
        approvedDoc = await prisma.document.create({
            data: {
                title: 'Employee Handbook',
                description: 'Official company handbook.',
                status: 'APPROVED',
                folderId: hrFolder.id,
                tenantId,
                createdById: userId,
                typeId: policyType.id,
                effectiveDate: new Date(),
            },
        });
        console.log(`  - Created APPROVED: "Employee Handbook"`);

        // Create Version
        const approvedVersion = await prisma.documentVersion.create({
            data: {
                documentId: approvedDoc.id,
                tenantId,
                versionNumber: 1,
                fileName: 'handbook_v1.pdf',
                fileSize: 1024 * 500,
                mimeType: 'application/pdf',
                storageKey: `${tenantId}/${approvedDoc.id}/v1.pdf`,
                createdById: userId,
            },
        });

        // Link version
        await prisma.document.update({
            where: { id: approvedDoc.id },
            data: { currentVersionId: approvedVersion.id },
        });
        console.log(`    - Added Version 1`);
    } else {
        console.log(`  - Found existing APPROVED: "Employee Handbook"`);
    }

    // OBSOLETE
    await createDocIdempotent({
        title: 'Old Policy 2020',
        description: 'Deprecated policy document.',
        status: 'OBSOLETE',
        folderId: hrFolder.id,
        tenantId,
        createdById: userId,
        typeId: policyType.id,
    });

    // REJECTED
    await createDocIdempotent({
        title: 'Budget Request',
        description: 'Request for office party budget.',
        status: 'REJECTED',
        folderId: financeFolder.id,
        tenantId,
        createdById: userId,
        typeId: formType.id,
    });

    console.log('✅ DMS Data Seeding Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
