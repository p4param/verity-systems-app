
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { CommentService } from "@/lib/dms/services/CommentService";

/**
 * GET /api/secure/dms/documents/[id]/comments
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await requirePermission(req, "DMS_VIEW");

        const comments = await CommentService.getComments(id, user.tenantId);
        return NextResponse.json(comments);
    } catch (error: any) {
        return handleApiError(error);
    }
}

/**
 * POST /api/secure/dms/documents/[id]/comments
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await requirePermission(req, "DMS_VIEW");

        // Service enforces business rules (comment content, doc status).
        // Since DMS_DOCUMENT_COMMENT does not exist, we rely on DMS_VIEW access.

        const { content } = await req.json();

        const comment = await CommentService.addComment(id, user.tenantId, user, content);
        return NextResponse.json(comment);
    } catch (error: any) {
        return handleApiError(error);
    }
}
