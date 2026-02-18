
"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Modal } from "@/components/ui/Modal"
import { Search, UserPlus, X, ChevronRight, Loader2, Users } from "lucide-react"

interface User {
    id: number
    fullName: string
    email: string
}

interface Reviewer {
    userId: number
    fullName: string
    email: string
    stage: number
}

interface ReviewerSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (reviewers: { userId: number; stage: number }[]) => Promise<void>
}

export function ReviewerSelectionModal({ isOpen, onClose, onConfirm }: ReviewerSelectionModalProps) {
    const { fetchWithAuth } = useAuth()
    const [searchQuery, setSearchQuery] = useState("")
    const [users, setUsers] = useState<User[]>([])
    const [selectedReviewers, setSelectedReviewers] = useState<Reviewer[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Load available users (Debounced or just load all for MVP?)
    // For MVP, loading all users might be fine if small.
    // Ideally, we search.
    useEffect(() => {
        if (!isOpen) return;

        const loadUsers = async () => {
            setLoadingUsers(true)
            try {
                // Assuming /api/users returns list of users for tenant
                // Or maybe we need a dedicated search endpoint.
                // Using /api/users for now (might be restricted to admin?)
                // If restricted, we might need a public "search users" endpoint or "colleagues" endpoint.
                // Let's try /api/users and fail gracefully if not allowed.
                // Filter users who have the DMS_DOCUMENT_APPROVE permission
                const data = await fetchWithAuth<User[]>("/api/users?permission=DMS_DOCUMENT_APPROVE")
                setUsers(data)
            } catch (err) {
                console.error("Failed to load users", err)
            } finally {
                setLoadingUsers(false)
            }
        }
        loadUsers()
    }, [isOpen, fetchWithAuth])

    // Filter users based on search
    const filteredUsers = users.filter(u =>
        (u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
        !selectedReviewers.some(r => r.userId === u.id)
    )

    const addReviewer = (user: User) => {
        // Default stage to max stage + 1? Or Stage 1?
        // Let's default to Stage 1.
        setSelectedReviewers(prev => [...prev, {
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
            stage: 1
        }])
    }

    const removeReviewer = (userId: number) => {
        setSelectedReviewers(prev => prev.filter(r => r.userId !== userId))
    }

    const updateStage = (userId: number, newStage: number) => {
        if (newStage < 1) return;
        setSelectedReviewers(prev => prev.map(r =>
            r.userId === userId ? { ...r, stage: newStage } : r
        ))
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            await onConfirm(selectedReviewers.map(r => ({ userId: r.userId, stage: r.stage })))
            onClose()
        } catch (err) {
            console.error(err)
            // Error handling usually in parent, but we handle submitting state here
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Start Review Cycle"
            footer={
                <div className="flex justify-between w-full">
                    <button onClick={onClose} disabled={submitting} className="btn-secondary">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="btn-primary"
                    >
                        {submitting ? <Loader2 className="animate-spin mr-2" /> : <Users className="mr-2" size={16} />}
                        {selectedReviewers.length === 0 ? "Submit (Standard)" : `Start Review (${selectedReviewers.length})`}
                    </button>
                </div>
            }
        >
            <div className="space-y-6 h-[400px] flex flex-col">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-hidden">

                    {/* Left: User Search */}
                    <div className="flex flex-col border rounded-md h-full">
                        <div className="p-3 border-b bg-muted/20">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-1">
                            {loadingUsers ? (
                                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
                            ) : filteredUsers.length === 0 ? (
                                <p className="text-center text-xs text-muted-foreground py-4">No users found.</p>
                            ) : (
                                filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => addReviewer(user)}
                                        className="w-full text-left p-2 hover:bg-muted rounded-md flex items-center justify-between group transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{user.fullName}</p>
                                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                        </div>
                                        <UserPlus size={16} className="text-muted-foreground group-hover:text-primary" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right: Selected Reviewers */}
                    <div className="flex flex-col border rounded-md h-full">
                        <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
                            <h4 className="text-sm font-medium text-muted-foreground">Selected Reviewers</h4>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {selectedReviewers.length}
                            </span>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {selectedReviewers.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                                    <Users size={32} className="mb-2 opacity-20" />
                                    <p className="text-xs">Select users from the list to assign them as reviewers.</p>
                                </div>
                            ) : (
                                // Group by Stage or just list? List with stage input is simpler.
                                selectedReviewers.sort((a, b) => a.stage - b.stage).map(reviewer => (
                                    <div key={reviewer.userId} className="p-2 border rounded-md bg-card shadow-sm flex items-center gap-2 animate-in slide-in-from-left-1">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{reviewer.fullName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-muted-foreground">Stage:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="5"
                                                    value={reviewer.stage}
                                                    onChange={(e) => updateStage(reviewer.userId, parseInt(e.target.value) || 1)}
                                                    className="w-12 h-6 text-xs px-1 border rounded text-center focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeReviewer(reviewer.userId)}
                                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground bg-blue-50 text-blue-700 p-2 rounded border border-blue-100">
                    <strong>Tip:</strong> Reviewers in Stage 1 will be notified immediately. Reviewers in Stage 2 will be notified only after Stage 1 is complete.
                </p>
            </div>
        </Modal>
    )
}
