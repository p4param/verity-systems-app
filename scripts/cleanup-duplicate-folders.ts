import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning up Duplicate Folders...');

    const allFolders = await prisma.folder.findMany({
        orderBy: { createdAt: 'asc' }
    });

    const uniqueMap = new Map<string, string>(); // Key: "name|parentId", Value: folderId (keep this one)
    const duplicates: string[] = [];

    for (const folder of allFolders) {
        // Treat null parentId as "root"
        const key = `${folder.name}|${folder.parentId || 'root'}`;

        if (uniqueMap.has(key)) {
            // Duplicate!
            console.log(`Found duplicate: ${folder.name} (${folder.id}) - Duplicate of ${uniqueMap.get(key)}`);
            duplicates.push(folder.id);
        } else {
            // First time seeing this combination, keep it
            uniqueMap.set(key, folder.id);
        }
    }

    if (duplicates.length === 0) {
        console.log('✅ No duplicates found.');
        return;
    }

    console.log(`🗑️ Deleting ${duplicates.length} duplicate folders...`);

    for (const dupId of duplicates) {
        const dupFolder = allFolders.find(f => f.id === dupId);
        if (!dupFolder) continue;

        const key = `${dupFolder.name}|${dupFolder.parentId || 'root'}`;
        const targetId = uniqueMap.get(key);

        if (!targetId) continue;

        console.log(`  - Processing Duplicate: ${dupId} -> Target: ${targetId}`);

        // 1. Move Documents
        const docs = await prisma.document.updateMany({
            where: { folderId: dupId },
            data: { folderId: targetId }
        });
        if (docs.count > 0) console.log(`    Moved ${docs.count} documents.`);

        // 2. Move Subfolders
        const children = await prisma.folder.findMany({ where: { parentId: dupId } });

        for (const child of children) {
            // Check if target already has a child with this name
            const existingChild = await prisma.folder.findFirst({
                where: {
                    parentId: targetId,
                    name: child.name,
                    tenantId: child.tenantId
                }
            });

            if (existingChild) {
                console.log(`    ⚠️ Collision: Folder '${child.name}' already exists in target.`);
                // Move documents from colliding child to existing target child
                const childDocs = await prisma.document.updateMany({
                    where: { folderId: child.id },
                    data: { folderId: existingChild.id }
                });
                console.log(`      Moved ${childDocs.count} documents from collision '${child.name}' to target.`);

                // Try clear subfolders if any (simplification: assume depth 1)
                try {
                    await prisma.folder.delete({ where: { id: child.id } });
                    console.log(`      Deleted collision source folder '${child.name}'`);
                } catch (e) {
                    console.error(`      ❌ Failed to delete collision source '${child.name}'`, e);
                }

            } else {
                // No collision, safe to move
                await prisma.folder.update({
                    where: { id: child.id },
                    data: { parentId: targetId }
                });
                console.log(`    Moved subfolder '${child.name}' to target.`);
            }
        }

        // 3. Delete Duplicate Folder
        try {
            await prisma.folder.delete({ where: { id: dupId } });
            console.log(`    ✅ Deleted duplicate folder ${dupId}`);
        } catch (e) {
            console.error(`    ❌ Failed to delete duplicate folder ${dupId}`, e);
        }
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
