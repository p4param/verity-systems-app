
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { RevisionService } from "@/services/dms/revision-service";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { z } from "zod";

/**
 * POST /api/secure/dms/documents/[id]/revise
 * 
 * Creates a new revision of the specified document.
 * 
 * Rules:
 * - Document must be APPROVED.
 * - User must have WRITE access.
 * - Creates a new document in DRAFT state.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(req);
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
        }

        // Use RevisionService to handle the transaction-safe revision logic
        const newRevision = await RevisionService.reviseDocument({
            documentId: id,
            tenantId: user.tenantId, // Trusting the user's tenant context from auth
            user
        });

        return NextResponse.json(newRevision, { status: 201 });

    } catch (error: any) {
        // Intercept Domain Violation for Superseded
        if (error.message && error.message.includes("already been superseded")) {
            return NextResponse.json({
                error: {
                    code: "DOCUMENT_ALREADY_SUPERSEDED",
                    message: error.message
                }
            }, { status: 409 });
        }
        return handleApiError(error);
    }
}
