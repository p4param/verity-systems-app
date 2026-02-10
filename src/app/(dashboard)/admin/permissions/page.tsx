"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Lock } from "lucide-react"

type Permission = {
    id: number
    code: string
    description?: string
}

export default function PermissionsPage() {
    const { fetchWithAuth, loading: authLoading } = useAuth()
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        if (authLoading) return

        const load = async () => {
            try {
                const data = await fetchWithAuth<Permission[]>("/api/admin/permissions")
                setPermissions(data)
            } catch (err: any) {
                // Suppress session expired error as it's handled by auth context redirection
                if (err.message !== "Session expired") {
                    setError(err instanceof Error ? err.message : "Failed to load permissions")
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [fetchWithAuth, authLoading])

    if (loading) {
        return <div className="p-6">Loading permissions...</div>
    }

    if (error) {
        return <div className="p-6 text-red-600">{error}</div>
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Permissions</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Read-only list of available system permissions.
                    </p>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {permissions.map((perm) => (
                    <div
                        key={perm.id}
                        className="bg-card rounded-lg p-4"
                    >
                        <div className="flex items-start gap-3">
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-mono text-sm font-medium mb-1 break-all">
                                    {perm.code}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {perm.description || "-"}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                        {permissions.map((perm) => (
                            <tr key={perm.id} className="hover:bg-muted/50">
                                <td className="px-4 py-3 font-mono text-sm">{perm.code}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {perm.description || "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="text-xs text-muted-foreground">
                Total Permissions: {permissions.length}
            </div>
        </div>
    )
}
