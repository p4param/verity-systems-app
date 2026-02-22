
import { prisma } from "../src/lib/prisma";

async function checkFolders() {
    const folders = await prisma.folder.findMany({
        where: { isUnderLegalHold: true },
        select: { id: true, name: true, isUnderLegalHold: true }
    });
    console.log("Folders under Legal Hold:", JSON.stringify(folders, null, 2));
}

checkFolders().catch(console.error);
