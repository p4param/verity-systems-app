
"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Loader2, MessageSquare, Send } from "lucide-react"

interface Comment {
    id: string
    content: string
    createdAt: string
    user: {
        fullName: string
    }
}

interface DocumentCommentsProps {
    documentId: string
}

export function DocumentComments({ documentId, readOnly = false }: { documentId: string, readOnly?: boolean }) {
    const { fetchWithAuth, user } = useAuth()
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const loadComments = useCallback(async () => {
        try {
            setLoading(true)
            const data = await fetchWithAuth<Comment[]>(`/api/secure/dms/documents/${documentId}/comments`)
            setComments(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error("Failed to load comments", err)
            setComments([])
        } finally {
            setLoading(false)
        }
    }, [documentId, fetchWithAuth])

    useEffect(() => {
        loadComments()
    }, [loadComments])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        setSubmitting(true)
        try {
            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/comments`, {
                method: "POST",
                body: JSON.stringify({ content: newComment })
            })
            setNewComment("")
            await loadComments()
        } catch (err: any) {
            alert(err.message || "Failed to post comment")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full max-h-[500px]">
            <div className="p-3 border-b flex items-center gap-2 font-medium text-sm text-muted-foreground bg-muted/20">
                <MessageSquare size={14} />
                Comments ({comments.length})
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                        <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                        {!readOnly && <p className="text-xs text-muted-foreground">Start the discussion below.</p>}
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {comment.user?.fullName?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-foreground">{comment.user?.fullName || "Unknown User"}</span>
                                    <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t bg-card mt-auto">
                {readOnly ? (
                    <div className="text-center text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                        Commenting is disabled for this document status.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Add a comment..."
                                className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={submitting || !newComment.trim()}
                                className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
