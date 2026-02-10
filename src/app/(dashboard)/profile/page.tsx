"use client";

import { ActiveSessionsList } from "./_components/ActiveSessionsList";
import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import Image from "next/image";

export default function ProfilePage() {
    const { user, fetchWithAuth, refreshTokens, logout } = useAuth();

    // Steps: idle | qr | verify | backup-codes | disable-confirm
    const [step, setStep] = useState<
        "idle" | "qr" | "verify" | "backup-codes" | "disable-confirm"
    >("idle");

    // Setup State
    const [qrCode, setQrCode] = useState("");
    const [secret, setSecret] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [backupCodes, setBackupCodes] = useState<string[]>([]);

    // Disable State
    const [disablePassword, setDisablePassword] = useState("");
    const [disableMfaCode, setDisableMfaCode] = useState("");

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const resetState = () => {
        setStep("idle");
        setQrCode("");
        setSecret("");
        setVerificationCode("");
        setBackupCodes([]);
        setDisablePassword("");
        setDisableMfaCode("");
        setError("");
        setSuccess("");
    };

    // --- SETUP FLOW ---

    const handleEnableMfa = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchWithAuth<{ secret: string; qrCode: string }>(
                "/api/auth/mfa/setup",
                {
                    method: "POST",
                },
            );
            setSecret(res.secret);
            setQrCode(res.qrCode);
            setStep("qr");
        } catch (err: any) {
            setError(err.message || "Failed to start MFA setup");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndEnable = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetchWithAuth<{
                message: string;
                backupCodes: string[];
            }>("/api/auth/mfa/confirm", {
                method: "POST",
                body: JSON.stringify({ secret, code: verificationCode }),
            });
            setBackupCodes(res.backupCodes);
            setStep("backup-codes");
            setSuccess("MFA verified! Please save your recovery codes.");
        } catch (err: any) {
            setError(err.message || "Invalid code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleFinishSetup = async () => {
        setLoading(true);
        try {
            await refreshTokens();
            resetState();
            setSuccess("MFA has been successfully enabled.");
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- DISABLE FLOW ---

    const handleDisableMfa = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await fetchWithAuth("/api/auth/mfa/disable", {
                method: "POST",
                body: JSON.stringify({
                    password: disablePassword,
                    mfaCode: disableMfaCode,
                }),
            });
            // Force logout on success
            await logout();
        } catch (err: any) {
            setError(err.message || "Failed to disable MFA");
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Profile & Security
                </h1>
                <p className="text-muted-foreground">
                    Manage your account settings and security preferences.
                </p>
            </div>

            <div className="p-6 bg-card rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Security</h2>

                <div className="flex items-center justify-between py-4 border-b-2 border-background">
                    <div>
                        <h3 className="font-medium">
                            Multi-Factor Authentication (MFA)
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {user?.mfaEnabled
                                ? "Your account is secured with MFA."
                                : "Add an extra layer of security to your account."}
                        </p>
                    </div>
                    <div>
                        {step === "idle" &&
                            (user?.mfaEnabled ? (
                                <button
                                    onClick={() => setStep("disable-confirm")}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-md text-sm font-medium"
                                >
                                    Disable MFA
                                </button>
                            ) : (
                                <button
                                    onClick={handleEnableMfa}
                                    disabled={loading}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium"
                                >
                                    {loading ? "Loading..." : "Enable MFA"}
                                </button>
                            ))}
                    </div>
                </div>

                <div className="mt-6">
                    {/* QR SCAN STATE */}
                    {step === "qr" && (
                        <div className="space-y-6 max-w-md mx-auto">
                            <div className="p-4 bg-muted/50 rounded-lg border text-center">
                                <h4 className="font-semibold mb-2">
                                    1. Scan QR Code
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Use your Authenticator App (Google Auth,
                                    Authy, etc.)
                                </p>
                                {qrCode && (
                                    <div className="flex justify-center bg-white p-4 rounded-md shadow-sm">
                                        <Image
                                            src={qrCode}
                                            alt="MFA QR Code"
                                            width={192}
                                            height={192}
                                            unoptimized
                                        />
                                    </div>
                                )}
                                <div className="mt-4">
                                    <p className="text-xs text-muted-foreground mb-1">
                                        Or enter this code manually:
                                    </p>
                                    <code className="bg-background px-2 py-1 rounded border text-sm select-all font-mono">
                                        {secret}
                                    </code>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => setStep("verify")}
                                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium"
                                >
                                    Continue to Verification
                                </button>
                                <button
                                    onClick={resetState}
                                    className="w-full text-muted-foreground hover:text-foreground text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* VERIFY STATE */}
                    {step === "verify" && (
                        <form
                            onSubmit={handleVerifyAndEnable}
                            className="space-y-4 max-w-md mx-auto"
                        >
                            <div className="text-center mb-4">
                                <h4 className="font-semibold">
                                    2. Verify Setup
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                    Enter the 6-digit code from your app.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Verification Code
                                </label>
                                <input
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) =>
                                        setVerificationCode(e.target.value)
                                    }
                                    placeholder="123456"
                                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    autoFocus
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium"
                            >
                                {loading ? "Verifying..." : "Verify & Enable"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep("qr")}
                                className="w-full text-muted-foreground hover:text-foreground text-sm"
                            >
                                Back to QR Code
                            </button>
                        </form>
                    )}

                    {/* BACKUP CODES STATE */}
                    {step === "backup-codes" && (
                        <div className="space-y-6 max-w-md mx-auto">
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                                <h4 className="font-bold text-yellow-800 mb-2">
                                    ⚠️ Save These Backup Codes
                                </h4>
                                <p className="text-sm text-yellow-700 mb-4">
                                    If you lose your device, these codes are the{" "}
                                    <strong>only way</strong> to recover your
                                    account. They will not be shown again.
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-left">
                                    {backupCodes.map((code, i) => (
                                        <code
                                            key={i}
                                            className="bg-white px-2 py-1 rounded border text-sm font-mono text-center"
                                        >
                                            {code}
                                        </code>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleFinishSetup}
                                disabled={loading}
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium"
                            >
                                I have saved these codes
                            </button>
                        </div>
                    )}

                    {/* DISABLE CONFIRM STATE */}
                    {step === "disable-confirm" && (
                        <form
                            onSubmit={handleDisableMfa}
                            className="space-y-4 max-w-md mx-auto"
                        >
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center mb-4">
                                <h4 className="font-bold text-red-800">
                                    Disable MFA?
                                </h4>
                                <p className="text-sm text-red-700">
                                    Your account will be less secure. You will
                                    be logged out immediately.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Verify Password
                                </label>
                                <input
                                    type="password"
                                    value={disablePassword}
                                    onChange={(e) =>
                                        setDisablePassword(e.target.value)
                                    }
                                    placeholder="Current Password"
                                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    MFA Code / Recovery Code
                                </label>
                                <input
                                    type="text"
                                    value={disableMfaCode}
                                    onChange={(e) =>
                                        setDisableMfaCode(e.target.value)
                                    }
                                    placeholder="123456"
                                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    required
                                />
                            </div>

                            <div className="space-y-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-md text-sm font-medium"
                                >
                                    {loading ? "Disabling..." : "Disable MFA"}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetState}
                                    className="w-full text-muted-foreground hover:text-foreground text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STATUS MESSAGES */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm text-center">
                            {error}
                        </div>
                    )}

                    {success && step === "idle" && (
                        <div className="mt-4 p-3 bg-green-100 border border-green-200 text-green-700 rounded-md text-sm text-center">
                            {success}
                        </div>
                    )}
                </div>
            </div>

            {/* Active Sessions */}
            <div className="bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
                <div className="p-6">
                    <ActiveSessionsList />
                </div>
            </div>
        </div>
    );
}
