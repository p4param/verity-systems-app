
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { DmsWorkflowService } from "@/services/dms/workflow-service";

/**
 * POST /api/secure/dms/documents/[id]/workflow
 * 
 * Single entry point for DMS status transitions.
 * Logic and enforcement are delegated to the workflowEngine.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: documentId } = await params;
        const { action, comment, reviewers } = await req.json();

        // 1. Authenticate (Establish identity and tenant context)
        const user = await requirePermission(req, "DMS_VIEW");

        // 2. Execute Workflow Action (Engine handles permission and state logic)
        const updatedDocument = await DmsWorkflowService.executeAction(
            documentId,
            user.tenantId,
            action,
            user,
            comment,
            reviewers
        );

        return NextResponse.json(updatedDocument);
    } catch (error: any) {
        return handleApiError(error);
    }
}
