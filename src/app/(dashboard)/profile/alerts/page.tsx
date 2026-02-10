"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { AlertItem } from "@/components/ui/AlertItem"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCheck } from "lucide-react"

type Alert = {
    id: number
    type: string
    title: string
    message: string
    severity: string
    isRead: boolean
    createdAt: string
}

export default function SecurityAlertsPage() {
    const { fetchWithAuth } = useAuth()
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    const loadAlerts = async (p: number) => {
        try {
            setLoading(true)
            const data = await fetchWithAuth<{ alerts: Alert[], meta: any }>(`/api/secure/alerts?page=${p}&limit=20`)
            setAlerts(data.alerts)
            setTotalPages(data.meta.totalPages)
            setPage(data.meta.page)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAlerts(1)
    }, [])

    const handleMarkAllRead = async () => {
        try {
            await fetchWithAuth("/api/secure/alerts/read-all", { method: "POST" })
            setAlerts(prev => prev.map(a => ({ ...a, isRead: true })))
        } catch (err) {
            console.error(err)
        }
    }

    const handleRead = async (id: number) => {
        try {
            await fetchWithAuth(`/api/secure/alerts/${id}/read`, { method: "POST" })
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a))
        } catch (err) {
            console.error(err)
        }
    }

    const handleArchive = async (id: number) => {
        try {
            await fetchWithAuth(`/api/secure/alerts/${id}/archive`, { method: "POST" })
            setAlerts(prev => prev.filter(a => a.id !== id))
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Security Alerts</h2>
                    <p className="text-muted-foreground">
                        Review recent security activity and notifications.
                    </p>
                </div>
                {alerts.some(a => !a.isRead) && (
                    <Button onClick={handleMarkAllRead} variant="outline" size="sm">
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Mark all as read
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/10">
                    <p className="text-muted-foreground">No alerts found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {alerts.map(alert => (
                        <AlertItem
                            key={alert.id}
                            {...alert}
                            onMarkRead={handleRead}
                            onArchive={handleArchive}
                            onClick={handleRead}
                        />
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => loadAlerts(page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() => loadAlerts(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    )
}
