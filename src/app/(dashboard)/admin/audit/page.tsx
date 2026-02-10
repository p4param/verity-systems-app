"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { FileText, Copy, Check, ChevronLeft, ChevronRight, Filter, X } from "lucide-react"

type AuditEvent = {
    id: string
    action: string
    actorUserId: number | null
    actorEmail: string | null
    actorType: string
    targetType: string | null
    targetId: number | null
    ipAddress: string
    correlationId: string | null
    details: string | null
    createdAt: string
}

type FilterState = {
    action: string
    actorEmail: string
    dateFrom: string
    dateTo: string
}

type EventDetailModalProps = {
    isOpen: boolean
    onClose: () => void
    event: AuditEvent | null
}

function EventDetailModal({ isOpen, onClose, event }: EventDetailModalProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null)

    if (!isOpen || !event) return null

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })
    }

    const formatMetadata = (details: string | null) => {
        if (!details) return "No metadata"
        try {
            const parsed = JSON.parse(details)
            return JSON.stringify(parsed, null, 2)
        } catch {
            return details
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Audit Event Details</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-md transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Action</label>
                            <p className="mt-1 font-mono text-sm bg-muted px-3 py-2 rounded-md">{event.action}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Actor Type</label>
                                <p className="mt-1">{event.actorType}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Actor Email</label>
                                <p className="mt-1">{event.actorEmail || "—"}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Target Type</label>
                                <p className="mt-1">{event.targetType || "—"}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Target ID</label>
                                <p className="mt-1">{event.targetId || "—"}</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                            <p className="mt-1">{formatDate(event.createdAt)}</p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                            <p className="mt-1 font-mono text-sm">{event.ipAddress}</p>
                        </div>

                        {event.correlationId && (
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Correlation ID</label>
                                <div className="mt-1 flex items-center gap-2">
                                    <p className="font-mono text-sm bg-muted px-3 py-2 rounded-md flex-1 truncate">
                                        {event.correlationId}
                                    </p>
                                    <button
                                        onClick={() => copyToClipboard(event.correlationId!, "correlationId")}
                                        className="p-2 hover:bg-muted rounded-md transition-colors"
                                        title="Copy Correlation ID"
                                    >
                                        {copiedField === "correlationId" ? (
                                            <Check className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                            <pre className="mt-1 text-xs bg-muted px-3 py-2 rounded-md overflow-x-auto max-h-60">
                                {formatMetadata(event.details)}
                            </pre>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-border flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function AuditViewerPage() {
    const { fetchWithAuth } = useAuth()
    const [events, setEvents] = useState<AuditEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState<FilterState>({
        action: "",
        actorEmail: "",
        dateFrom: "",
        dateTo: ""
    })
    const [appliedFilters, setAppliedFilters] = useState<FilterState>(filters)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const loadEvents = async (currentPage: number = 1) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: "50"
            })

            if (appliedFilters.action) params.append("action", appliedFilters.action)
            if (appliedFilters.actorEmail) params.append("actorEmail", appliedFilters.actorEmail)
            if (appliedFilters.dateFrom) params.append("dateFrom", appliedFilters.dateFrom)
            if (appliedFilters.dateTo) params.append("dateTo", appliedFilters.dateTo)

            const data = await fetchWithAuth<{ events: AuditEvent[]; hasMore: boolean }>(
                `/api/admin/audit-events?${params.toString()}`
            )

            setEvents(data.events)
            setHasMore(data.hasMore)
            setError("")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load audit events")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadEvents(page)
    }, [page, appliedFilters])

    const handleApplyFilters = () => {
        setAppliedFilters(filters)
        setPage(1)
        setShowFilters(false)
    }

    const handleClearFilters = () => {
        const emptyFilters = { action: "", actorEmail: "", dateFrom: "", dateTo: "" }
        setFilters(emptyFilters)
        setAppliedFilters(emptyFilters)
        setPage(1)
        setShowFilters(false)
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    const hasActiveFilters = appliedFilters.action || appliedFilters.actorEmail || appliedFilters.dateFrom || appliedFilters.dateTo

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Audit Log</h1>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${hasActiveFilters
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                >
                    <Filter className="h-4 w-4" />
                    Filters {hasActiveFilters && `(${Object.values(appliedFilters).filter(Boolean).length})`}
                </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-card rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Action</label>
                            <input
                                type="text"
                                value={filters.action}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                                placeholder="e.g., USER.CREATE"
                                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Actor Email</label>
                            <input
                                type="email"
                                value={filters.actorEmail}
                                onChange={(e) => setFilters({ ...filters, actorEmail: e.target.value })}
                                placeholder="user@example.com"
                                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Date From</label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Date To</label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end mt-4">
                        <button
                            onClick={handleClearFilters}
                            className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleApplyFilters}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="p-6 text-center text-muted-foreground">Loading audit events...</div>
            ) : events.length === 0 ? (
                <div className="bg-card rounded-lg p-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No audit events found</h3>
                    <p className="text-muted-foreground">
                        {hasActiveFilters
                            ? "Try adjusting your filters to see more results."
                            : "Audit events will appear here as actions are performed."}
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-3">
                        {events.map((event) => (
                            <div
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className="bg-card rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <span className="font-mono text-sm font-medium">{event.action}</span>
                                    <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <div>Actor: {event.actorEmail || event.actorType}</div>
                                    {event.targetType && <div>Target: {event.targetType}</div>}
                                    <div className="font-mono text-xs">{event.ipAddress}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block rounded-lg bg-card shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr className="bg-muted/50">
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">Timestamp</th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">Action</th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">Actor</th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">Target</th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">IP Address</th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">Correlation ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((event) => (
                                        <tr
                                            key={event.id}
                                            onClick={() => setSelectedEvent(event)}
                                            className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                                        >
                                            <td className="p-4 whitespace-nowrap">{formatDate(event.createdAt)}</td>
                                            <td className="p-4">
                                                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                                    {event.action}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm">{event.actorEmail || "—"}</div>
                                                <div className="text-xs text-muted-foreground">{event.actorType}</div>
                                            </td>
                                            <td className="p-4">
                                                {event.targetType ? (
                                                    <div className="text-sm">
                                                        {event.targetType}
                                                        {event.targetId && ` #${event.targetId}`}
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="p-4 font-mono text-xs">{event.ipAddress}</td>
                                            <td className="p-4">
                                                {event.correlationId ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs truncate max-w-[120px]">
                                                            {event.correlationId}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                copyToClipboard(event.correlationId!, event.id)
                                                            }}
                                                            className="p-1 hover:bg-muted rounded transition-colors"
                                                            title="Copy Correlation ID"
                                                        >
                                                            {copiedId === event.id ? (
                                                                <Check className="h-3 w-3 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            Page {page}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(page - 1)}
                                disabled={page === 1}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={!hasMore}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}

            <EventDetailModal
                isOpen={selectedEvent !== null}
                onClose={() => setSelectedEvent(null)}
                event={selectedEvent}
            />
        </div>
    )
}
