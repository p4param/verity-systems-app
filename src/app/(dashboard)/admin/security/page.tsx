"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import {
    Shield,
    AlertTriangle,
    Activity,
    FileText,
    Download,
    CheckCircle,
    XCircle,
    Info,
    AlertOctagon,
} from "lucide-react";

// Types matching API response
type SecurityStats = {
    mfaAdoption: {
        enabled: number;
        total: number;
        rate: number;
    };
    failedLogins24h: number;
    activeIncidents: number;
};

type SecurityAlert = {
    id: number;
    title: string;
    message: string;
    type: string;
    severity: "CRITICAL" | "HIGH" | "INFO";
    createdAt: string;
    user: {
        id: number;
        email: string;
        fullName: string;
    };
};

export default function SecurityDashboard() {
    const { fetchWithAuth } = useAuth();
    const [stats, setStats] = useState<SecurityStats | null>(null);
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(
        null,
    );

    useEffect(() => {
        const loadJava = async () => {
            try {
                // Parallel fetch for simplified loading state
                const [statsData, alertsData] = await Promise.all([
                    fetchWithAuth<SecurityStats>("/api/admin/security/stats"),
                    fetchWithAuth<{ data: SecurityAlert[] }>(
                        "/api/admin/security/alerts?limit=20",
                    ),
                ]);
                setStats(statsData);
                setAlerts(alertsData.data);
            } catch (error) {
                console.error("Failed to load security dashboard", error);
            } finally {
                setLoading(false);
            }
        };
        loadJava();
    }, [fetchWithAuth]);

    const handleExportEvidence = async () => {
        setExporting(true);
        // Simulate export delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setExporting(false);
        alert(
            "Compliance evidence export started. You will receive an email shortly.",
        );
    };

    if (loading) {
        return (
            <div className="p-12 text-center">
                Loading Security Operations Center...
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Security Operations
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor compliance, threats, and operational security
                        posture.
                    </p>
                </div>
                <button
                    onClick={handleExportEvidence}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-accent text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {exporting ? (
                        <Activity className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    Export Evidence (SOC2)
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* MFA Adoption */}
                <div className="p-6 rounded-lg bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            MFA Adoption
                        </h3>
                        <Shield
                            className={`h-4 w-4 ${stats?.mfaAdoption.rate || 0 > 80 ? "text-green-500" : "text-yellow-500"}`}
                        />
                    </div>
                    <div className="text-2xl font-bold">
                        {stats?.mfaAdoption.rate}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {stats?.mfaAdoption.enabled} of{" "}
                        {stats?.mfaAdoption.total} users enabled
                    </p>
                </div>

                {/* Failed Logins */}
                <div className="p-6 rounded-lg bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Identity Threats (24h)
                        </h3>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">
                        {stats?.failedLogins24h}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Failed login attempts detected
                    </p>
                </div>

                {/* Active Incidents */}
                <div className="p-6 rounded-lg bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Active Incidents
                        </h3>
                        <AlertTriangle
                            className={`h-4 w-4 ${(stats?.activeIncidents || 0) > 0 ? "text-red-500" : "text-green-500"}`}
                        />
                    </div>
                    <div className="text-2xl font-bold">
                        {stats?.activeIncidents}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Unresolved High/Critical alerts
                    </p>
                </div>
            </div>

            {/* Alerts Table */}
            <div className="rounded-lg bg-card shadow-sm">
                <div className="p-6 border-b-2 border-background">
                    <h3 className="font-semibold">Recent Security Alerts</h3>
                </div>
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                        <thead className="[&_tr]:border-b-2 border-background">
                            <tr className="border-b-2 border-background transition-colors hover:bg-muted/50">
                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground">
                                    Severity
                                </th>
                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground">
                                    Event
                                </th>
                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground">
                                    User
                                </th>
                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground">
                                    Message
                                </th>
                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-right">
                                    Time
                                </th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {alerts.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="p-8 text-center text-muted-foreground"
                                    >
                                        No recent security alerts found.
                                    </td>
                                </tr>
                            ) : (
                                alerts.map((alert) => (
                                    <tr
                                        key={alert.id}
                                        onClick={() => setSelectedAlert(alert)}
                                        className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                                    >
                                        <td className="p-4 align-middle">
                                            <Badge severity={alert.severity} />
                                        </td>
                                        <td className="p-4 align-middle font-medium">
                                            {alert.type}
                                        </td>
                                        <td className="p-4 align-middle">
                                            {alert.user.email}
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground truncate max-w-[300px]">
                                            {alert.message}
                                        </td>
                                        <td className="p-4 align-middle text-right text-muted-foreground">
                                            {new Date(
                                                alert.createdAt,
                                            ).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedAlert && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-background border rounded-lg shadow-lg w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Badge severity={selectedAlert.severity} />
                                    {selectedAlert.type}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {new Date(
                                        selectedAlert.createdAt,
                                    ).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedAlert(null)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <h3 className="text-sm font-medium mb-1">
                                    User Context
                                </h3>
                                <div className="p-3 bg-muted/50 rounded-md text-sm">
                                    <p>
                                        <span className="font-medium">
                                            Name:
                                        </span>{" "}
                                        {selectedAlert.user.fullName}
                                    </p>
                                    <p>
                                        <span className="font-medium">
                                            Email:
                                        </span>{" "}
                                        {selectedAlert.user.email}
                                    </p>
                                    <p>
                                        <span className="font-medium">
                                            User ID:
                                        </span>{" "}
                                        {selectedAlert.user.id}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium mb-1">
                                    Message
                                </h3>
                                <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                                    {selectedAlert.message}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium mb-1">
                                    Description / Title
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedAlert.title}
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-muted/20 flex justify-end">
                            <button
                                onClick={() => setSelectedAlert(null)}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Badge({ severity }: { severity: string }) {
    if (severity === "CRITICAL") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600">
                <AlertOctagon className="h-3 w-3" /> Critical
            </span>
        );
    }
    if (severity === "HIGH") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-600">
                <AlertTriangle className="h-3 w-3" /> High
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600">
            <Info className="h-3 w-3" /> Info
        </span>
    );
}
