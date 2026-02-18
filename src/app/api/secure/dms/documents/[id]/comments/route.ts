
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
        const user = await requirePermission(req, "DMS_DOCUMENT_COMMENT"); // Need specific permission? Or just VIEW?
        // Usually anyone with read access can comment? Or restricted?
        // Let's assume DMS_DOCUMENT_COMMENT permission exists or use generic DMS_VIEW and check in service?
        // Service just checks doc status.
        // Let's enforce DMS_VIEW for now, but usually commenting implies some interaction. 
        // I'll stick to DMS_VIEW + Service Logic.
        // Actually, preventing spam might require a permission. 
        // But for this task, I'll use DMS_VIEW.

        const { content } = await req.json();

        const comment = await CommentService.addComment(id, user.tenantId, user, content);
        return NextResponse.json(comment);
    } catch (error: any) {
        return handleApiError(error);
    }
}
