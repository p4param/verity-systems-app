"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react"

type AdminResponse = {
    message?: string
    user?: unknown
}

export default function AdminPage() {
    const { fetchWithAuth } = useAuth()

    const [data, setData] = useState<AdminResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isForbidden, setIsForbidden] = useState(false)

    useEffect(() => {
        const loadAdminData = async () => {
            try {
                const json = await fetchWithAuth<AdminResponse>(
                    "/api/secure/admin-only"
                )
                setData(json)
            } catch (err: any) {
                if (err.message === "Forbidden" || err.message === "Unauthorized") {
                    setIsForbidden(true)
                    return
                }

                console.error("Admin page fetch error:", err)
                setError(err.message || "Something went wrong.")
            } finally {
                setLoading(false)
            }
        }

        loadAdminData()
    }, [fetchWithAuth])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (isForbidden) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 border border-destructive/20 bg-destructive/5 rounded-lg">
                <div className="p-4 rounded-full bg-destructive/10 mb-4">
                    <ShieldAlert className="h-10 w-10 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold text-destructive mb-2">
                    Access Denied
                </h2>
                <p className="text-muted-foreground max-w-md">
                    You do not have permission to view this page.
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                <h3 className="font-semibold mb-2">Error</h3>
                <p>{error}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Admin Console
                </h1>
                <p className="text-muted-foreground">
                    Secure area for administrative tasks.
                </p>
            </div>

            <div className="rounded-xl bg-card text-card-foreground shadow p-8">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                        <ShieldCheck className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-green-700 dark:text-green-400">
                            {data?.message || "Admin Access Granted"}
                        </h2>
                        <p className="text-muted-foreground mt-2">
                            You have successfully authenticated as an Administrator.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
