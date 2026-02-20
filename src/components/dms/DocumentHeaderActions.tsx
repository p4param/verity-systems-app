"use client"

import React, { useState } from "react"
import {
    CheckCircle,
    XCircle,
    Send,
    RotateCcw,
    Loader2,
    Edit3,
    Archive
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { getAvailableWorkflowActions, UiWorkflowAction } from "@/lib/dms/ui-logic"
import { RejectDocumentModal } from "./RejectDocumentModal"
import { ReviewerSelectionModal } from "./ReviewerSelectionModal"

interface DocumentHeaderActionsProps {
    document: {
        id: string
        status: string
        effectiveStatus: string
        createdById: number
        currentVersion?: {
            id: string
            contentMode?: "FILE" | "INLINE"
            contentJson?: any | null
        }
        effectivePermissions?: string[]
    }
    onSuccess: () => void
}

export function DocumentHeaderActions({ document, onSuccess }: DocumentHeaderActionsProps) {
    const { fetchWithAuth, user } = useAuth()
    const [loadingAction, setLoadingAction] = useState<string | null>(null)
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

    // Helper to execute workflow transition
    const executeWorkflow = async (action: string, comment?: string, reviewers?: { userId: number, stage: number }[]) => {
        // Intercept REJECT action
        if (action === "reject" && !comment) {
            setIsRejectModalOpen(true)
            return
        }

        // Intercept SUBMIT action for Reviewer Selection (if not already coming from modal)
        if (action === "submit" && !reviewers && !loadingAction) { // !loadingAction check to avoid recursion if we were clever, but here we just open modal
            // Wait, if we just call executeWorkflow("submit") from button, we open modal.
            // If we call from modal, we pass reviewers (possibly empty).
            // But how to distinguish? 
            // We can just set state and return.
            setIsReviewModalOpen(true)
            return
        }

        try {
            setLoadingAction(action)

            if (action === "revise") {
                const newDoc = await fetchWithAuth(`/api/secure/dms/documents/${document.id}/revise`, {
                    method: "POST"
                })
                // fetchWithAuth returns parsed JSON, so we use it directly
                if (newDoc.id) {
                    window.location.href = `/dms/documents/${newDoc.id}`
                    return
                }
            }

            await fetchWithAuth(`/api/secure/dms/documents/${document.id}/workflow`, {
                method: "POST",
                body: JSON.stringify({ action, comment, reviewers })
            })
            onSuccess()
        } catch (err: any) {
            alert(err.message || "Workflow action failed")
        } finally {
            setLoadingAction(null)
        }
    }

    // 1. Get User Permissions (Prefer Effective Permissions from Folder ACLs)
    const userPermissions = document.effectivePermissions || user?.permissions || []

    // 2. Compute Available Actions
    const isCreator = (user?.id === document.createdById) || (user?.sub === document.createdById);

    // NEW LOGIC: Check for Superseded State
    const supersededBy = (document as any).supersededBy;
    const isSuperseded = document.effectiveStatus === "APPROVED" && !!supersededBy;

    const availableActions = getAvailableWorkflowActions(
        document.effectiveStatus,
        userPermissions,
        isCreator,
        isSuperseded // Pass the new parameter
    )

    // Filter out "revise" if superseded
    const filteredActions = availableActions.filter(a => {
        if (isSuperseded && a.action === "revise") return false;
        return true;
    });

    if (filteredActions.length === 0 && !isSuperseded) return null

    // Helper to render icon
    const getIcon = (action: string) => {
        switch (action) {
            case "submit": return <Send size={16} />
            case "approve": return <CheckCircle size={16} />
            case "reject": return <XCircle size={16} />
            case "revise": return <Edit3 size={16} />
            case "obsolete": return <Archive size={16} />
            case "withdraw": return <RotateCcw size={16} />
            default: return <RotateCcw size={16} />
        }
    }

    // Helper to get color classes
    const getVariantClasses = (variant: UiWorkflowAction["variant"]) => {
        switch (variant) {
            case "primary": return "bg-blue-600 hover:bg-blue-700 text-white"
            case "success": return "bg-green-600 hover:bg-green-700 text-white"
            case "danger": return "bg-red-600 hover:bg-red-700 text-white"
            case "info": return "bg-sky-600 hover:bg-sky-700 text-white"
            case "secondary": return "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
            default: return "bg-gray-600 text-white"
        }
    }

    return (
        <>
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Render Superseded Badge if applicable */}
                {isSuperseded && (
                    <a
                        href={`/dms/documents/${supersededBy.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200 transition-colors"
                        title={`Go to Revision ${supersededBy.documentNumber}`}
                    >
                        <Edit3 size={16} className="text-purple-600" />
                        <span>Superseded by {supersededBy.documentNumber}</span>
                    </a>
                )}

                {filteredActions.map((action) => (
                    <button
                        key={action.action}
                        onClick={() => executeWorkflow(action.action)}
                        disabled={!!loadingAction || (action.action === "submit" && !document.currentVersion)}
                        className={`
                            inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors shadow-sm
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${getVariantClasses(action.variant)}
                        `}
                        title={
                            action.action === "submit" && !document.currentVersion
                                ? "Upload a version first"
                                : action.label
                        }
                    >
                        {loadingAction === action.action ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            getIcon(action.action)
                        )}
                        <span>{action.label}</span>
                    </button>
                ))}
            </div>

            <RejectDocumentModal
                isOpen={isRejectModalOpen}
                onClose={() => setIsRejectModalOpen(false)}
                onConfirm={async (comment) => {
                    await executeWorkflow("reject", comment)
                }}
            />

            <ReviewerSelectionModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                onConfirm={async (reviewers) => {
                    // Pass reviewers to executeWorkflow. 
                    // IMPORTANT: We must NOT recurse into opening modal again.
                    // Our logic in executeWorkflow checks (!reviewers). 
                    // If we pass [], ![] is false. TRUE. 
                    // Wait, ![] is false in JS? 
                    // Boolean([]) is true. ![] is false.
                    // So we are safe.
                    // But if user cancels? We just close.
                    // If user confirms with empty list [], we pass [].
                    await executeWorkflow("submit", undefined, reviewers)
                }}
            />
        </>
    )
}


