"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Users, Shield, Lock, Activity, Clock, LogOut } from "lucide-react"

// Types matching the API implementation
type User = {
    id: number
    email: string
    name: string
    isActive: boolean
    lastLoginAt: string | null
    roles: string[]
}

type AuditEvent = {
    id: string
    action: string
    createdAt: string
    actorEmail: string | null
    actorType: string
    details: string
}

type DashboardData = {
    users: {
        total: number
        active: number
        disabled: number
        pending: number // Derived from !isActive? Or separate field if available
    }
    sessions: {
        active: number
        revoked24h: number
    }
    security: {
        authEvents24h: number
        sessionEvents24h: number
        roleEvents24h: number
        total24h: number
    }
    recentActions: AuditEvent[]
}

export default function AdminDashboardPage() {
    const { fetchWithAuth } = useAuth()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardData | null>(null)

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                // Fetch data in parallel
                const [users, auditEvents] = await Promise.all([
                    fetchWithAuth<User[]>("/api/admin/users"),
                    fetchWithAuth<{ events: AuditEvent[], total: number }>("/api/admin/audit-events?limit=50")
                ])

                // 1. Calculate User Stats
                // Note: The API currently returns isActive (boolean). 
                // "PENDING" status logic from the backend (user.status) isn't fully exposed in the list API yet 
                // unless we added it. But based on our API update, we have isActive.
                // We'll treat !isActive as DISABLED for now, unless we can infer PENDING.
                // Actually, the API returns `isActive`.
                const userStats = {
                    total: users.length,
                    active: users.filter(u => u.isActive).length,
                    disabled: users.filter(u => !u.isActive).length,
                    pending: 0 // Placeholder until status enum exposed or derived
                }

                // 2. Calculate Session Stats (Proxy)
                // We don't have a direct "Active Sessions" API.
                // Proxy: Count users who logged in within last 24h as "Active today"
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
                const activeSessions = users.filter(u =>
                    u.lastLoginAt && new Date(u.lastLoginAt) > oneDayAgo
                ).length

                // For revoked sessions, we check audit logs for REVOKE events
                const revokedSessions = auditEvents.events.filter(e =>
                    e.action.includes("REVOKE") && new Date(e.createdAt) > oneDayAgo
                ).length

                // 3. Security Activity
                const recentSecurityEvents = auditEvents.events.filter(e =>
                    new Date(e.createdAt) > oneDayAgo
                )

                const securityStats = {
                    authEvents24h: recentSecurityEvents.filter(e => e.action.startsWith("AUTH")).length,
                    sessionEvents24h: recentSecurityEvents.filter(e => e.action.startsWith("SESSION")).length,
                    roleEvents24h: recentSecurityEvents.filter(e => e.action.startsWith("ROLE")).length,
                    total24h: recentSecurityEvents.length
                }

                setStats({
                    users: userStats,
                    sessions: {
                        active: activeSessions,
                        revoked24h: revokedSessions
                    },
                    security: securityStats,
                    recentActions: auditEvents.events.slice(0, 10)
                })

            } catch (error) {
                console.error("Failed to load dashboard data", error)
            } finally {
                setLoading(false)
            }
        }

        loadDashboardData()
    }, [fetchWithAuth])

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">System Status</h1>
                <p className="text-muted-foreground">
                    Real-time overview of tenant security and user activity.
                </p>
            </div>

            {/* Top Row: User & Session Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* User Stats */}
                <Card>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                        <div className="text-sm font-medium">Total Users</div>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{stats?.users.total}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.users.active} active, {stats?.users.disabled} disabled
                        </p>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                        <div className="text-sm font-medium">Active Sessions</div>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{stats?.sessions.active}</div>
                        <p className="text-xs text-muted-foreground">
                            Users logged in (last 24h)
                        </p>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                        <div className="text-sm font-medium">Security Events</div>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{stats?.security.total24h}</div>
                        <p className="text-xs text-muted-foreground">
                            Events in last 24 hours
                        </p>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                        <div className="text-sm font-medium">Revoked Sessions</div>
                        <LogOut className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="text-2xl font-bold">{stats?.sessions.revoked24h}</div>
                        <p className="text-xs text-muted-foreground">
                            Revocations in last 24h
                        </p>
                    </div>
                </Card>
            </div>

            {/* Middle Row: Detailed Activity */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Security Breakdown */}
                <div className="col-span-4 rounded-xl bg-card text-card-foreground">
                    <div className="p-6 flex flex-col space-y-1.5">
                        <h3 className="font-semibold leading-none tracking-tight">Security Activity Breakdown</h3>
                        <p className="text-sm text-muted-foreground">Categorized audit events for the last 24 hours</p>
                    </div>
                    <div className="p-6 pt-0 space-y-4">
                        <ActivityRow label="Authentication Events" count={stats?.security.authEvents24h || 0} total={stats?.security.total24h || 1} />
                        <ActivityRow label="Session Management" count={stats?.security.sessionEvents24h || 0} total={stats?.security.total24h || 1} />
                        <ActivityRow label="Role & Permissions" count={stats?.security.roleEvents24h || 0} total={stats?.security.total24h || 1} />
                    </div>
                </div>

                {/* Recent Actions */}
                <div className="col-span-3 rounded-xl bg-card text-card-foreground">
                    <div className="p-6 flex flex-col space-y-1.5">
                        <h3 className="font-semibold leading-none tracking-tight">Recent Administrative Actions</h3>
                        <p className="text-sm text-muted-foreground">Latest audit logs</p>
                    </div>
                    <div className="p-6 pt-0">
                        <div className="space-y-4">
                            {stats?.recentActions.map(action => (
                                <div key={action.id} className="flex items-center">
                                    <span className="relative flex h-2 w-2 mr-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                                    </span>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{action.action}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {action.actorEmail} • {new Date(action.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Simple Card Component for Layout
function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl bg-card text-card-foreground">
            {children}
        </div>
    )
}

function ActivityRow({ label, count, total }: { label: string, count: number, total: number }) {
    const percentage = Math.round((count / total) * 100)
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">{count} events</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    )
}
