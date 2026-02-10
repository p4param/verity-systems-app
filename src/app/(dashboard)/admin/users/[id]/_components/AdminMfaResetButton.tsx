"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"

interface AdminMfaResetButtonProps {
    userId: number
    userEmail: string
    mfaEnabled: boolean
}

export function AdminMfaResetButton({ userId, userEmail, mfaEnabled }: AdminMfaResetButtonProps) {
    const [loading, setLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const { fetchWithAuth } = useAuth()
    const router = useRouter()

    const handleReset = async () => {
        setLoading(true)
        try {
            await fetchWithAuth(`/api/admin/users/${userId}/mfa/reset`, {
                method: "POST"
            })
            alert("MFA has been reset manually. The user will be required to re-enroll on next login.")
            setShowConfirm(false)
            router.refresh()
        } catch (error: any) {
            alert(error.message || "Failed to reset MFA")
        } finally {
            setLoading(false)
        }
    }

    if (!mfaEnabled) {
        return (
            <button
                disabled
                className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded cursor-not-allowed"
            >
                MFA Not Enabled
            </button>
        )
    }

    if (showConfirm) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-card p-6 rounded-lg shadow-xl max-w-md w-full">
                    <h3 className="text-lg font-bold text-destructive mb-2">Warning: Destructive Action</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Are you sure you want to reset MFA for <strong>{userEmail}</strong>?
                    </p>
                    <ul className="list-disc pl-5 mb-4 text-sm text-muted-foreground space-y-1">
                        <li>User will be logged out immediately.</li>
                        <li>Existing backup codes will be deleted.</li>
                        <li>User MUST re-enroll on next login.</li>
                    </ul>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded shadow-sm"
                        >
                            {loading ? "Resetting..." : "Confirm Reset"}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-destructive bg-card border border-destructive/30 hover:bg-destructive/10 rounded shadow-sm transition-colors"
        >
            Reset MFA
        </button>
    )
}
