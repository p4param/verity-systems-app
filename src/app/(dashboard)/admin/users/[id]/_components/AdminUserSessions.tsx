"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Laptop, Smartphone, Globe, Clock, ShieldAlert } from "lucide-react"

type Session = {
    id: number
    deviceInfo: string | null
    ipAddress: string | null
    lastActiveAt: string | null
    createdAt: string
    expiresAt: string
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
}

export function AdminUserSessions({ userId }: { userId: number }) {
    const { fetchWithAuth } = useAuth()
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const data = await fetchWithAuth<{ sessions: Session[] }>(`/api/admin/users/${userId}/sessions`)
                setSessions(data.sessions)
            } catch (err) {
                console.error(err)
                setError("Failed to load sessions")
            } finally {
                setLoading(false)
            }
        }
        if (userId) load()
    }, [userId, fetchWithAuth])

    const getIcon = (deviceInfo: string | null) => {
        if (!deviceInfo) return <Globe className="h-4 w-4" />
        const lower = deviceInfo.toLowerCase()
        if (lower.includes("mobile")) return <Smartphone className="h-4 w-4" />
        return <Laptop className="h-4 w-4" />
    }

    if (loading) return <div className="text-sm text-muted-foreground">Loading sessions...</div>
    if (error) return <div className="text-sm text-muted-foreground italic">Unable to load sessions.</div>

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Session History</h3>
            <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="p-3 font-medium">Device</th>
                            <th className="p-3 font-medium">IP Address</th>
                            <th className="p-3 font-medium">Started</th>
                            <th className="p-3 font-medium">Last Active</th>
                            <th className="p-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                    No sessions found.
                                </td>
                            </tr>
                        ) : (
                            sessions.map((s) => (
                                <tr key={s.id} className={s.status !== 'ACTIVE' ? "bg-muted/20 opacity-60" : ""}>
                                    <td className="p-3 flex items-center gap-2">
                                        {getIcon(s.deviceInfo)}
                                        <span className="truncate max-w-[150px]" title={s.deviceInfo || ""}>
                                            {s.deviceInfo || "Unknown"}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-xs">{s.ipAddress}</td>
                                    <td className="p-3">{new Date(s.createdAt).toLocaleDateString()}</td>
                                    <td className="p-3">
                                        {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : "-"}
                                    </td>
                                    <td className="p-3">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium 
                                            ${s.status === 'ACTIVE' ? "bg-green-100 text-green-700" :
                                                s.status === 'REVOKED' ? "bg-red-100 text-red-700" :
                                                    "bg-yellow-100 text-yellow-700"}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
