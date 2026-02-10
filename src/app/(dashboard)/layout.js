"use client";

import { useState } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";

export default function DashboardLayout({ children }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
            <div className="flex-1 flex flex-col min-w-0">
                <Header setMobileOpen={setMobileOpen} />
                <main className="flex-1 p-4 sm:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>
                <Footer />
            </div>
        </div>
    );
}
