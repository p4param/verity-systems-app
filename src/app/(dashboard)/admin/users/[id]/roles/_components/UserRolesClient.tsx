"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { Save, X } from "lucide-react"

type Role = {
    id: number
    name: string
}

export function UserRolesClient({
    userId
}: {
    userId: number
}) {
    const { fetchWithAuth, user: currentUser } = useAuth()
    const router = useRouter()

    const [allRoles, setAllRoles] = useState<Role[]>([])
    const [assignedRoleIds, setAssignedRoleIds] = useState<Set<number>>(new Set())

    // UI State
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                // 1. Fetch available roles
                const rolesData = await fetchWithAuth<any[]>("/api/admin/roles")
                setAllRoles(rolesData.map(r => ({ id: r.id, name: r.name })))

                // 2. Fetch assigned roles
                const userRolesData = await fetchWithAuth<Role[]>(`/api/admin/users/${userId}/roles`)
                setAssignedRoleIds(new Set(userRolesData.map(r => r.id)))

            } catch (err: any) {
                setError(err.message || "Failed to load data")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [userId, fetchWithAuth])

    const toggleRole = (roleId: number) => {
        const next = new Set(assignedRoleIds)
        if (next.has(roleId)) next.delete(roleId)
        else next.add(roleId)
        setAssignedRoleIds(next)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        try {
            await fetchWithAuth(`/api/admin/users/${userId}/roles`, {
                method: "PUT",
                body: JSON.stringify({
                    roleIds: Array.from(assignedRoleIds)
                })
            })
            router.push("/admin/users")
            router.refresh()
        } catch (err: any) {
            setError(err.message || "Failed to save roles")
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-6">Loading...</div>

    return (
        <div className="max-w-2xl mx-auto p-6 bg-card rounded-lg shadow-sm mt-6">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Manage Roles</h1>
                    <p className="text-muted-foreground">
                        Assign roles to User ID: <span className="font-mono">{userId}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                        disabled={saving}
                    >
                        <X size={16} />
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="user-roles-form"
                        className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm font-medium">
                    {error}
                </div>
            )}

            <form id="user-roles-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Available Roles</label>
                    <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                        {allRoles.map(role => (
                            <label
                                key={role.id}
                                className="flex items-center space-x-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={assignedRoleIds.has(role.id)}
                                    onChange={() => toggleRole(role.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">{role.name}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>


            </form>
        </div>
    )
}
