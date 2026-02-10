"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"

type Status = "idle" | "loading" | "success" | "error"

function getPasswordStrength(password: string) {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) return { label: "Weak", color: "text-red-600" }
    if (score === 3) return { label: "Medium", color: "text-yellow-600" }
    return { label: "Strong", color: "text-green-600" }
}

export default function ChangePasswordPage() {
    const { fetchWithAuth, logout } = useAuth()

    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [status, setStatus] = useState<Status>("idle")
    const [message, setMessage] = useState("")

    const strength = getPasswordStrength(newPassword)
    const mismatch =
        newPassword.length > 0 &&
        confirmPassword.length > 0 &&
        newPassword !== confirmPassword

    const isSubmitDisabled =
        status === "loading" ||
        mismatch ||
        !currentPassword ||
        !newPassword

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault()
        setStatus("loading")
        setMessage("")

        try {
            await fetchWithAuth("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            })

            setStatus("success")
            setMessage("Password changed. Redirecting to login...")

            setTimeout(() => logout(), 1500)
        } catch (err) {
            setStatus("error")
            setMessage(
                err instanceof Error
                    ? err.message
                    : "Failed to change password"
            )
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
            <div className="w-full max-w-md bg-card shadow-lg rounded-xl p-8">
                <h1 className="text-xl font-bold mb-6 text-center">Change Password</h1>

                {status === "success" ? (
                    <div className="text-center py-4">
                        <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-green-600 font-medium">{message}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {status === "error" && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium">
                                {message}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            {newPassword && (
                                <p className={`text-xs ${strength.color} font-medium mt-1`}>
                                    Strength: {strength.label}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            {mismatch && (
                                <p className="text-xs text-destructive font-medium mt-1">
                                    Passwords do not match
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitDisabled}
                            className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-colors mt-2"
                        >
                            {status === "loading"
                                ? "Updating..."
                                : "Change Password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
