"use client"

import { useState } from "react"
import { Mail, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"

interface ResendInviteButtonProps {
    userId: number
    userEmail: string
    userStatus: string
}

export function ResendInviteButton({ userId, userEmail, userStatus }: ResendInviteButtonProps) {
    const { fetchWithAuth } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

    // Only show for PENDING users
    if (userStatus !== "PENDING") {
        return null
    }

    const handleResend = async () => {
        setIsLoading(true)
        setMessage(null)

        try {
            await fetchWithAuth(`/api/admin/users/${userId}/resend-invite`, {
                method: "POST"
            })

            setMessage({
                type: "success",
                text: "Invite link resent! Check the console for the activation link."
            })
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Failed to resend invite"
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-3">
            <button
                onClick={handleResend}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resending...
                    </>
                ) : (
                    <>
                        <Mail className="h-4 w-4" />
                        Resend Invite Link
                    </>
                )}
            </button>

            {message && (
                <div
                    className={`flex items-start gap-2 p-3 rounded-lg text-sm ${message.type === "success"
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                >
                    {message.type === "success" ? (
                        <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    ) : (
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    )}
                    <p>{message.text}</p>
                </div>
            )}
        </div>
    )
}
