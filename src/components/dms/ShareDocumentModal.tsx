"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Share2,
    Copy,
    Calendar,
    Trash2,
    Link as LinkIcon,
    ExternalLink,
    Check,
    Loader2,
    AlertCircle,
    CopyCheck
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Modal } from "@/components/ui/Modal"

interface ShareLink {
    id: string
    token: string
    expiresAt: string | null
    clickCount: number
    createdAt: string
}

interface Document {
    id: string
    title: string
    status: string
}

interface ShareDocumentModalProps {
    isOpen: boolean
    onClose: () => void
    document: Document
}

export function ShareDocumentModal({ isOpen, onClose, document }: ShareDocumentModalProps) {
    const { fetchWithAuth } = useAuth()
    const [shares, setShares] = useState<ShareLink[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [revokingId, setRevokingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [expiresAt, setExpiresAt] = useState("")
    const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const loadShares = useCallback(async () => {
        if (!isOpen) return
        try {
            setLoading(true)
            const data = await fetchWithAuth<ShareLink[]>(`/api/secure/dms/documents/${document.id}/shares`)
            setShares(data)
        } catch (err: any) {
            setError(err.message || "Failed to load share links")
        } finally {
            setLoading(false)
        }
    }, [isOpen, document.id, fetchWithAuth])

    useEffect(() => {
        loadShares()
    }, [loadShares])

    const handleCreateShare = async () => {
        try {
            setCreating(true)
            setError(null)

            const newShare = await fetchWithAuth<ShareLink>(`/api/secure/dms/documents/${document.id}/shares`, {
                method: "POST",
                body: JSON.stringify({
                    expiresAt: expiresAt || null
                })
            })

            setShares(prev => [newShare, ...prev])
            setLastCreatedToken(newShare.token)
            setExpiresAt("")
        } catch (err: any) {
            setError(err.message || "Failed to create share link")
        } finally {
            setCreating(false)
        }
    }

    const handleRevoke = async (id: string) => {
        try {
            setRevokingId(id)
            await fetchWithAuth(`/api/secure/dms/shares/${id}`, {
                method: "DELETE"
            })
            setShares(prev => prev.filter(s => s.id !== id))
        } catch (err: any) {
            alert(err.message || "Failed to revoke link")
        } finally {
            setRevokingId(null)
        }
    }

    const copyToClipboard = (token: string, id: string) => {
        const url = `${window.location.origin}/share/${token}`
        navigator.clipboard.writeText(url)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const isApproved = document.status === "APPROVED"

    if (!isApproved && isOpen) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Access Restricted">
                <div className="flex flex-col items-center gap-4 text-center p-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                        <AlertCircle size={32} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">Cannot Share This Document</h3>
                        <p className="text-sm text-muted-foreground">
                            Only documents with <strong>APPROVED</strong> status can be shared externally.
                            Current status is <strong>{document.status}</strong>.
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-primary px-6 py-2 rounded-md">
                        Understood
                    </button>
                </div>
            </Modal>
        )
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Share: ${document.title}`}
            footer={
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-md"
                >
                    Close
                </button>
            }
        >
            <div className="space-y-6">
                {/* Create Section */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 font-medium text-sm">
                        <LinkIcon size={16} className="text-primary" />
                        <span>Create Secure Link</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase">Expiry Date (Optional)</label>
                            <input
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="w-full px-3 py-2 bg-background border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={handleCreateShare}
                                disabled={creating}
                                className="w-full bg-primary text-primary-foreground h-[42px] px-4 rounded-md text-sm font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                {creating ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                                {creating ? "Creating..." : "Generate Link"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Last Created Feedback */}
                {lastCreatedToken && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md animate-in slide-in-from-top-2">
                        <p className="text-[11px] font-bold text-green-700 uppercase mb-2">Success! Link Generated:</p>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white border border-green-200 px-3 py-1.5 rounded text-xs font-mono truncate text-green-800">
                                {window.location.origin}/share/{lastCreatedToken}
                            </div>
                            <button
                                onClick={() => copyToClipboard(lastCreatedToken, "new")}
                                className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                                {copiedId === "new" ? <CopyCheck size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Existing Shares List */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Active Links</h4>

                    <div className="border rounded-md divide-y max-h-[240px] overflow-y-auto">
                        {loading && shares.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-primary" />
                                <span className="text-xs">Loading shares...</span>
                            </div>
                        ) : shares.length === 0 ? (
                            <div className="p-8 text-center text-xs text-muted-foreground italic">
                                No active share links for this document.
                            </div>
                        ) : (
                            shares.map((share) => (
                                <div key={share.id} className="p-3 flex items-center justify-between group hover:bg-muted/30 transition-colors">
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground truncate">
                                            <LinkIcon size={12} />
                                            ...{share.token.slice(-8)}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <ExternalLink size={10} /> {share.clickCount} clicks
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={10} />
                                                {share.expiresAt
                                                    ? `Expires ${new Date(share.expiresAt).toLocaleDateString()}`
                                                    : "No expiry"
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => copyToClipboard(share.token, share.id)}
                                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                            title="Copy Link"
                                        >
                                            {copiedId === share.id ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                                        </button>
                                        <button
                                            onClick={() => handleRevoke(share.id)}
                                            disabled={revokingId === share.id}
                                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            title="Revoke Link"
                                        >
                                            {revokingId === share.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
            </div>
        </Modal>
    )
}
