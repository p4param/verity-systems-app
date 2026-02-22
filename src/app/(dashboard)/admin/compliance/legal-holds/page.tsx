"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import {
    Shield,
    Plus,
    Search,
    MoreVertical,
    AlertCircle,
    CheckCircle2,
    XCircle,
    FileText,
    Folder,
    ExternalLink,
    Loader2,
    Calendar,
    Users
} from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/Modal"

type LegalHold = {
    id: string
    name: string
    reason: string
    description?: string
    startDate: string
    endDate?: string
    isActive: boolean
    releasedAt?: string
    _count: { targets: number }
}

export default function LegalHoldsPage() {
    const { fetchWithAuth } = useAuth()
    const [holds, setHolds] = useState<LegalHold[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")

    // Create Modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [newHold, setNewHold] = useState({
        name: "",
        reason: "",
        description: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
    })
    const [submitting, setSubmitting] = useState(false)

    // Target Modal state
    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false)
    const [currentTargetId, setCurrentTargetId] = useState<string | null>(null)
    const [targets, setTargets] = useState<any[]>([])
    const [loadingTargets, setLoadingTargets] = useState(false)

    const loadHolds = async () => {
        try {
            setLoading(true)
            const response = await fetchWithAuth<{ success: boolean, data: LegalHold[] }>("/api/secure/dms/legal-holds")
            if (response.success) {
                setHolds(response.data)
            }
        } catch (err: any) {
            setError(err.message || "Failed to load legal holds")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadHolds()
    }, [fetchWithAuth])

    const handleCreateHold = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const response = await fetchWithAuth<{ success: boolean }>("/api/secure/dms/legal-holds", {
                method: "POST",
                body: JSON.stringify(newHold)
            })
            if (response.success) {
                setIsCreateModalOpen(false)
                setNewHold({
                    name: "",
                    reason: "",
                    description: "",
                    startDate: format(new Date(), "yyyy-MM-dd"),
                })
                loadHolds()
            }
        } catch (err: any) {
            alert(err.message || "Failed to create legal hold")
        } finally {
            setSubmitting(false)
        }
    }

    const handleViewTargets = async (holdId: string) => {
        setCurrentTargetId(holdId)
        setIsTargetModalOpen(true)
        setLoadingTargets(true)
        try {
            const response = await fetchWithAuth<{ success: boolean, data: any[] }>(`/api/secure/dms/legal-holds/${holdId}/targets`)
            if (response.success) {
                setTargets(response.data)
            }
        } catch (err: any) {
            console.error(err)
        } finally {
            setLoadingTargets(false)
        }
    }

    const handleReleaseHold = async (holdId: string) => {
        if (!confirm("Are you sure you want to release this legal hold? Locked documents will be released unless covered by other active holds.")) {
            return
        }

        try {
            const response = await fetchWithAuth<{ success: boolean }>(`/api/secure/dms/legal-holds/${holdId}/release`, {
                method: "POST"
            })
            if (response.success) {
                loadHolds()
            }
        } catch (err: any) {
            alert(err.message || "Failed to release legal hold")
        }
    }

    const filteredHolds = holds.filter(hold =>
        hold.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hold.reason.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading && holds.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
                        <Shield className="h-8 w-8 text-primary" />
                        Legal Holds
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage preservation orders and immutable document holds.
                    </p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Legal Hold
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search holds by name or reason..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Targets</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHolds.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No legal holds found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredHolds.map((hold) => (
                                    <TableRow key={hold.id}>
                                        <TableCell>
                                            {hold.isActive ? (
                                                <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20 gap-1.5 px-2">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground gap-1.5 px-2">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Released
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {hold.name}
                                        </TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={hold.reason}>
                                            {hold.reason}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {format(new Date(hold.startDate), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0 flex items-center gap-1.5"
                                                onClick={() => handleViewTargets(hold.id)}
                                            >
                                                <Users className="h-4 w-4" />
                                                {hold._count.targets} targets
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {hold.isActive && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleReleaseHold(hold.id)}
                                                >
                                                    Release
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Targets Modal */}
            <Modal
                isOpen={isTargetModalOpen}
                onClose={() => setIsTargetModalOpen(false)}
                title="Hold Protection Targets"
            >
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    {loadingTargets ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : targets.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No targets currently attached to this hold.
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {targets.map((target) => (
                                <div key={target.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background p-1.5 rounded border">
                                            {target.targetType === 'FOLDER' ? (
                                                <Folder className="h-4 w-4 text-primary" />
                                            ) : (
                                                <FileText className="h-4 w-4 text-primary" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">{target.targetId}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                {target.targetType}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create New Legal Hold"
            >
                <form onSubmit={handleCreateHold} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Hold Name</label>
                        <Input
                            required
                            placeholder="e.g. Litigation - Case #12345"
                            value={newHold.name}
                            onChange={(e) => setNewHold({ ...newHold, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Reason for Hold</label>
                        <Input
                            required
                            placeholder="Briefly describe why this hold is being imposed"
                            value={newHold.reason}
                            onChange={(e) => setNewHold({ ...newHold, reason: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description (Optional)</label>
                        <textarea
                            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Additional context about the legal hold..."
                            value={newHold.description}
                            onChange={(e) => setNewHold({ ...newHold, description: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start Date</label>
                            <Input
                                type="date"
                                required
                                value={newHold.startDate}
                                onChange={(e) => setNewHold({ ...newHold, startDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Create Hold
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
