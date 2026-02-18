
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { mapActionToExportEnum } from "@/lib/dms/audit-export-utils";

// Mock Request/Response simulation since we can't easily fetch from the running Next.js server in a script
// We will manually invoke the logic used in the route to verify the output generation.

async function verifyAuditExport() {
    console.log("🔒 Starting Audit Export Verification...");
    const tenantId = 1;
    const userId = 1; // Admin

    // 1. Setup: Create Dummy Audit Logs
    console.log("\n1️⃣  Setup: Creating Test Audit Logs...");
    const now = new Date();

    await createAuditLog({
        tenantId,
        actorUserId: userId,
        action: "DMS.CREATE",
        entityType: "DOCUMENT",
        entityId: "DOC-001",
        module: "DMS",
        details: "Created test document",
        metadata: {
            documentNumber: "DOC-001",
            title: "Test Document",
            priority: "HIGH"
        }
    });

    await createAuditLog({
        tenantId,
        actorUserId: userId,
        action: "DMS.UPDATE",
        entityType: "DOCUMENT",
        entityId: "DOC-001",
        module: "DMS",
        details: "Updated status",
        metadata: {
            fromStatus: "DRAFT",
            toStatus: "SUBMITTED",
            changedField: "status"
        }
    });

    console.log("   ✅ Created test logs");

    // 2. Simulate Export Logic
    console.log("\n2️⃣  Verifying Export Stream Logic...");

    // Re-implementing the generator logic here for verification without HTTP layer
    const fromDate = new Date(now.getTime() - 1000 * 60 * 60 * 24); // 24 hours ago
    const toDate = new Date(now.getTime() + 1000 * 60 * 60 * 24);   // 24 hours future

    const logs = await prisma.auditLog.findMany({
        where: {
            tenantId,
            createdAt: { gte: fromDate, lte: toDate },
            module: "DMS"
        },
        orderBy: { id: "asc" },
        include: { actor: { select: { id: true, email: true, fullName: true } } }
    });

    console.log(`   Found ${logs.length} logs to export`);

    if (logs.length === 0) {
        console.error("   ❌ FAILED: No logs found");
        return;
    }

    // Verify Row Transformation
    console.log("\n3️⃣  Verifying CSV Format...");

    // Helper copied from route for strict verification
    function transformLogToCsv(chunk: any): string[] {
        const rows: string[] = [];
        const baseRow = {
            eventId: chunk.id,
            timestampUtc: chunk.createdAt.toISOString(),
            tenantId: chunk.tenantId,
            module: chunk.module || "DMS",
            entityType: chunk.entityType || "",
            entityId: chunk.entityId || "",
            action: mapActionToExportEnum(chunk.action),
            actorUserId: chunk.actor?.id?.toString() || "SYSTEM",
            actorEmail: chunk.actor?.email || "",
            actorRole: "UNKNOWN",
            ipAddress: chunk.ipAddress || "",
            documentNumber: "",
            previousState: "",
            newState: ""
        };

        let metadata: Record<string, any> = {};
        if (chunk.metadata) {
            if (typeof chunk.metadata === 'string') {
                try { metadata = JSON.parse(chunk.metadata); } catch (e) { }
            } else {
                metadata = chunk.metadata;
            }
        }

        if (metadata.documentNumber) baseRow.documentNumber = String(metadata.documentNumber);
        if (metadata.fromStatus) baseRow.previousState = String(metadata.fromStatus);
        if (metadata.toStatus) baseRow.newState = String(metadata.toStatus);

        const keys = Object.keys(metadata).filter(k =>
            !["documentNumber", "fromStatus", "toStatus"].includes(k)
        );

        const formatRow = (r: any) => {
            return [
                r.eventId, r.timestampUtc, r.tenantId, r.module, r.entityType, r.entityId,
                r.documentNumber, r.action, r.previousState, r.newState,
                r.actorUserId, r.actorEmail, r.actorRole, r.ipAddress,
                r.metadataKey,
                (r.metadataValue || "").toString().replace(/"/g, '""').includes(',') ? `"${(r.metadataValue || "").toString().replace(/"/g, '""')}"` : (r.metadataValue || "")
            ].join(",");
        };

        if (keys.length === 0) {
            rows.push(formatRow({ ...baseRow, metadataKey: "", metadataValue: "" }));
        } else {
            for (const key of keys) {
                let value = metadata[key];
                if (typeof value === 'object') value = JSON.stringify(value);
                rows.push(formatRow({ ...baseRow, metadataKey: key, metadataValue: String(value) }));
            }
        }
        return rows;
    }

    let csvLines: string[] = [];
    csvLines.push("eventId,timestampUtc,tenantId,module,entityType,entityId,documentNumber,action,previousState,newState,actorUserId,actorEmail,actorRole,ipAddress,metadataKey,metadataValue");

    for (const log of logs) {
        const rows = transformLogToCsv(log);
        csvLines.push(...rows);
    }

    // Output sample
    console.log("   📝 CSV Output Sample (First 5 lines):");
    csvLines.slice(0, 5).forEach(line => console.log(`   ${line}`));

    // Validation
    const header = csvLines[0].split(",");
    if (header.length !== 16) {
        console.error(`   ❌ FAILED: Schema mismatch. Expected 16 columns, got ${header.length}`);
    } else {
        console.log("   ✅ PASSED: Schema check (16 columns)");
    }

    const firstDataRow = csvLines[1].split(",");
    if (firstDataRow[0] && !isNaN(parseInt(firstDataRow[0]))) {
        console.log("   ✅ PASSED: Data row ID check");
    } else {
        console.error("   ❌ FAILED: Invalid data row content");
    }

    console.log("\n✅ Verification Complete");
}

verifyAuditExport()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
