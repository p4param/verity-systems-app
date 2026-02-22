import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { LegalHoldService } from "@/services/dms/legal-hold-service";

const LEGAL_HOLD_VIEW = "LEGAL_HOLD_VIEW";

/**
 * GET /api/secure/dms/legal-holds/[id]/targets
 *
 * Returns the list of targets attached to the specified legal hold.
 * Tenant isolation enforced — only targets for the authenticated tenant are returned.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requirePermission(req, LEGAL_HOLD_VIEW);
        const { id: holdId } = await params;

        const targets = await LegalHoldService.listTargets(holdId, user.tenantId);

        return NextResponse.json({ success: true, data: targets });
    } catch (error) {
        return handleApiError(error);
    }
}
