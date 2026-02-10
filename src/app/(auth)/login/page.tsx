"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/auth-context"
import { ForcedMfaSetup } from "./_components/ForcedMfaSetup"
import { MfaVerifyForm } from "./_components/MfaVerifyForm"

export default function LoginPage() {
    const { login, mfaRequired, mfaSetupRequired, logout } = useAuth()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [tempToken, setTempToken] = useState("")

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const data = await login(email, password)
            if (data?.tempToken) {
                setTempToken(data.tempToken)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (mfaSetupRequired) {
        return (
            <div className="bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden max-w-md w-full mx-auto mt-10 p-6">
                <ForcedMfaSetup
                    onSuccess={() => window.location.reload()}
                    tempToken={tempToken}
                />
            </div>
        )
    }

    if (mfaRequired) {
        return (
            <MfaVerifyForm
                onCancel={() => {
                    logout()
                    setPassword("")
                    setError("")
                }}
            />
        )
    }

    return (
        <div className="bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
            <div className="p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold">Welcome back</h1>
                    <p className="text-sm text-muted-foreground">
                        Enter your email to sign in to your account
                    </p>
                </div>
                {error && (
                    <div className="mb-4 p-3 rounded bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                        {error}
                    </div>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="email"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="m@example.com"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Password
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    )
}
