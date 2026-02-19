
import { prisma } from "../src/lib/prisma";
import { VersionService } from "../src/services/dms/version-service";

async function main() {
    console.log("🧪 Verifying Version Metadata...");

    // Find a document with versions
    const docWithVersions = await prisma.documentVersion.findFirst({
        select: { documentId: true, tenantId: true }
    });

    if (!docWithVersions) {
        console.log("⚠️ No document versions found in DB. Skipping test.");
        return;
    }

    const versions = await VersionService.listVersions(docWithVersions.documentId, docWithVersions.tenantId);

    if (versions.length === 0) {
        throw new Error("❌ Expected versions, found none.");
    }

    const firstVersion = versions[0];
    const fs = require('fs');
    fs.writeFileSync('version_metadata.json', JSON.stringify(firstVersion, null, 2));

    // console.log("First Version Metadata:", JSON.stringify(firstVersion, null, 2));

    if (!firstVersion.document) {
        throw new Error("❌ Version missing 'document' metadata.");
    }
    if (!firstVersion.document.id) {
        throw new Error("❌ Version.document missing 'id'.");
    }
    /* 
    if (!firstVersion.document.documentNumber) {
        console.warn("⚠️ Version.document 'documentNumber' is null (Allowed for legacy docs)");
    } 
    */
    if (firstVersion.document.documentNumber === undefined) {
        throw new Error("❌ Version.document missing 'documentNumber' field entirely.");
    }
    if (!firstVersion.document.status) {
        throw new Error("❌ Version.document missing 'status'.");
    }

    console.log("✅ Version Metadata Verified!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
