"use client"

import { TrustBadge } from "@/components/TrustBadge"

export function Footer() {
    return (
        <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>© {new Date().getFullYear()} Varity Systems</span>
                        <span className="hidden sm:inline">•</span>
                        <a
                            href="/trust"
                            className="hover:text-foreground transition-colors"
                        >
                            Privacy
                        </a>
                        <span>•</span>
                        <a
                            href="/trust"
                            className="hover:text-foreground transition-colors"
                        >
                            Terms
                        </a>
                    </div>
                    <TrustBadge />
                </div>
            </div>
        </footer>
    )
}
