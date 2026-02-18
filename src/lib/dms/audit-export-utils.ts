
import { Transform } from "stream";

/**
 * Strict canonical action enum for DMS audit logs.
 * All exported logs must map to one of these values.
 */
export enum AuditExportAction {
    DOCUMENT_CREATED = "DOCUMENT_CREATED",
    DOCUMENT_UPDATED = "DOCUMENT_UPDATED",
    DOCUMENT_SUBMITTED = "DOCUMENT_SUBMITTED",
    DOCUMENT_APPROVED = "DOCUMENT_APPROVED",
    DOCUMENT_REJECTED = "DOCUMENT_REJECTED",
    DOCUMENT_OBSOLETED = "DOCUMENT_OBSOLETED",
    VERSION_UPLOADED = "VERSION_UPLOADED",
    SHARE_CREATED = "SHARE_CREATED",
    SHARE_REVOKED = "SHARE_REVOKED",
    DOCTYPE_CREATED = "DOCTYPE_CREATED",
    DOCTYPE_UPDATED = "DOCTYPE_UPDATED",
    DOCTYPE_DEACTIVATED = "DOCTYPE_DEACTIVATED",
    UNKNOWN = "UNKNOWN"
}

/**
 * Maps raw database action strings to the strict export enum.
 */
export function mapActionToExportEnum(rawAction: string): AuditExportAction {
    const actionMap: Record<string, AuditExportAction> = {
        "DMS.CREATE": AuditExportAction.DOCUMENT_CREATED,
        "DMS.UPDATE": AuditExportAction.DOCUMENT_UPDATED,
        "DMS.SUBMIT": AuditExportAction.DOCUMENT_SUBMITTED,
        "DMS.APPROVE": AuditExportAction.DOCUMENT_APPROVED,
        "DMS.REJECT": AuditExportAction.DOCUMENT_REJECTED,
        "DMS.OBSOLETE": AuditExportAction.DOCUMENT_OBSOLETED,
        "DMS.VERSION_CREATE": AuditExportAction.VERSION_UPLOADED,
        "DMS.SHARE_CREATE": AuditExportAction.SHARE_CREATED,
        "DMS.SHARE_REVOKE": AuditExportAction.SHARE_REVOKED,
        // Add more mappings as needed
    };

    return actionMap[rawAction] || AuditExportAction.UNKNOWN;
}

/**
 * Interface for the flattened CSV row.
 */
interface AuditExportRow {
    eventId: number;
    timestampUtc: string;
    tenantId: number;
    module: string;
    entityType: string;
    entityId: string;
    documentNumber: string; // Extracted from metadata if available
    action: string;
    previousState: string;
    newState: string;
    actorUserId: string;
    actorEmail: string;
    actorRole: string;
    ipAddress: string;
    metadataKey: string;
    metadataValue: string;
}

/**
 * Transform stream that takes AuditLog objects and outputs CSV rows.
 * Handles metadata flattening: 1 AuditLog -> N CSV Rows
 */
export class AuditLogExportStream extends Transform {
    private isFirstRow = true;

    constructor() {
        super({ objectMode: true });
    }

    _transform(chunk: any, encoding: string, callback: Function) {
        try {
            // 1. Base Data Extraction
            const baseRow: Partial<AuditExportRow> = {
                eventId: chunk.id,
                timestampUtc: chunk.createdAt.toISOString(),
                tenantId: chunk.tenantId,
                module: chunk.module || "DMS",
                entityType: chunk.entityType || "",
                entityId: chunk.entityId || "",
                action: mapActionToExportEnum(chunk.action),
                actorUserId: chunk.actor?.id?.toString() || "SYSTEM",
                actorEmail: chunk.actor?.email || "",
                actorRole: "UNKNOWN", // In a real system, we'd join user roles, but for now we leave strictly valid fields
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

            // Extract common metadata fields to main columns
            if (metadata.documentNumber) baseRow.documentNumber = String(metadata.documentNumber);
            if (metadata.fromStatus) baseRow.previousState = String(metadata.fromStatus);
            if (metadata.toStatus) baseRow.newState = String(metadata.toStatus);

            // 3. Header Generation (Only once)
            if (this.isFirstRow) {
                const header = [
                    "eventId", "timestampUtc", "tenantId", "module", "entityType", "entityId",
                    "documentNumber", "action", "previousState", "newState",
                    "actorUserId", "actorEmail", "actorRole", "ipAddress",
                    "metadataKey", "metadataValue"
                ].join(",") + "\n";
                this.push(header);
                this.isFirstRow = false;
            }

            // 4. Flatten Metadata (KeyValue Pairs)
            // If metadata is empty, output at least one row with empty Key/Value
            const keys = Object.keys(metadata).filter(k =>
                !["documentNumber", "fromStatus", "toStatus"].includes(k) // Exclude promoted fields
            );

            if (keys.length === 0) {
                this.push(this.formatRow({ ...baseRow, metadataKey: "", metadataValue: "" }));
            } else {
                for (const key of keys) {
                    let value = metadata[key];
                    if (typeof value === 'object') value = JSON.stringify(value); // Last resort for nested objects

                    this.push(this.formatRow({
                        ...baseRow,
                        metadataKey: key,
                        metadataValue: String(value)
                    }));
                }
            }

            callback();
        } catch (error) {
            callback(error);
        }
    }

    private formatRow(row: Partial<AuditExportRow>): string {
        const columns = [
            row.eventId,
            row.timestampUtc,
            row.tenantId,
            row.module,
            row.entityType,
            row.entityId,
            row.documentNumber,
            row.action,
            row.previousState,
            row.newState,
            row.actorUserId,
            row.actorEmail,
            row.actorRole,
            row.ipAddress,
            row.metadataKey,
            this.escapeCsv(row.metadataValue || "")
        ];
        return columns.join(",") + "\n";
    }

    private escapeCsv(value: string): string {
        if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
