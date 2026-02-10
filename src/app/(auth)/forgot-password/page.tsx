"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

type Status = "idle" | "loading" | "success" | "error"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [status, setStatus] = useState<Status>("idle")
    const [message, setMessage] = useState("")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setStatus("loading")
        setMessage("")

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            })

            const data: { message?: string } = await res.json()

            // API is enumeration-safe and always returns generic success
            setStatus("success")
            setMessage(
                data.message ||
                "If the email exists, a reset link has been sent."
            )
        } catch {
            setStatus("error")
            setMessage("Something went wrong. Please try again.")
        }
    }

    return (
        <div className="bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
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
                    <h1 className="text-2xl font-bold">Forgot password?</h1>
                    <p className="text-sm text-muted-foreground">
                        Enter your email address and we&apos;ll send you a link
                        to reset your password
                    </p>
                </div>

                {status === "success" ? (
                    <div className="p-4 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm text-center">
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
                            <label
                                htmlFor="email"
                                className="text-sm font-medium"
                            >
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="m@example.com"
                                required
                                className="flex h-9 w-full rounded-md border border-input px-3 py-1 text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status === "loading"}
                            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                            {status === "loading"
                                ? "Sending..."
                                : "Send Reset Link"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
