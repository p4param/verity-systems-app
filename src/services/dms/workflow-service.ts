
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { WorkflowAction } from "@/lib/dms/transition-matrix";
import { transitionDocumentStatus } from "@/lib/dms/workflowEngine";
import { ReviewService } from "@/lib/dms/services/ReviewService";

export class DmsWorkflowService {
    /**
     * Executes a DMS workflow action via the unified Workflow Engine.
     */
    static async executeAction(
        documentId: string,
        tenantId: number,
        action: WorkflowAction,
        user: AuthUser,
        comment?: string,
        reviewers?: { userId: number; stage: number }[]
    ) {
        // V2 Workflow Interception
        // If action is submit AND we have reviewers, we initialize the review process.
        if (action === "submit" && reviewers && reviewers.length > 0) {
            return await ReviewService.startReviewProcess(documentId, tenantId, user, reviewers);
        }

        // 🛡️ Logic/Enforcement is delegated to the Engine.
        // Service layer can handle orchestrations or additional non-transactional triggers here later.
        return await transitionDocumentStatus(
            prisma,
            documentId,
            tenantId,
            action,
            user,
            comment
        );
    }
}
