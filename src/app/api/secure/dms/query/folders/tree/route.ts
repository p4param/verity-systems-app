
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { DmsQueryService } from "@/services/dms/query-service";

export const dynamic = 'force-dynamic';

/**
 * GET /api/secure/dms/query/folders/tree
 * 
 * Returns a recursive tree of all folders for the tenant.
 */
export async function GET(req: Request) {
    try {
        // 1. Authenticate (Establish identity and tenant context)
        const user = await requirePermission(req, "DMS_FOLDER_READ");

        const tree = await DmsQueryService.getFolderTree(user.tenantId);
        return NextResponse.json(tree);
    } catch (error: any) {
        return handleApiError(error);
    }
}
