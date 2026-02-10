"use client";

import { Search, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { AvatarDropdown } from "./AvatarDropdown";
import { AlertsPopover } from "./AlertsPopover";

export function Header({ setMobileOpen }) {
    return (
        <header className="h-16 px-6 flex items-center justify-between gap-4 sticky top-0 z-30 transition-all border-b border-border bg-card">
            <button
                onClick={() => setMobileOpen?.(true)}
                className="lg:hidden p-2 text-muted-foreground hover:bg-accent rounded-md transition-colors"
            >
                <Menu className="h-5 w-5" />
            </button>

            <div className="flex-1 max-w-md hidden sm:block">
                <div className="relative group">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="search"
                        placeholder="Search..."
                        className="w-full bg-background hover:bg-accent/50 focus:bg-background rounded-md border border-input pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            <button className="sm:hidden p-2 text-muted-foreground hover:bg-accent rounded-md">
                <Search className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
                <ThemeToggle />
                <AlertsPopover />
                <div className="w-px h-6 bg-border mx-1"></div>
                <AvatarDropdown />
            </div>
        </header>
    );
}
