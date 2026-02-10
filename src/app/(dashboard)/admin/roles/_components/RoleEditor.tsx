"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { Save, X } from "lucide-react"

type Permission = {
    id: number
    code: string
    description?: string
}

export function RoleEditor({ roleId }: { roleId?: number }) {
    const { fetchWithAuth } = useAuth()
    const router = useRouter()

    // Data state
    const [allPermissions, setAllPermissions] = useState<Permission[]>([])

    // Form state
    const [roleName, setRoleName] = useState("")
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set())

    // UI state
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                // Fetch all permissions
                const perms = await fetchWithAuth<Permission[]>("/api/admin/permissions")
                setAllPermissions(perms)

                if (roleId) {
                    // Fetch existing role
                    const role = await fetchWithAuth<any>(`/api/admin/roles/${roleId}`)
                    setRoleName(role.name)

                    // Map codes to IDs
                    // The role API returns permission CODES. 
                    // We need to map them back to IDs to populate our set.
                    const rolePermCodes = new Set(role.permissions)
                    const rolePermIds = new Set<number>()

                    perms.forEach(p => {
                        if (rolePermCodes.has(p.code)) {
                            rolePermIds.add(p.id)
                        }
                    })

                    setSelectedPermissionIds(rolePermIds)
                }
            } catch (err: any) {
                console.error(err)
                setError(err.message || "Failed to load data")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [roleId, fetchWithAuth])

    const togglePermission = (id: number) => {
        const next = new Set(selectedPermissionIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedPermissionIds(next)
    }

    // Group permissions by prefix
    const groupedPermissions = allPermissions.reduce((acc, perm) => {
        const prefix = perm.code.split('_')[0]
        if (!acc[prefix]) acc[prefix] = []
        acc[prefix].push(perm)
        return acc
    }, {} as Record<string, Permission[]>)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        if (selectedPermissionIds.size === 0) {
            setError("Please select at least one permission.")
            setSaving(false)
            return
        }

        try {
            const payload = {
                name: roleName,
                permissionIds: Array.from(selectedPermissionIds)
            }

            if (roleId) {
                await fetchWithAuth(`/api/admin/roles/${roleId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                })
            } else {
                await fetchWithAuth("/api/admin/roles", {
                    method: "POST",
                    body: JSON.stringify(payload)
                })
            }

            router.push("/admin/roles")
            router.refresh()
        } catch (err: any) {
            setError(err.message || "Failed to save role")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>
    }

    return (
        <div className="max-w-2xl mx-auto p-6 bg-card rounded-lg border shadow-sm">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {roleId ? "Edit Role" : "Create New Role"}
                    </h1>
                    <p className="text-muted-foreground">
                        Define the role name and assign permissions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                        disabled={saving}
                    >
                        <X size={16} />
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="role-form"
                        className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                        disabled={saving || selectedPermissionIds.size === 0 || !roleName}
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

            <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Role Name
                    </label>
                    <input
                        type="text"
                        value={roleName}
                        onChange={e => setRoleName(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="e.g. Content Editor"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Permissions</label>

                    <div className="border rounded-md max-h-[500px] overflow-y-auto p-4 space-y-6">
                        {Object.entries(groupedPermissions).map(([group, permissions]) => (
                            <div key={group}>
                                <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                                    {group}
                                    <span className="text-xs font-normal px-2 py-0.5 bg-muted rounded-full">
                                        {permissions.filter(p => selectedPermissionIds.has(p.id)).length}/{permissions.length}
                                    </span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {permissions.map(perm => (
                                        <label
                                            key={perm.id}
                                            className={`flex items-start space-x-3 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors ${selectedPermissionIds.has(perm.id)
                                                ? "border-primary/50 bg-primary/5"
                                                : "border-border"
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissionIds.has(perm.id)}
                                                onChange={() => togglePermission(perm.id)}
                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium leading-none mb-1">
                                                    {perm.code}
                                                </span>
                                                {perm.description && (
                                                    <span className="text-[11px] text-muted-foreground line-clamp-2">
                                                        {perm.description}
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {allPermissions.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground">
                                No permissions found.
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center">
                        <p className="text-[0.8rem] text-muted-foreground">
                            Select functionalities this role can access.
                        </p>
                        <span className="text-xs font-medium">
                            {selectedPermissionIds.size} selected
                        </span>
                    </div>

                    {selectedPermissionIds.size === 0 && (
                        <p className="text-[0.8rem] text-destructive font-medium">
                            At least one permission is required.
                        </p>
                    )}
                </div>


            </form>
        </div>
    )
}
