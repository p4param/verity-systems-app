"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

function ActivateContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [step, setStep] = useState<"validating" | "form" | "success" | "error">("validating")
    const [error, setError] = useState("")
    const [inviteData, setInviteData] = useState<{ email: string; fullName: string } | null>(null)
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!token) {
            setError("Invalid activation link - no token provided")
            setStep("error")
            return
        }

        fetch(`/api/auth/validate-invite?token=${token}`)
            .then(res => res.json())
            .then(data => {
                if (data.valid) {
                    setInviteData({ email: data.email, fullName: data.fullName })
                    setStep("form")
                } else {
                    setError(data.message || "Invalid or expired activation link")
                    setStep("error")
                }
            })
            .catch(() => {
                setError("Failed to validate activation link")
                setStep("error")
            })
    }, [token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long")
            return
        }

        setIsSubmitting(true)

        try {
            const res = await fetch("/api/auth/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password })
            })

            const data = await res.json()

            if (res.ok) {
                setStep("success")
                setTimeout(() => {
                    router.push("/login")
                }, 3000)
            } else {
                setError(data.message || "Failed to activate account")
                setIsSubmitting(false)
            }
        } catch (err) {
            setError("An error occurred. Please try again.")
            setIsSubmitting(false)
        }
    }

    return (
        <div className="w-full max-w-md">
            <div className="bg-card text-card-foreground rounded-lg shadow-lg p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Activate Your Account</h1>
                    <p className="text-muted-foreground text-sm">Complete your registration to get started</p>
                </div>

                {step === "validating" && (
                    <div className="text-center py-12">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-muted-foreground">Validating your invitation...</p>
                    </div>
                )}

                {step === "form" && inviteData && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-muted rounded-lg p-4 border border-border">
                            <p className="text-sm text-muted-foreground mb-1">Account for:</p>
                            <p className="font-medium">{inviteData.fullName}</p>
                            <p className="text-muted-foreground text-sm">{inviteData.email}</p>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-2">
                                Create Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                placeholder="Enter your password"
                                required
                                minLength={8}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters</p>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 flex items-start gap-2">
                                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-primary text-primary-foreground font-semibold py-3 px-4 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Activating...
                                </>
                            ) : (
                                "Activate Account"
                            )}
                        </button>
                    </form>
                )}

                {step === "success" && (
                    <div className="text-center py-12">
                        <div className="bg-green-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Account Activated!</h2>
                        <p className="text-muted-foreground mb-4">Your account has been successfully activated.</p>
                        <p className="text-sm text-muted-foreground">Redirecting to login page...</p>
                    </div>
                )}

                {step === "error" && (
                    <div className="text-center py-12">
                        <div className="bg-destructive/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <XCircle className="h-12 w-12 text-destructive" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Activation Failed</h2>
                        <p className="text-muted-foreground mb-6">{error}</p>
                        <button
                            onClick={() => router.push("/login")}
                            className="text-primary hover:text-primary/80 font-medium"
                        >
                            Return to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ActivatePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Suspense fallback={
                <div className="text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Loading...</p>
                </div>
            }>
                <ActivateContent />
            </Suspense>
        </div>
    )
}
