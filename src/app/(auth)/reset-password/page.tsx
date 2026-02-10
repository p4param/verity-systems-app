"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

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


function ResetPasswordContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [status, setStatus] = useState<Status>("idle")
    const [message, setMessage] = useState("")

    if (!token) {
        return (
            <div className="p-8 text-center text-red-600">
                Invalid or missing reset token.
            </div>
        )
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setStatus("error")
            setMessage("Passwords do not match")
            return
        }

        setStatus("loading")
        setMessage("")

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    newPassword: password
                })
            })

            const data: { message?: string } = await res.json()

            if (!res.ok) {
                throw new Error(data.message || "Failed to reset password")
            }

            setStatus("success")
            setMessage("Password reset successfully. Redirecting to login...")

            setTimeout(() => {
                router.push("/login")
            }, 2000)
        } catch (err) {
            setStatus("error")
            setMessage(
                err instanceof Error
                    ? err.message
                    : "Something went wrong"
            )
        }
    }

    const showStrength = password.length > 0
    const strength = getPasswordStrength(password)

    const isPasswordMismatch =
        password.length > 0 &&
        confirmPassword.length > 0 &&
        password !== confirmPassword

    const isSubmitDisabled =
        status === "loading" ||
        isPasswordMismatch


    return (

        <div className="p-8">
            <div className="mb-4">
                <Link
                    href="/login"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                </Link>
            </div>

            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">Reset Password</h1>
                <p className="text-sm text-muted-foreground">
                    Enter your new password below
                </p>
            </div>

            {status === "success" ? (
                <div className="p-4 rounded-md bg-green-50 border border-green-200 text-green-700 text-center">
                    {message}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {status === "error" && (
                        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                            {message}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="flex h-9 w-full rounded-md border border-input px-3 py-1 text-sm"
                        />
                    </div>
                    {showStrength && (
                        <p className={`text-sm ${strength.color}`}>
                            Password strength: {strength.label}
                        </p>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) =>
                                setConfirmPassword(e.target.value)
                            }
                            required
                            minLength={6}
                            className="flex h-9 w-full rounded-md border border-input px-3 py-1 text-sm"
                        />
                    </div>
                    {isPasswordMismatch && (
                        <p className="text-sm text-red-600">
                            Passwords do not match
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                        {status === "loading"
                            ? "Resetting..."
                            : "Reset Password"}
                    </button>
                </form>
            )}
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <div className="bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
            <Suspense
                fallback={
                    <div className="p-8 text-center">Loading...</div>
                }
            >
                <ResetPasswordContent />
            </Suspense>
        </div>
    )
}
