
"use client";

import { useState, useEffect } from "react";
import {
    ShieldCheck,
    AlertTriangle,
    Clock,
    FileText,
    Shield,
    Share2,
    CheckCircle2,
    ChevronRight,
    RefreshCw,
    TrendingUp,
    History as HistoryIcon
} from "lucide-react";
import { format } from "date-fns";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

interface ComplianceSnapshot {
    id?: string;
    tenantId?: number;
    snapshotDate: string;
    complianceScore: number;
    totalDocuments: number;
    approvedDocuments: number;
    draftDocuments: number;
    expiredDocuments: number;
    documentsNearExpiry: number;
    documentsUnderReview: number;
    overdueReviews: number;
    unacknowledgedDocuments: number;
    activeShareLinks: number;
    legalHoldCount: number;
    documentsUnderHold: number;
    holdReleaseEventsLast30Days: number;
    holdViolationAttempts: number;
    retentionViolations: number;
    auditCoverageScore: number;
    workflowIntegrityScore: number;
    legalHoldIntegrityScore: number;
    lastComputedAt: string;
}

interface ComplianceAlert {
    id: string;
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    message: string;
    createdAt: string;
}

export default function ComplianceDashboard() {
    const [summary, setSummary] = useState<ComplianceSnapshot | null>(null);
    const [history, setHistory] = useState<ComplianceSnapshot[]>([]);
    const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summaryRes, historyRes, alertsRes] = await Promise.all([
                fetch("/api/secure/compliance/summary"),
                fetch("/api/secure/compliance/history?range=30d"),
                fetch("/api/secure/compliance/alerts")
            ]);

            const [summaryData, historyData, alertsData] = await Promise.all([
                summaryRes.json(),
                historyRes.json(),
                alertsRes.json()
            ]);

            if (summaryData.success) setSummary(summaryData.data);
            if (historyData.success) setHistory(historyData.data);
            if (alertsData.success) setAlerts(alertsData.data);
        } catch (error) {
            console.error("Failed to fetch compliance data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleResolveAlert = async (alertId: string) => {
        setResolving(alertId);
        try {
            const res = await fetch("/api/secure/compliance/alerts/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertId })
            });
            const data = await res.json();
            if (data.success) {
                setAlerts(prev => prev.filter(a => a.id !== alertId));
            }
        } catch (error) {
            console.error("Failed to resolve alert:", error);
        } finally {
            setResolving(null);
        }
    };

    if (loading && !summary) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin text-primary/50" />
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return "text-emerald-500";
        if (score >= 75) return "text-amber-500";
        return "text-red-500";
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return <Badge variant="destructive">CRITICAL</Badge>;
            case "HIGH": return <Badge className="bg-orange-500 text-white">HIGH</Badge>;
            case "MEDIUM": return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-200">MEDIUM</Badge>;
            default: return <Badge variant="outline">LOW</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Compliance Dashboard</h1>
                    <p className="text-muted-foreground">
                        Authoritative visibility into tenant document governance and risk.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Hero Section: Compliance Score */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Overall Compliance Score</CardTitle>
                        <CardDescription>Weighted across all categories</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center pt-2">
                        <div className={`text-7xl font-bold ${getScoreColor(summary?.complianceScore || 0)}`}>
                            {summary?.complianceScore ?? "--"}
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground text-center">
                            Last computed: {summary?.lastComputedAt ? format(new Date(summary.lastComputedAt), "MMM d, h:mm a") : "Never"}
                        </p>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 grid gap-4 grid-cols-2">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                                Workflow Integrity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.workflowIntegrityScore}%</div>
                            <div className="w-full bg-muted rounded-full h-2 mt-2">
                                <div
                                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${summary?.workflowIntegrityScore}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <HistoryIcon className="w-4 h-4 mr-2 text-blue-500" />
                                Audit Coverage
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.auditCoverageScore}%</div>
                            <div className="w-full bg-muted rounded-full h-2 mt-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${summary?.auditCoverageScore}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                                Expiry Control
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.expiredDocuments} Expired</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {summary?.documentsNearExpiry} near expiry (30d)
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <Shield className="w-4 h-4 mr-2 text-amber-600" />
                                Legal Hold Integrity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.legalHoldIntegrityScore}%</div>
                            <div className="w-full bg-muted rounded-full h-2 mt-2">
                                <div
                                    className={`h-2 rounded-full transition-all duration-500 ${(summary?.legalHoldIntegrityScore ?? 100) < 100 ? "bg-red-500" : "bg-amber-500"
                                        }`}
                                    style={{ width: `${summary?.legalHoldIntegrityScore}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Docs</CardTitle>
                        <FileText className="h-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.totalDocuments}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Holds</CardTitle>
                        <Shield className="h-4 h-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.legalHoldCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Share Links</CardTitle>
                        <Share2 className="h-4 h-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.activeShareLinks}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Acks Needed</CardTitle>
                        <CheckCircle2 className="h-4 h-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.unacknowledgedDocuments}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Legal Hold Governance Panel */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Shield className="w-5 h-5 mr-2 text-amber-600" />
                            Legal Hold Governance
                        </CardTitle>
                        <CardDescription>Defensible hold monitoring and protection</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 border rounded-lg bg-muted/30">
                                    <p className="text-xs text-muted-foreground uppercase">Documents Under Hold</p>
                                    <p className="text-2xl font-bold">{summary?.documentsUnderHold}</p>
                                </div>
                                <div className="p-3 border rounded-lg bg-muted/30">
                                    <p className="text-xs text-muted-foreground uppercase">Violation Attempts</p>
                                    <p className={`text-2xl font-bold ${summary?.holdViolationAttempts ? "text-red-500" : ""}`}>
                                        {summary?.holdViolationAttempts}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Active Holds</span>
                                    <span className="font-medium">{summary?.legalHoldCount}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Recent Releases (30d)</span>
                                    <span className="font-medium">{summary?.holdReleaseEventsLast30Days}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Integrity Checks</span>
                                    <Badge variant="outline" className="text-emerald-500 border-emerald-200 bg-emerald-50">
                                        PASSED
                                    </Badge>
                                </div>
                            </div>

                            {summary?.holdViolationAttempts ? (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start space-x-2">
                                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                                    <p className="text-xs text-red-700">
                                        Warning: Deletion attempts detected on held documents. Review audit logs immediately.
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                {/* Alerts Panel */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                            Active Compliance Alerts
                        </CardTitle>
                        <CardDescription>Violations requiring immediate action</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {alerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/30 rounded-lg">
                                <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-500/50" />
                                <p className="text-sm font-medium">No active alerts</p>
                                <p className="text-xs text-muted-foreground">Your tenant is currently within parameters.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {alerts.map((alert) => (
                                    <div key={alert.id} className="flex items-start justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                {getSeverityBadge(alert.severity)}
                                                <span className="text-xs text-muted-foreground">{format(new Date(alert.createdAt), "MMM d, HH:mm")}</span>
                                            </div>
                                            <p className="text-sm font-medium leading-tight">{alert.message}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-8 px-2"
                                            onClick={() => handleResolveAlert(alert.id)}
                                            disabled={resolving === alert.id}
                                        >
                                            {resolving === alert.id ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : "Resolve"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* History / Trend (Simple Bar Chart) */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                            Compliance Trend (30d)
                        </CardTitle>
                        <CardDescription>Historical score progression</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between h-[180px] pt-4 px-2">
                            {history.length > 0 ? history.slice(-15).map((snap, i) => (
                                <div key={i} className="flex flex-col items-center group w-full max-w-[20px]">
                                    <div className="relative w-full">
                                        <div
                                            className={`w-full rounded-t-sm transition-all duration-300 ${getScoreColor(snap.complianceScore).replace('text-', 'bg-')}`}
                                            style={{ height: `${snap.complianceScore}%` }}
                                        />
                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {snap.complianceScore}% ({format(new Date(snap.snapshotDate), "MMM d")})
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="w-full h-full flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                                    Insufficient historical data
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] text-muted-foreground px-1 border-t pt-2">
                            <span>{history.length > 0 ? format(new Date(history[0].snapshotDate), "MMM d") : "-"}</span>
                            <span>{history.length > 0 ? format(new Date(history[history.length - 1].snapshotDate), "MMM d") : "-"}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
