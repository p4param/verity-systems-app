import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { LegalHoldService } from "@/services/dms/legal-hold-service";

const LEGAL_HOLD_ATTACH = "LEGAL_HOLD_ATTACH";

/**
 * POST /api/secure/dms/legal-holds/[id]/attach
 *
 * Attaches one or more targets to a legal hold and marks all affected
 * documents with isUnderLegalHold = true.
 *
 * Body: { targets: [{ targetType: "DOCUMENT"|"FOLDER"|"DOCUMENT_TYPE"|"TENANT", targetId: string }] }
 *
 * tenantId is ALWAYS resolved from the authenticated session — never from body.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requirePermission(req, LEGAL_HOLD_ATTACH);
        const { id: holdId } = await params;
        const body = await req.json();

        const { targets } = body as {
            targets: { targetType: string; targetId: string }[];
        };

        if (!Array.isArray(targets) || targets.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: "VALIDATION_ERROR", message: "targets array is required and must not be empty." } },
                { status: 400 }
            );
        }

        const VALID_TARGET_TYPES = ["DOCUMENT", "FOLDER", "DOCUMENT_TYPE", "TENANT"];
        for (const t of targets) {
            if (!VALID_TARGET_TYPES.includes(t.targetType)) {
                return NextResponse.json(
                    { success: false, error: { code: "VALIDATION_ERROR", message: `Invalid targetType: ${t.targetType}` } },
                    { status: 400 }
                );
            }
            if (!t.targetId) {
                return NextResponse.json(
                    { success: false, error: { code: "VALIDATION_ERROR", message: "Each target must have a targetId." } },
                    { status: 400 }
                );
            }
        }

        const result = await LegalHoldService.attachTargets({
            tenantId: user.tenantId,
            holdId,
            targets: targets as { targetType: "DOCUMENT" | "FOLDER" | "DOCUMENT_TYPE" | "TENANT"; targetId: string }[],
            user
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return handleApiError(error);
    }
}
