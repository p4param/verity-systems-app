
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { AcknowledgementService } from "@/lib/dms/services/AcknowledgementService";
import { requireAuth } from "@/lib/auth/auth-guard";

/**
 * GET /api/secure/dms/documents/[id]/acknowledgements
 * 
 * Lists acknowledgements (Admin/Creator view) OR checks current user status?
 * Let's list all for simplicity if user has permission.
 * Or maybe just return current user's status if ?my-status=true
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check query params for mode?
        const url = new URL(req.url);
        const myStatus = url.searchParams.get("myStatus");

        if (myStatus === "true") {
            const user = await requireAuth(req);
            // AcknowledgementService.getAcknowledgementStatus not implemented yet?
            // I implemented 'getForDocument' and 'create'.
            // Let's implement 'getForUser' in Service or filter here.
            // AcknowledgementService.getAcknowledgements returns all. We can filter.
            const acks = await AcknowledgementService.getAcknowledgements(id, user.tenantId);
            const myAck = acks.find(a => a.userId === user.sub);
            return NextResponse.json({ acknowledged: !!myAck, details: myAck || null });
        }

        const user = await requirePermission(req, "DMS_VIEW");
        const acknowledgements = await AcknowledgementService.getAcknowledgements(id, user.tenantId);
        return NextResponse.json(acknowledgements);
    } catch (error: any) {
        return handleApiError(error);
    }
}

/**
 * POST /api/secure/dms/documents/[id]/acknowledgements
 * 
 * Creates an acknowledgement for the current user.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // User must be able to view to acknowledge.
        // And usually generic "DMS_DOCUMENT_ACKNOWLEDGE" permission?
        // Let's assume generic read access implies ability to acknowledge if required.
        const user = await requirePermission(req, "DMS_VIEW");

        const result = await AcknowledgementService.acknowledge(id, user.tenantId, user);
        return NextResponse.json(result);
    } catch (error: any) {
        return handleApiError(error);
    }
}
