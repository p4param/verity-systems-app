
"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Loader2, CheckCircle, BookOpen } from "lucide-react"

interface AcknowledgementStatus {
    acknowledged: boolean
    details: {
        acknowledgedAt: string
    } | null
}

interface DocumentAcknowledgementProps {
    documentId: string
    documentStatus: string
    currentVersionId?: string
}

export function DocumentAcknowledgement({ documentId, documentStatus, currentVersionId }: DocumentAcknowledgementProps) {
    const { fetchWithAuth } = useAuth()
    const [status, setStatus] = useState<AcknowledgementStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    const loadStatus = useCallback(async () => {
        if (documentStatus !== "APPROVED" || !currentVersionId) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const data = await fetchWithAuth<AcknowledgementStatus>(`/api/secure/dms/documents/${documentId}/acknowledgements?myStatus=true`)
            setStatus(data)
        } catch (err) {
            console.error("Failed to load ack status", err)
        } finally {
            setLoading(false)
        }
    }, [documentId, documentStatus, currentVersionId, fetchWithAuth])

    useEffect(() => {
        loadStatus()
    }, [loadStatus])

    const handleAcknowledge = async () => {
        setSubmitting(true)
        try {
            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/acknowledgements`, {
                method: "POST"
            })
            await loadStatus()
        } catch (err: any) {
            alert(err.message || "Failed to acknowledge document")
        } finally {
            setSubmitting(false)
        }
    }

    if (documentStatus !== "APPROVED" || !currentVersionId) return null

    if (loading) return null // Or skeleton

    if (status?.acknowledged) {
        return (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-3 text-green-800 animate-in fade-in">
                <CheckCircle size={20} className="text-green-600" />
                <div className="text-sm">
                    <span className="font-medium">Acknowledged</span>
                    <span className="text-green-600/80 ml-2 text-xs">
                        on {new Date(status.details!.acknowledgedAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3 animate-in fade-in">
            <div className="flex items-start gap-3">
                <BookOpen size={20} className="text-blue-600 mt-0.5" />
                <div>
                    <h4 className="font-semibold text-blue-900 text-sm">Acknowledgement Required</h4>
                    <p className="text-xs text-blue-700 mt-1">
                        Please confirm that you have read and understood this document.
                    </p>
                </div>
            </div>
            <button
                onClick={handleAcknowledge}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                I Acknowledge
            </button>
        </div>
    )
}
