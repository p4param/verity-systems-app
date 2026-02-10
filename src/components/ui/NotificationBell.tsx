"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NotificationBellProps {
    unreadCount: number
    onClick: () => void
}

export function NotificationBell({ unreadCount, onClick }: NotificationBellProps) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onClick}
            aria-label="Notifications"
        >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className={cn(
                    "absolute top-1.5 right-1.5 flex h-2.5 w-2.5",
                    unreadCount > 9 ? "h-4 w-fit px-1 -right-0.5" : ""
                )}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className={cn(
                        "relative inline-flex rounded-full bg-red-500 text-[10px] font-bold text-white items-center justify-center",
                        unreadCount > 9 ? "h-full px-1" : "h-2.5 w-2.5"
                    )}>
                        {unreadCount > 9 ? "9+" : ""}
                    </span>
                </span>
            )}
        </Button>
    )
}
