"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { FilePlus, Loader2, User, Shield } from "lucide-react"

export default function DashboardPage() {
    const { fetchWithAuth } = useAuth()
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadProfile = async () => {
            try {
                // fetchWithAuth handles 401s and token refreshes automatically
                // fetchWithAuth now returns data directly
                // @ts-ignore
                const data = await fetchWithAuth("/api/secure/profile")
                setProfile(data.user)
            } catch (err) {
                console.error("Dashboard profile fetch error:", err)
                setError("Could not load profile. Please try refreshing.")
            } finally {
                setLoading(false)
            }
        }

        loadProfile()
    }, [fetchWithAuth])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                <h3 className="font-semibold mb-2">Error Loading Dashboard</h3>
                <p>{error}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Overview of your activity.</p>
            </div>

            {/* Profile Section */}
            {profile && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-card text-card-foreground shadow p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="tracking-tight text-sm font-medium">User Profile</h3>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="pt-4">
                            <div className="text-2xl font-bold">{profile.fullName || "User"}</div>
                            <p className="text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-card text-card-foreground shadow p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="tracking-tight text-sm font-medium">Roles</h3>
                            <Shield className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="pt-4">
                            <div className="text-2xl font-bold">
                                {profile.roles && profile.roles.length > 0 ? profile.roles.join(", ") : "No Roles"}
                            </div>
                            <p className="text-xs text-muted-foreground">Assigned permissions</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-1 items-center justify-center min-h-[300px] rounded-lg border border-dashed border-border p-8 text-center animate-in fade-in-50">
                <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                        <FilePlus className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">No data available</h3>
                    <p className="mb-4 mt-2 text-sm text-muted-foreground">
                        You haven&apos;t created any projects yet. Start by creating your first project.
                    </p>
                    <button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                        Create Project
                    </button>
                </div>
            </div>
        </div>
    )
}
