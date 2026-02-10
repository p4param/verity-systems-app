"use client"

import { Button } from "@/components/ui/button"
import { ShieldAlert, Info, MapPin, Smartphone, UserX, Globe, AlertTriangle, ShieldCheck, LogOut, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type AlertSeverity = "CRITICAL" | "HIGH" | "INFO"
export type AlertType = "NEW_DEVICE" | "NEW_LOCATION" | "PASS_CHANGED" | "SESSION_REVOKED" | "GLOBAL_LOGOUT" | "SECURITY_SETTINGS"

export interface AlertItemProps {
    id: number
    type: string
    title: string
    message: string
    severity: string
    isRead: boolean
    createdAt: string
    metadata?: string
    onMarkRead?: (id: number) => void
    onArchive?: (id: number) => void
    onClick?: (id: number) => void
}

export function AlertItem({
    id,
    type,
    title,
    message,
    severity,
    isRead,
    createdAt,
    onMarkRead,
    onArchive,
    onClick
}: AlertItemProps) {
    const getIcon = () => {
        switch (type) {
            case "NEW_DEVICE": return <Smartphone className="h-5 w-5 text-blue-600" />
            case "NEW_LOCATION": return <MapPin className="h-5 w-5 text-amber-600" />
            case "PASS_CHANGED": return <ShieldCheck className="h-5 w-5 text-primary" />
            case "SESSION_REVOKED": return <UserX className="h-5 w-5 text-gray-600" />
            case "GLOBAL_LOGOUT": return <LogOut className="h-5 w-5 text-red-600" />
            default: return <Info className="h-5 w-5 text-blue-600" />
        }
    }

    const getBgColor = () => {
        switch (severity) {
            case "CRITICAL": return "bg-red-50 dark:bg-red-900/10"
            case "HIGH": return "bg-amber-50 dark:bg-amber-900/10"
            default: return "bg-blue-50 dark:bg-blue-900/10"
        }
    }

    return (
        <div
            className={cn(
                "relative flex gap-4 p-4 border rounded-md transition-colors cursor-pointer group",
                !isRead ? "bg-card border-l-4 border-l-blue-500" : "bg-muted/30 border-border hover:bg-muted/50"
            )}
            onClick={() => onClick?.(id)}
        >
            {/* Icon */}
            <div className={cn("shrink-0 h-10 w-10 flex items-center justify-center rounded-full", getBgColor())}>
                {getIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                    <div>
                        <p className={cn("text-sm font-medium", !isRead ? "text-foreground" : "text-muted-foreground")}>
                            {title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Actions (visible on hover or if unread) */}
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onArchive?.(id); }}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                    title="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Unread Indicator */}
            {!isRead && (
                <div className="absolute top-4 right-4 h-2 w-2 bg-blue-500 rounded-full group-hover:hidden" />
            )}
        </div>
    )
}
