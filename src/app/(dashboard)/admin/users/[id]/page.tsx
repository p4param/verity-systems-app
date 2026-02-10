"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import Link from "next/link"
import { AdminUserSessions } from "./_components/AdminUserSessions"
import { AdminMfaResetButton } from "./_components/AdminMfaResetButton"
import { ResendInviteButton } from "./_components/ResendInviteButton"
import { CheckCircle, XCircle, Clock } from "lucide-react"

type UserStatus = "PENDING" | "ACTIVE" | "DISABLED"

type User = {
    id: number
    email: string
    fullName: string
    isActive: boolean
    mfaEnabled: boolean
    status: UserStatus
    userRoles: Array<{
        role: {
            id: number
            name: string
        }
    }>
}

function StatusBadge({ status }: { status: UserStatus }) {
    const variants = {
        PENDING: {
            icon: Clock,
            className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
            label: "Pending Activation"
        },
        ACTIVE: {
            icon: CheckCircle,
            className: "bg-green-500/10 text-green-500 border-green-500/20",
            label: "Active"
        },
        DISABLED: {
            icon: XCircle,
            className: "bg-red-500/10 text-red-500 border-red-500/20",
            label: "Disabled"
        }
    }

    const variant = variants[status] || variants.PENDING
    const Icon = variant.icon

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${variant.className}`}>
            <Icon className="h-4 w-4" />
            {variant.label}
        </span>
    )
}

export default function UserDetailPage() {
    const params = useParams()
    const router = useRouter()
    const { fetchWithAuth } = useAuth()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const userId = params.id as string

    useEffect(() => {
        const loadUser = async () => {
            try {
                const data = await fetchWithAuth<User>(`/api/admin/users/${userId}`)
                setUser(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load user")
            } finally {
                setLoading(false)
            }
        }

        loadUser()
    }, [userId, fetchWithAuth])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (error || !user) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">User Not Found</h1>
                    <Link
                        href="/admin/users"
                        className="text-sm text-primary hover:underline"
                    >
                        ← Back to Users
                    </Link>
                </div>
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                    {error || "User not found"}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">User Details</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        View and manage user information
                    </p>
                </div>
                <Link
                    href="/admin/users"
                    className="text-sm text-primary hover:underline"
                >
                    ← Back to Users
                </Link>
            </div>

            {/* Profile Card */}
            <div className="rounded-lg bg-card text-card-foreground shadow-sm">
                <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h2 className="text-xl font-semibold">{user.fullName}</h2>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <StatusBadge status={user.status} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Account Status</p>
                            <p className="text-sm mt-1">
                                {user.isActive ? "Active" : "Inactive"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">MFA Status</p>
                            <p className="text-sm mt-1">
                                {user.mfaEnabled ? "Enabled" : "Disabled"}
                            </p>
                        </div>
                    </div>

                    {user.status === "PENDING" && (
                        <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-muted-foreground mb-2">Account Activation</p>
                            <ResendInviteButton
                                userId={user.id}
                                userEmail={user.email}
                                userStatus={user.status}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Roles Card */}
            <div className="rounded-lg bg-card text-card-foreground shadow-sm">
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Assigned Roles</h3>
                    {user.userRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {user.userRoles.map(({ role }) => (
                                <span
                                    key={role.id}
                                    className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground"
                                >
                                    {role.name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No roles assigned</p>
                    )}
                </div>
            </div>

            {/* Security Settings */}
            <div className="rounded-lg bg-card text-card-foreground shadow-sm">
                <div className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Security Settings</h3>

                    {user.mfaEnabled && (
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                            <div>
                                <p className="font-medium">Multi-Factor Authentication</p>
                                <p className="text-sm text-muted-foreground">MFA is enabled for this user</p>
                            </div>
                            <AdminMfaResetButton userId={user.id} userEmail={user.email} mfaEnabled={user.mfaEnabled} />
                        </div>
                    )}

                    <div className="pt-4 border-t">
                        <AdminUserSessions userId={user.id} />
                    </div>
                </div>
            </div>
        </div>
    )
}
