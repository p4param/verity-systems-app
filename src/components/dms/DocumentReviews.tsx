
"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"

interface Review {
    id: string
    reviewerUserId: number
    stageNumber: number
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
    reviewedAt: string | null
    comment: string | null
    reviewer: {
        id: number
        fullName: string
        email: string
    }
}

interface DocumentReviewsProps {
    documentId: string
    currentUserId?: number
    onReviewActionComplete?: () => void
}

export function DocumentReviews({ documentId, currentUserId, onReviewActionComplete }: DocumentReviewsProps) {
    const { fetchWithAuth } = useAuth()
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const loadReviews = useCallback(async () => {
        try {
            setLoading(true)
            const data = await fetchWithAuth<Review[]>(`/api/secure/dms/documents/${documentId}/reviews`)
            setReviews(data)
        } catch (err: any) {
            setError(err.message || "Failed to load reviews")
        } finally {
            setLoading(false)
        }
    }, [documentId, fetchWithAuth])

    useEffect(() => {
        loadReviews()
    }, [loadReviews])

    const handleAction = async (action: "approve" | "reject", comment?: string) => {
        try {
            setActionLoading(action)
            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/workflow`, {
                method: "POST",
                body: JSON.stringify({ action, comment })
            })
            // Refresh reviews & Notify parent
            await loadReviews()
            if (onReviewActionComplete) onReviewActionComplete()
        } catch (err: any) {
            alert(err.message || "Review action failed")
        } finally {
            setActionLoading(null)
        }
    }

    if (loading) {
        return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
    }

    if (error) {
        return <div className="p-4 text-destructive bg-destructive/10 rounded">{error}</div>
    }

    if (reviews.length === 0) {
        return <div className="p-4 text-center text-muted-foreground italic text-sm">No reviews active.</div>
    }

    // Group by Stage
    const stages = reviews.reduce((acc, review) => {
        const stage = review.stageNumber
        if (!acc[stage]) acc[stage] = []
        acc[stage].push(review)
        return acc
    }, {} as Record<number, Review[]>)

    return (
        <div className="space-y-4">
            {Object.keys(stages).sort().map((stageStr) => {
                const stage = parseInt(stageStr)
                const stageReviews = stages[stage]

                return (
                    <div key={stage} className="border rounded-md p-3 bg-card">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Stage {stage}</h4>
                        <div className="space-y-2">
                            {stageReviews.map((review) => {
                                const isMyReview = currentUserId === review.reviewerUserId
                                const isPending = review.status === "PENDING"

                                return (
                                    <div key={review.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {/* Avatar / Name */}
                                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                {review.reviewer.fullName.charAt(0)}
                                            </div>
                                            <div className="text-sm">
                                                <div className="font-medium">{review.reviewer.fullName}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    {review.status === "APPROVED" && <span className="text-green-600 flex items-center gap-1"><CheckCircle size={10} /> Approved</span>}
                                                    {review.status === "REJECTED" && <span className="text-red-600 flex items-center gap-1"><XCircle size={10} /> Rejected</span>}
                                                    {review.status === "PENDING" && <span className="text-orange-600 flex items-center gap-1"><Clock size={10} /> Pending</span>}
                                                    {review.status === "CANCELLED" && <span className="text-gray-500 flex items-center gap-1"><AlertCircle size={10} /> Cancelled</span>}

                                                    {review.reviewedAt && (
                                                        <span>• {new Date(review.reviewedAt).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions for Reviewer */}
                                        {isMyReview && isPending && (
                                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                                <button
                                                    onClick={() => {
                                                        const c = prompt("Optional Comment for Approval:")
                                                        handleAction("approve", c || undefined)
                                                    }}
                                                    disabled={!!actionLoading}
                                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded shadow-sm disabled:opacity-50"
                                                >
                                                    {actionLoading === "approve" ? <Loader2 className="animate-spin w-3 h-3" /> : <CheckCircle className="w-3 h-3 mr-1 inline" />}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const c = prompt("Reason for Rejection (Required):")
                                                        if (c) handleAction("reject", c)
                                                    }}
                                                    disabled={!!actionLoading}
                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded shadow-sm disabled:opacity-50"
                                                >
                                                    {actionLoading === "reject" ? <Loader2 className="animate-spin w-3 h-3" /> : <XCircle className="w-3 h-3 mr-1 inline" />}
                                                    Reject
                                                </button>
                                            </div>
                                        )}

                                        {/* Display Comment if any */}
                                        {!isPending && review.comment && (
                                            <div className="text-xs text-muted-foreground italic border-l-2 pl-2 mt-1 sm:mt-0 sm:ml-4 max-w-xs truncate" title={review.comment}>
                                                "{review.comment}"
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
