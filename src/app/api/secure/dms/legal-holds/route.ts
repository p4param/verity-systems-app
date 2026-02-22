import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { LegalHoldService } from "@/services/dms/legal-hold-service";

const LEGAL_HOLD_CREATE = "LEGAL_HOLD_CREATE";
const LEGAL_HOLD_VIEW = "LEGAL_HOLD_VIEW";

/**
 * GET /api/secure/dms/legal-holds
 * List all legal holds for the authenticated tenant.
 */
export async function GET(req: Request) {
    try {
        const user = await requirePermission(req, LEGAL_HOLD_VIEW);
        const url = new URL(req.url);
        const activeOnly = url.searchParams.get("activeOnly");

        const holds = await LegalHoldService.listHolds(
            user.tenantId,
            activeOnly !== null ? activeOnly === "true" : undefined
        );

        return NextResponse.json({ success: true, data: holds });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * POST /api/secure/dms/legal-holds
 * Create a new legal hold (does not attach targets).
 *
 * Body: { name, reason, description?, startDate, endDate? }
 */
export async function POST(req: Request) {
    try {
        const user = await requirePermission(req, LEGAL_HOLD_CREATE);
        const body = await req.json();

        const { name, reason, description, startDate, endDate } = body;

        if (!name || !reason || !startDate) {
            return NextResponse.json(
                { success: false, error: { code: "VALIDATION_ERROR", message: "name, reason, and startDate are required." } },
                { status: 400 }
            );
        }

        const hold = await LegalHoldService.createHold({
            tenantId: user.tenantId,
            name,
            reason,
            description,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            user
        });

        return NextResponse.json({ success: true, data: hold }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}
