"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Laptop, Smartphone, Globe, AlertTriangle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

type Session = {
    id: number;
    deviceInfo: string | null;
    ipAddress: string | null;
    lastActiveAt: string | null;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
};

export function ActiveSessionsList() {
    const { fetchWithAuth, logout, loading: authLoading } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadSessions = async () => {
        if (authLoading) return; // Wait for auth to settle
        try {
            setLoading(true);
            const data = await fetchWithAuth<{ sessions: Session[] }>(
                "/api/secure/sessions",
            );
            setSessions(data.sessions);
        } catch (err) {
            console.error(err);
            setError("Failed to load active sessions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            loadSessions();
        }
    }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRevoke = async (sessionId: number) => {
        if (!confirm("Are you sure you want to revoke this session?")) return;

        try {
            await fetchWithAuth("/api/secure/sessions/revoke", {
                method: "POST",
                body: JSON.stringify({ sessionId }),
            });
            // Remove locally
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        } catch (err) {
            alert("Failed to revoke session");
        }
    };

    const handleRevokeAll = async () => {
        if (
            !confirm(
                "Are you sure? This will log you out of all devices immediately.",
            )
        )
            return;

        try {
            await fetchWithAuth("/api/secure/sessions/revoke-all", {
                method: "POST",
            });
            // Force logout
            await logout();
        } catch (err: any) {
            if (err.message === "Session expired") return;
            console.error(err);
            alert(`Failed to revoke sessions: ${err.message}`);
        }
    };

    const getIcon = (deviceInfo: string | null) => {
        if (!deviceInfo)
            return <Globe className="h-5 w-5 text-muted-foreground" />;
        const lower = deviceInfo.toLowerCase();
        if (
            lower.includes("mobile") ||
            lower.includes("iphone") ||
            lower.includes("android")
        ) {
            return <Smartphone className="h-5 w-5 text-muted-foreground" />;
        }
        return <Laptop className="h-5 w-5 text-muted-foreground" />;
    };

    if (loading)
        return (
            <div className="text-sm text-muted-foreground">
                Loading sessions...
            </div>
        );
    if (error) return <div className="text-sm text-destructive">{error}</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Active Sessions</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage devices logged into your account.
                    </p>
                </div>
                {sessions.length > 1 && (
                    <button
                        onClick={handleRevokeAll}
                        className="text-sm text-destructive hover:underline font-medium flex items-center"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Log Out Everywhere
                    </button>
                )}
            </div>

            <div className="rounded-md border-2 border-background divide-y">
                {sessions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No active sessions found.
                    </div>
                ) : (
                    sessions.map((session) => (
                        <div
                            key={session.id}
                            className="p-4 flex items-center justify-between"
                        >
                            <div className="flex items-start gap-4">
                                <div className="mt-1 bg-muted p-2 rounded-full">
                                    {getIcon(session.deviceInfo)}
                                </div>
                                <div>
                                    <p className="font-medium text-sm flex items-center gap-2">
                                        {session.deviceInfo || "Unknown Device"}
                                        {session.isCurrent && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                                                Current
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {session.ipAddress} • Last active{" "}
                                        {session.lastActiveAt
                                            ? new Date(
                                                  session.lastActiveAt,
                                              ).toLocaleDateString()
                                            : "Recently"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Started{" "}
                                        {new Date(
                                            session.createdAt,
                                        ).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div>
                                {!session.isCurrent && (
                                    <button
                                        onClick={() => handleRevoke(session.id)}
                                        className="text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1 rounded"
                                    >
                                        Revoke
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
