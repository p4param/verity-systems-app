
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/permission-guard";
import { mapActionToExportEnum } from "@/lib/dms/audit-export-utils";
import { createAuditLog } from "@/lib/audit";

// Helper to transform log to CSV chunks
function transformLogToCsv(chunk: any): string[] {
    const rows: string[] = [];

    // 1. Base Data
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

    // 2. Parse Metadata
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
        ].join(",") + "\n";
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

// Allow execution for up to 5 minutes (depending on platform limits)
export const maxDuration = 300;

/**
 * GET /api/dms/audit/export
 * 
 * Exports audit logs as a flattened CSV stream.
 * Requires DMS_AUDIT_EXPORT permission.
 */
export async function GET(req: NextRequest) {
    try {
        // 1. Authentication & Authorization
        const user = await requirePermission(req, "DMS_AUDIT_EXPORT");

        // 2. Validate Query Parameters
        const searchParams = req.nextUrl.searchParams;
        const fromStr = searchParams.get("from");
        const toStr = searchParams.get("to");

        if (!fromStr || !toStr) {
            return NextResponse.json({ message: "Missing 'from' or 'to' date parameters" }, { status: 400 });
        }

        const fromDate = new Date(fromStr);
        const toDate = new Date(toStr);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return NextResponse.json({ message: "Invalid date format. Use ISO 8601." }, { status: 400 });
        }

        // Enforce max 1 year range
        const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 366) {
            return NextResponse.json({ message: "Date range cannot exceed 1 year" }, { status: 400 });
        }

        // 3. Log the Export Action (Audit the Auditor)
        await createAuditLog({
            tenantId: user.tenantId,
            actorUserId: user.sub,
            action: "SYSTEM.AUDIT_EXPORT",
            entityType: "SYSTEM",
            entityId: "AUDIT_LOGS",
            details: `Exported audit logs from ${fromStr} to ${toStr}`,
            metadata: {
                from: fromStr,
                to: toStr,
                ipAddress: req.headers.get("x-forwarded-for") || "unknown"
            }
        });

        // 4. Stream Response
        // Use an async generator to stream data
        async function* makeIterator() {
            const encoder = new TextEncoder();

            // Yield Header
            const header = [
                "eventId", "timestampUtc", "tenantId", "module", "entityType", "entityId",
                "documentNumber", "action", "previousState", "newState",
                "actorUserId", "actorEmail", "actorRole", "ipAddress",
                "metadataKey", "metadataValue"
            ].join(",") + "\n";
            yield encoder.encode(header);

            const BATCH_SIZE = 1000;
            let cursor: number | undefined = undefined;

            while (true) {
                const logs = await prisma.auditLog.findMany({
                    where: {
                        tenantId: user.tenantId,
                        createdAt: { gte: fromDate, lte: toDate },
                        module: "DMS"
                    },
                    take: BATCH_SIZE,
                    skip: cursor ? 1 : 0,
                    cursor: cursor ? { id: cursor } : undefined,
                    orderBy: { id: "asc" },
                    include: { actor: { select: { id: true, email: true, fullName: true } } }
                });

                if (logs.length === 0) break;

                for (const log of logs) {
                    const chunks = transformLogToCsv(log);
                    for (const chunk of chunks) {
                        yield encoder.encode(chunk);
                    }
                }

                cursor = logs[logs.length - 1].id;
                if (logs.length < BATCH_SIZE) break;
            }
        }

        return new NextResponse(makeIterator() as any, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="audit_export_${user.tenantId}_${fromStr}_${toStr}.csv"`,
                "Cache-Control": "no-cache"
            }
        });

    } catch (error: any) {
        console.error("Export Error:", error);
        return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
    }
}
