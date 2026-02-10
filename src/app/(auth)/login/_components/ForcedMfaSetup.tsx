"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import QRCode from "qrcode"

interface ForcedMfaSetupProps {
    onSuccess: () => void
    tempToken: string
}

export function ForcedMfaSetup({ onSuccess, tempToken }: ForcedMfaSetupProps) {
    const { logout } = useAuth()
    const [step, setStep] = useState<"qr" | "verify" | "success">("qr")
    const [qrCodeUrl, setQrCodeUrl] = useState("")
    const [secret, setSecret] = useState("")
    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [backupCodes, setBackupCodes] = useState<string[]>([])

    // Initialize Setup
    useEffect(() => {
        const initSetup = async () => {
            try {
                // We use the tempToken to call the setup API
                // Note: The setup API usually expects a Bearer token. 
                // We need to pass the tempToken as the Authorization header.
                const res = await fetch("/api/auth/mfa/setup", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${tempToken}`
                    }
                })

                if (!res.ok) {
                    const data = await res.json()
                    throw new Error(data.error || "Failed to initialize setup")
                }

                const data = await res.json()
                setSecret(data.secret)
                setQrCodeUrl(data.qrCode)
            } catch (err: any) {
                setError(err.message)
            }
        }
        initSetup()
    }, [tempToken])

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await fetch("/api/auth/mfa/confirm", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${tempToken}`
                },
                body: JSON.stringify({ secret, code })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Verification failed")
            }

            setBackupCodes(data.backupCodes)
            setStep("success")
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleContinue = () => {
        // onSuccess should trigger a page reload or state update that allows
        // the user to proceed to dashboard (since tokens were refreshed/issued by verify implicitly? 
        // No, confirm API returns tokens? WAIT.
        // The Confirm API currently returns { message, backupCodes }. 
        // Logic Gap: After Confirm, we are technically "Enrolled", but we don't have the AccessToken yet?
        // Ah, the Confirm API does NOT return new tokens in my previous implementation (Step 634/649).
        // It just updates the DB.

        // CORRECTION: The user still needs to Log In effectively.
        // Howerver, they HAVE the tempToken. 
        // Can they exchange tempToken for AccessToken?
        // Or should they be redirected to Login to sign in again?
        // Standard flow: 
        // Option A: Confirm API issues tokens (Best UX).
        // Option B: Redirect to login -> Login -> MFA Verify -> Dashboard.

        // Given I cannot change the backend now (frozen scope), I must stick to Option B UX.
        // "Setup Complete. Please log in with your new code."

        logout() // Force them to login screen fresh
    }

    if (step === "success") {
        return (
            <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded text-center">
                    <h3 className="font-bold text-lg">MFA Setup Complete!</h3>
                    <p className="text-sm">Your account is now secure.</p>
                </div>

                <div className="space-y-4">
                    <h4 className="font-medium text-sm">Save your recovery codes</h4>
                    <p className="text-xs text-muted-foreground">
                        If you lose your device, these codes are the ONLY way to access your account.
                        Store them somewhere safe.
                    </p>
                    <div className="bg-gray-100 p-4 rounded border font-mono text-xs grid grid-cols-2 gap-2 text-center">
                        {backupCodes.map((bc, i) => (
                            <span key={i} className="bg-white px-2 py-1 rounded shadow-sm">{bc}</span>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleContinue}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2 rounded-md text-sm font-medium"
                >
                    Continue to Login
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-lg font-bold">MFA Setup Required</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Your MFA was reset by an admin. You must set up a new authenticator.
                </p>
            </div>

            {error && (
                <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
                    {error}
                </div>
            )}

            <div className="flex justify-center py-4 bg-white p-4 rounded border">
                {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">
                        Loading QR...
                    </div>
                )}
            </div>

            <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                    1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc).
                </p>
                <p className="text-xs text-muted-foreground">
                    2. Enter the 6-digit code below.
                </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono border rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    maxLength={6}
                    required
                />
                <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                    {loading ? "Verifying..." : "Verify & Enable"}
                </button>
            </form>

            <button
                onClick={() => logout()}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
                Cancel / Logout
            </button>
        </div>
    )
}
