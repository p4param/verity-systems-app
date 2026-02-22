"use client"

import React, { useState, useEffect } from "react"
import { Shield, Search, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/button"

interface ApplyLegalHoldModalProps {
    isOpen: boolean
    onClose: () => void
    targetType: "DOCUMENT" | "FOLDER"
    targetId: string
    targetName: string
    onSuccess?: () => void
}

export function ApplyLegalHoldModal({
    isOpen,
    onClose,
    targetType,
    targetId,
    targetName,
    onSuccess
}: ApplyLegalHoldModalProps) {
    const { fetchWithAuth } = useAuth()
    const [holds, setHolds] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [attaching, setAttaching] = useState(false)
    const [search, setSearch] = useState("")

    useEffect(() => {
        if (isOpen) {
            loadHolds()
        }
    }, [isOpen])

    async function loadHolds() {
        try {
            setLoading(true)
            const response = await fetchWithAuth<any>("/api/secure/dms/legal-holds?activeOnly=true")
            // Handle both wrapped and unwrapped API responses
            const holdList = Array.isArray(response) ? response : (response?.data || [])
            setHolds(holdList)
        } catch (err) {
            console.error("Failed to load holds", err)
        } finally {
            setLoading(false)
        }
    }

    async function handleAttach(holdId: string) {
        try {
            setAttaching(true)
            const response = await fetchWithAuth<any>(`/api/secure/dms/legal-holds/${holdId}/attach`, {
                method: "POST",
                body: JSON.stringify({
                    targets: [{ targetType, targetId }]
                })
            })

            if (response.success) {
                onClose()
                if (onSuccess) onSuccess()
            }
        } catch (err: any) {
            alert(err.message || "Failed to attach hold")
        } finally {
            setAttaching(false)
        }
    }

    const filteredHolds = holds.filter(h =>
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.reason.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Apply Legal Hold"
        >
            <div className="space-y-4 py-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="text-sm">
                        <p className="font-semibold text-amber-900">Compliance Action</p>
                        <p className="text-amber-800">
                            Applying a legal hold to <strong>{targetName}</strong> ({targetType.toLowerCase()}) will prevent deletion and modification until the hold is released.
                        </p>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        className="w-full flex h-10 rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search active holds..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y bg-muted/30">
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground mt-2">Loading active holds...</p>
                        </div>
                    ) : filteredHolds.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm italic">
                            No matching active holds found.
                        </div>
                    ) : (
                        filteredHolds.map((hold) => (
                            <div key={hold.id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                <div className="min-w-0 flex-1 pr-4">
                                    <div className="font-medium text-sm truncate">{hold.name}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                        REASON: {hold.reason}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 shadow-sm shrink-0"
                                    disabled={attaching}
                                    onClick={() => handleAttach(hold.id)}
                                >
                                    {attaching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3.5 w-3.5 mr-1.5" />}
                                    Apply
                                </Button>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={attaching}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
