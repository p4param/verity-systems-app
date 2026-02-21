
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { VersionService } from "@/services/dms/version-service";

/**
 * POST /api/secure/dms/documents/[id]/structured
 * 
 * Saves structured JSON content for a document, creating a new version or updating the current draft version.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_EDIT");
        const body = await req.json();

        const version = await VersionService.saveStructuredVersion({
            tenantId: user.tenantId,
            documentId: id,
            contentJson: body.contentJson,
            user
        });

        return NextResponse.json(version);
    } catch (error: any) {
        return handleApiError(error);
    }
}
