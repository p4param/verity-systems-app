"use client"

import React, { useState } from "react"
import {
    Send,
    CheckCircle2,
    XCircle,
    Edit3,
    Archive,
    Loader2,
    RotateCcw
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { getAvailableWorkflowActions, UiWorkflowAction } from "@/lib/dms/ui-logic"

interface Document {
    id: string
    status: string
    effectiveStatus: string
    createdById: number
    effectivePermissions?: string[]
}

interface WorkflowActionsProps {
    document: Document
    onSuccess: () => void
}

export function DmsWorkflowActions({ document, onSuccess }: WorkflowActionsProps) {
    const { fetchWithAuth, user } = useAuth()
    const [processing, setProcessing] = useState(false)

    const handleAction = async (action: string) => {
        try {
            setProcessing(true)
            await fetchWithAuth(`/api/secure/dms/documents/${document.id}/workflow`, {
                method: "POST",
                body: JSON.stringify({ action })
            })
            onSuccess()
        } catch (err: any) {
            alert(err.message || "Action failed")
        } finally {
            setProcessing(false)
        }
    }

    // 1. Get User Permissions
    const userPermissions = document.effectivePermissions || user?.permissions || []

    // 2. Compute Available Actions
    const isCreator = user?.id === document.createdById || user?.sub === document.createdById;
    const actions = getAvailableWorkflowActions(document.effectiveStatus, userPermissions, isCreator)

    if (actions.length === 0) return null

    // Helper to render icon
    const getIcon = (action: string) => {
        switch (action) {
            case "submit": return <Send size={16} />
            case "approve": return <CheckCircle2 size={16} />
            case "reject": return <XCircle size={16} />
            case "revise": return <Edit3 size={16} />
            case "obsolete": return <Archive size={16} />
            default: return <RotateCcw size={16} />
        }
    }

    // Helper to get color classes
    const getVariantClasses = (variant: UiWorkflowAction["variant"]) => {
        switch (variant) {
            case "primary": return "bg-primary text-primary-foreground hover:bg-primary/90"
            case "success": return "bg-green-600 hover:bg-green-700 text-white"
            case "danger": return "bg-red-600 hover:bg-red-700 text-white"
            case "info": return "bg-sky-600 hover:bg-sky-700 text-white"
            case "secondary": return "bg-gray-600 hover:bg-gray-700 text-white"
            default: return "bg-secondary text-secondary-foreground"
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Workflow Actions
            </h3>

            <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                    <button
                        key={action.action}
                        onClick={() => handleAction(action.action)}
                        disabled={processing}
                        className={`
                            inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm
                            disabled:opacity-50 disabled:cursor-not-allowed active:scale-95
                            ${getVariantClasses(action.variant)}
                        `}
                    >
                        {processing ? <Loader2 size={16} className="animate-spin" /> : getIcon(action.action)}
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

