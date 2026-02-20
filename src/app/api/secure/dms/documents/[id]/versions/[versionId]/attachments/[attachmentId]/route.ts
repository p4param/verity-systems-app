import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { AttachmentService } from "@/services/dms/attachment-service";
import { StorageService } from "@/lib/dms/storage";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/secure/dms/documents/[id]/versions/[versionId]/attachments/[attachmentId]
 * 
 * Removes an attachment.
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string; versionId: string; attachmentId: string }> }
) {
    try {
        const { id, versionId, attachmentId } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_EDIT");

        const result = await AttachmentService.removeAttachment({
            tenantId: user.tenantId,
            documentId: id,
            versionId,
            attachmentId,
            user
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return handleApiError(error);
    }
}

/**
 * GET /api/secure/dms/documents/[id]/versions/[versionId]/attachments/[attachmentId]
 * 
 * Gets a signed download URL for an attachment.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string; versionId: string; attachmentId: string }> }
) {
    try {
        const { id, versionId, attachmentId } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_READ");

        const attachment = await prisma.documentVersionAttachment.findUnique({
            where: { id: attachmentId, tenantId: user.tenantId, versionId }
        });

        if (!attachment) {
            return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
        }

        const url = await StorageService.getDownloadUrl(attachment.storageKey, 3600, attachment.fileName);

        return NextResponse.json({ url });
    } catch (error: any) {
        return handleApiError(error);
    }
}
