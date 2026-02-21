import { DocumentStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { PdfService } from "@/services/dms/pdf-service";

export class ApprovalService {
    /**
     * finalizeDocumentApproval
     * 
     * Centralized logic for finalizing document approval.
     * Includes Rule 4: PDF Snapshot generation for STRUCTURED documents.
     */
    static async finalizeDocumentApproval(
        tx: any,
        documentId: string,
        tenantId: number,
        actorUserId: number
    ) {
        // 1. Fetch current version and document
        const doc = await tx.document.findUnique({
            where: { id: documentId, tenantId },
            include: {
                currentVersion: true
            }
        });

        if (!doc || !doc.currentVersion) {
            throw new Error(`Fatal: Document ${documentId} or its current version not found during approval.`);
        }

        const version = doc.currentVersion;

        // 2. Rule 4: PDF Snapshot Generation for STRUCTURED
        if (version.contentMode === "STRUCTURED") {
            if (!version.contentJson) {
                throw new Error(`Fatal: STRUCTURED document ${documentId} has no contentJson.`);
            }

            // Generate and upload PDF
            const storageKey = await PdfService.generateSnapshot({
                tenantId,
                documentId,
                versionId: version.id,
                contentJson: version.contentJson
            });

            // Update version with storageKey
            await tx.documentVersion.update({
                where: { id: version.id },
                data: { storageKey }
            });
        }

        // 3. Update Document Status
        await tx.document.update({
            where: { id: documentId },
            data: {
                status: DocumentStatus.APPROVED,
                updatedById: actorUserId,
                updatedAt: new Date()
            },
        });

        // 4. Audit Log
        await createAuditLog({
            tenantId,
            actorUserId,
            entityType: "DOCUMENT",
            entityId: documentId,
            action: "DMS.DOCUMENT_APPROVED",
            details: `Document APPROVED. Content Mode: ${version.contentMode}. ${version.contentMode === "STRUCTURED" ? "Generated PDF snapshot." : ""}`,
            module: "DMS"
        }, tx);

        return { success: true };
    }
}
