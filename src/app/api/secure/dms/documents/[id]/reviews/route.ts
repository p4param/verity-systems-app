
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { ReviewService } from "@/lib/dms/services/ReviewService";

/**
 * GET /api/secure/dms/documents/[id]/reviews
 * Retrieves review status for a document.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await requirePermission(req, "DMS_VIEW");
        // View permission is enough to see reviews? Yes.

        const reviews = await ReviewService.getReviews(id, user.tenantId);
        return NextResponse.json(reviews);
    } catch (error: any) {
        return handleApiError(error);
    }
}
