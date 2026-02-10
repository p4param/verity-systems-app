"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/auth-context"
import { Pencil, Trash2, Shield, Plus } from "lucide-react"

type Role = {
    id: number
    name: string
    description: string
    isSystem: boolean
    permissions: string[]
    userCount?: number
    createdAt: string
}

type DeleteConfirmModalProps = {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    role: Role | null
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, role }: DeleteConfirmModalProps) {
    if (!isOpen || !role) return null

    const hasUsers = (role.userCount ?? 0) > 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-lg shadow-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <h2 className="text-xl font-semibold mb-2">Delete Role</h2>

                    {hasUsers ? (
                        <div className="space-y-4">
                            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                                <p className="text-sm text-destructive font-medium">
                                    Cannot delete this role
                                </p>
                                <p className="text-sm text-destructive/80 mt-1">
                                    This role is assigned to {role.userCount} user{role.userCount !== 1 ? 's' : ''}.
                                    Remove all user assignments before deleting.
                                </p>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-muted-foreground">
                                Are you sure you want to delete the role <strong>"{role.name}"</strong>?
                            </p>
                            <p className="text-sm text-muted-foreground">
                                This action cannot be undone. The role and its permission assignments will be permanently removed.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm()
                                        onClose()
                                    }}
                                    className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                                >
                                    Delete Role
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function RolesPage() {
    const { fetchWithAuth } = useAuth()
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean
        role: Role | null
    }>({ isOpen: false, role: null })

    const loadRoles = async () => {
        try {
            const data = await fetchWithAuth<Role[]>("/api/admin/roles")
            setRoles(data)
            setError("")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load roles")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadRoles()
    }, [])

    const handleDelete = async (roleId: number) => {
        try {
            await fetchWithAuth(`/api/admin/roles/${roleId}`, {
                method: "DELETE"
            })
            await loadRoles()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete role")
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        })
    }

    if (loading) {
        return <div className="p-6">Loading roles...</div>
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
                <Link
                    href="/admin/roles/new"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Create Role
                </Link>
            </div>

            {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    {error}
                </div>
            )}

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {roles.map(role => (
                    <div
                        key={role.id}
                        className="bg-card rounded-lg p-4"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                                <h3 className="font-medium truncate">{role.name}</h3>
                            </div>
                            {role.isSystem && (
                                <span className="text-[10px] bg-muted text-muted-foreground border rounded px-1.5 py-0.5 ml-2 shrink-0">
                                    SYSTEM
                                </span>
                            )}
                        </div>

                        {role.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {role.description}
                            </p>
                        )}

                        <div className="flex gap-4 text-sm text-muted-foreground mb-3">
                            <span>{role.permissions.length} permissions</span>
                            {role.userCount !== undefined && (
                                <span>{role.userCount} user{role.userCount !== 1 ? 's' : ''}</span>
                            )}
                        </div>

                        <div className="text-xs text-muted-foreground mb-3">
                            Created {formatDate(role.createdAt)}
                        </div>

                        <div className="flex items-center gap-2">
                            <Link
                                href={`/admin/roles/${role.id}`}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary border border-primary/20 rounded-md hover:bg-primary/10 transition-colors"
                            >
                                <Pencil size={16} />
                                Edit
                            </Link>
                            <button
                                onClick={() => setDeleteModal({ isOpen: true, role })}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${role.isSystem
                                        ? "text-muted-foreground/50 border border-muted/20 cursor-not-allowed"
                                        : "text-destructive border border-destructive/20 hover:bg-destructive/10"
                                    }`}
                                disabled={role.isSystem}
                                title={role.isSystem ? "System roles cannot be deleted" : "Delete role"}
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                        </div>
                    </div>
                ))}

                {roles.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        No roles found. Create your first role to get started.
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                        <thead className="[&_tr]:border-b-2 border-background">
                            <tr className="border-b-2 border-background transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Role
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Description
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Permissions
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Users
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Created
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="[&_tr:last-child]:border-0">
                            {roles.map(role => (
                                <tr
                                    key={role.id}
                                    className="border-b-2 border-background transition-colors hover:bg-muted/50"
                                >
                                    <td className="p-4 align-middle font-medium">
                                        <div className="flex items-center gap-2">
                                            {role.name}
                                            {role.isSystem && (
                                                <span className="text-[10px] bg-muted text-muted-foreground border rounded px-1.5 py-0.5">
                                                    SYSTEM
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="p-4 align-middle max-w-xs">
                                        <span className="text-muted-foreground line-clamp-2">
                                            {role.description || "—"}
                                        </span>
                                    </td>

                                    <td className="p-4 align-middle">
                                        <span className="text-muted-foreground">
                                            {role.permissions.length}
                                        </span>
                                    </td>

                                    <td className="p-4 align-middle">
                                        <span className="text-muted-foreground">
                                            {role.userCount ?? "—"}
                                        </span>
                                    </td>

                                    <td className="p-4 align-middle">
                                        <span className="text-muted-foreground text-sm">
                                            {formatDate(role.createdAt)}
                                        </span>
                                    </td>

                                    <td className="p-4 align-middle text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/admin/roles/${role.id}`}
                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
                                                title="Edit Role"
                                            >
                                                <Pencil size={18} />
                                            </Link>
                                            <button
                                                onClick={() => setDeleteModal({ isOpen: true, role })}
                                                className={`p-2 rounded-md transition-colors ${role.isSystem
                                                        ? "text-muted-foreground/50 cursor-not-allowed"
                                                        : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    }`}
                                                disabled={role.isSystem}
                                                title={role.isSystem ? "System roles cannot be deleted" : "Delete role"}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {roles.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        No roles found. Create your first role to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, role: null })}
                onConfirm={() => {
                    if (deleteModal.role) {
                        handleDelete(deleteModal.role.id)
                    }
                }}
                role={deleteModal.role}
            />
        </div>
    )
}
