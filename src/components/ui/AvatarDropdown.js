"use client";

import { useState, useRef, useEffect } from "react";
import { User, LogOut, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth/auth-context";

export function AvatarDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const { user, logout } = useAuth(); // Using Auth Hook

    // Close logic same as before...
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getInitials = (name) => {
        if (!name) return "U"
        return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:ring-2 hover:ring-ring transition-all overflow-hidden"
            >
                <span className="text-sm font-medium">{getInitials(user?.fullName)}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border p-1 animate-in fade-in zoom-in-95 duration-200 z-50">
                    <div className="px-3 py-2 border-b border-border/50">
                        <p className="text-sm font-semibold">{user?.fullName || "User"}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <div className="py-1">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <User size={16} />
                            Dashboard
                        </Link>
                        <Link
                            href="/profile"
                            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <FileText size={16} />
                            Profile
                        </Link>
                        <Link
                            href="/change-password"
                            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <Lock size={16} />
                            Change Password
                        </Link>
                    </div>
                    <div className="border-t border-border/50 pt-1 mt-1">
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                logout()
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-destructive text-left"
                        >
                            <LogOut size={16} />
                            Log out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
