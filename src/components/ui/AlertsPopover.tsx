"use client"

import { useState, useEffect, useRef } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth/auth-context"
import { NotificationBell } from "./NotificationBell"
import { AlertItem, AlertSeverity, AlertType } from "@/components/ui/AlertItem"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Alert = {
    id: number
    type: string
    title: string
    message: string
    severity: string
    isRead: boolean
    createdAt: string
}

export function AlertsPopover() {
    const { fetchWithAuth, loading: authLoading } = useAuth()
    const [open, setOpen] = useState(false)
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    // Polling or SWR would be better, using simple effect for now
    const loadAlerts = async () => {
        if (authLoading) return // Wait for auth to be ready

        try {
            const data = await fetchWithAuth<{ alerts: Alert[], meta: any }>("/api/secure/alerts?limit=5")
            setAlerts(data.alerts)
            setUnreadCount(data.meta.unreadCount)
        } catch (err: any) {
            // Suppress session expired error as it's handled by auth context redirection
            if (err.message !== "Session expired") {
                console.error(err)
            }
        }
    }

    useEffect(() => {
        if (authLoading) return

        loadAlerts()
        // Poll every 60s
        const interval = setInterval(loadAlerts, 60000)
        return () => clearInterval(interval)
    }, [authLoading])

    const handleMarkAllRead = async () => {
        try {
            await fetchWithAuth("/api/secure/alerts/read-all", { method: "POST" })
            setUnreadCount(0)
            setAlerts(prev => prev.map(a => ({ ...a, isRead: true })))
        } catch (err) {
            console.error(err)
        }
    }

    const handleRead = async (id: number) => {
        try {
            // Optimistic update
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a))
            setUnreadCount(prev => Math.max(0, prev - 1))

            await fetchWithAuth(`/api/secure/alerts/${id}/read`, { method: "POST" })
        } catch (err) {
            console.error(err)
        }
    }

    const handleClick = (id: number) => {
        handleRead(id)
        setOpen(false)
        router.push("/profile/alerts") // Or specific deep link based on type
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div suppressHydrationWarning>
                    <NotificationBell unreadCount={unreadCount} onClick={() => setOpen(!open)} />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold">Security Alerts</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-auto py-1 px-2"
                            onClick={handleMarkAllRead}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>

                <div className="max-h-[300px] overflow-y-auto">
                    {alerts.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No alerts found.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {alerts.map(alert => (
                                <div
                                    key={alert.id}
                                    className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => handleClick(alert.id)}
                                >
                                    <div className="flex gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-medium ${!alert.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                                                {alert.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                                {alert.message}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {new Date(alert.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        {!alert.isRead && (
                                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-3 border-t bg-muted/20 text-center">
                    <Button variant="link" size="sm" className="text-xs" asChild>
                        <Link href="/profile/alerts" onClick={() => setOpen(false)}>
                            View all alerts
                        </Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
