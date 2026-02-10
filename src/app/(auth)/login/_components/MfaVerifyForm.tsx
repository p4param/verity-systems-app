"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"

interface MfaVerifyFormProps {
    onCancel: () => void
}

export function MfaVerifyForm({ onCancel }: MfaVerifyFormProps) {
    const { verifyMfa } = useAuth()
    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [isRecovery, setIsRecovery] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            await verifyMfa(code)
        } catch (err: any) {
            const msg = err.message || "Verification failed"
            if (msg.toLowerCase().includes("expired")) {
                setError("Session expired. Please log in again.")
            } else {
                setError(msg)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
            <div className="p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        {isRecovery
                            ? "Enter one of your emergency recovery codes."
                            : "Enter the code from your authenticator app."}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded bg-red-100 border border-red-400 text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="mfaCode"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {isRecovery ? "Recovery Code" : "Verification Code"}
                        </label>
                        <input
                            type="text"
                            id="mfaCode"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder={isRecovery ? "abcdef1234" : "123456"}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            required
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                        {loading ? "Verifying..." : "Verify"}
                    </button>

                    <div className="flex flex-col space-y-2 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRecovery(!isRecovery)
                                setCode("")
                                setError("")
                            }}
                            className="text-sm text-primary hover:underline font-medium"
                        >
                            {isRecovery
                                ? "Use Authenticator App"
                                : "I lost my device / Use Recovery Code"}
                        </button>

                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Back to Login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
