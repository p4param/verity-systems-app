import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { AttachmentService } from "@/services/dms/attachment-service";

/**
 * POST /api/secure/dms/documents/[id]/versions/[versionId]/attachments
 * 
 * Uploads a supporting attachment.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    try {
        const { id, versionId } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_EDIT");

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const attachment = await AttachmentService.uploadAttachment({
            tenantId: user.tenantId,
            documentId: id,
            versionId,
            fileBuffer: buffer,
            originalFileName: file.name,
            mimeType: file.type,
            user
        });

        return NextResponse.json(attachment);
    } catch (error: any) {
        return handleApiError(error);
    }
}
