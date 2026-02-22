import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { LegalHoldService } from "@/services/dms/legal-hold-service";

const LEGAL_HOLD_RELEASE = "LEGAL_HOLD_RELEASE";

/**
 * POST /api/secure/dms/legal-holds/[id]/release
 *
 * Releases an active legal hold.
 * After release, each affected document's isUnderLegalHold flag is
 * recalculated — only cleared if NO other active hold still applies.
 *
 * tenantId is ALWAYS resolved from the authenticated session.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requirePermission(req, LEGAL_HOLD_RELEASE);
        const { id: holdId } = await params;

        const result = await LegalHoldService.releaseHold(holdId, user.tenantId, user);

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return handleApiError(error);
    }
}
