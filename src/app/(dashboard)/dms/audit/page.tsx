"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
    Loader2,
    ShieldAlert,
    Activity,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Filter,
    Download,
    FileSpreadsheet,
    FileText
} from "lucide-react"
import { AdvancedAuditFilterDrawer } from "@/components/dms/AdvancedAuditFilterDrawer"
import { DataTableHeader, SortOrder } from "@/components/dms/DataTableHeader"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface AuditLogItem {
    id: number
    action: string
    entityType: string | null
    entityId: string | null
    entityName: string
    details: string | null
    metadata: any
    actorName: string
    actorEmail: string | undefined
    createdAt: string
    ipAddress: string | null
}

interface AuditResponse {
    items: AuditLogItem[]
    total: number
    page: number
    limit: number
    totalPages: number
}

interface UserOption {
    id: number
    fullName: string
    email: string
}

export default function DmsAuditPage() {
    const { fetchWithAuth } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // State
    const [logs, setLogs] = useState<AuditLogItem[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [users, setUsers] = useState<UserOption[]>([])
    const [totalPages, setTotalPages] = useState(1)
    const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false)

    // Derived State
    const page = parseInt(searchParams.get("page") || "1")
    const activeFilterCount = Array.from(searchParams.entries()).filter(([key, val]) => {
        return ['startDate', 'endDate', 'action', 'userId', 'entityType'].includes(key) && val
    }).length

    // Fetch Users for Dropdown
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const res = await fetchWithAuth<any[]>("/api/admin/users?limit=100")
                if (Array.isArray(res)) {
                    setUsers(res.map(u => ({ id: u.id, fullName: u.fullName, email: u.email })))
                }
            } catch (err) {
                console.warn("Failed to load users for filter dropdown", err)
            }
        }
        loadUsers()
    }, [fetchWithAuth])

    // Fetch Logs
    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const params = new URLSearchParams(searchParams.toString())
            if (!params.has("page")) params.set("page", "1")

            const res = await fetchWithAuth(`/api/secure/dms/audit?${params.toString()}`)

            if (res.error) throw new Error(res.error.message)

            const data: AuditResponse = res
            setLogs(data.items)
            setTotalPages(data.totalPages)
        } catch (err: any) {
            setError(err.message || "Failed to load audit logs")
        } finally {
            setLoading(false)
        }
    }, [fetchWithAuth, searchParams])

    // Trigger fetch on URL change
    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    // Handlers
    const updateUrl = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        if (!updates.page) params.set("page", "1")
        router.push(pathname + "?" + params.toString())
    }

    const handleSort = (key: string, direction: SortOrder) => {
        updateUrl({
            sortBy: direction ? key : null,
            sortOrder: direction
        })
    }

    const currentSort = {
        key: searchParams.get("sortBy") || "createdAt",
        direction: (searchParams.get("sortOrder") as SortOrder) || "desc"
    }

    // Helper: Format Date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    // Helper: Action Badge Color
    const getActionBadgeColor = (action: string) => {
        if (action.includes("CREATE")) return "bg-green-100 text-green-700 border-green-200"
        if (action.includes("UPDATE")) return "bg-blue-100 text-blue-700 border-blue-200"
        if (action.includes("DELETE")) return "bg-red-100 text-red-700 border-red-200"
        if (action.includes("APPROVE")) return "bg-emerald-100 text-emerald-700 border-emerald-200"
        if (action.includes("REJECT")) return "bg-orange-100 text-orange-700 border-orange-200"
        if (action.includes("SUBMIT")) return "bg-indigo-100 text-indigo-700 border-indigo-200"
        return "bg-gray-100 text-gray-700 border-gray-200"
    }

    const ACTION_OPTIONS = [
        { value: "DMS.DOCUMENT_CREATE", label: "Create Document" },
        { value: "DMS.DOCUMENT_UPDATE", label: "Update Document" },
        { value: "DMS.DOCUMENT_DELETE", label: "Delete Document" },
        { value: "DMS.SUBMIT", label: "Submit" },
        { value: "DMS.APPROVE", label: "Approve" },
        { value: "DMS.REJECT", label: "Reject" },
        { value: "DMS.REVISE", label: "Revise" },
        { value: "DMS.OBSOLETE", label: "Make Obsolete" },
        { value: "DMS.VERSION_CREATE", label: "New Version" },
        { value: "DMS.FOLDER_CREATE", label: "Create Folder" },
        { value: "DMS.FOLDER_UPDATE", label: "Update Folder" },
        { value: "DMS.FOLDER_DELETE", label: "Delete Folder" },
    ]

    const ENTITY_TYPES = [
        { value: "DOCUMENT", label: "Document" },
        { value: "FOLDER", label: "Folder" },
        { value: "VERSION", label: "Version" },
        { value: "WORKFLOW", label: "Workflow" }
    ]

    const handleFilter = (key: string, value: any) => {
        updateUrl({ [key]: value || null })
    }

    // New: Handle Export
    const handleExport = async (format: 'excel' | 'pdf') => {
        try {
            setExporting(true)

            // 1. Fetch all matching logs (high limit)
            const params = new URLSearchParams(searchParams.toString())
            params.set("limit", "10000") // Fetch up to 10k for export
            params.delete("page")

            const res = await fetchWithAuth(`/api/secure/dms/audit?${params.toString()}`)
            if (res.error) throw new Error(res.error.message)

            const data: AuditLogItem[] = res.items

            if (data.length === 0) {
                alert("No data to export")
                return
            }

            // 2. Format Data
            const rows = data.map(log => ({
                Timestamp: new Date(log.createdAt).toLocaleString(),
                Action: log.action.replace("DMS.", ""),
                Entity: log.entityType,
                "Entity Name": log.entityName,
                User: log.actorName,
                Email: log.actorEmail,
                Details: log.details,
                Metadata: log.metadata ? JSON.stringify(log.metadata) : ""
            }))

            const timestamp = new Date().toISOString().split('T')[0]
            const filename = `Audit_Logs_${timestamp}`

            // 3. Generate File
            if (format === 'excel') {
                const worksheet = XLSX.utils.json_to_sheet(rows)
                const workbook = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs")
                XLSX.writeFile(workbook, `${filename}.xlsx`)
            } else {
                const doc = new jsPDF()
                doc.text("DMS Audit Logs", 14, 15)
                doc.setFontSize(10)
                doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)

                autoTable(doc, {
                    startY: 25,
                    head: [['Timestamp', 'Action', 'Entity', 'User', 'Details']],
                    body: data.map(log => [
                        new Date(log.createdAt).toLocaleString(),
                        log.action.replace("DMS.", ""),
                        `${log.entityType}\n${log.entityName}`,
                        log.actorName,
                        log.details || "-"
                    ]),
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                })

                doc.save(`${filename}.pdf`)
            }

        } catch (err: any) {
            console.error("Export failed", err)
            setError("Failed to export logs: " + err.message)
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background flex-1 overflow-hidden">

            {/* Header / Toolbar */}
            <div className="p-4 border-b flex items-center justify-between gap-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="flex items-center gap-2 flex-1">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2 mr-4">
                        <Activity className="text-primary" size={24} />
                        DMS Audit
                    </h1>

                    {activeFilterCount > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-px bg-border mx-2" />
                            <span className="text-xs font-medium text-muted-foreground">{activeFilterCount} active filters</span>
                            <button
                                onClick={() => router.push(pathname)}
                                className="text-xs text-primary hover:underline"
                            >
                                Clear All
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Export Dropdown */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-2" disabled={exporting}>
                                {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                                <span className="hidden sm:inline">Export</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="end">
                            <div className="grid gap-1">
                                <Button variant="ghost" size="sm" className="justify-start gap-2 h-9" onClick={() => handleExport('excel')}>
                                    <FileSpreadsheet size={16} className="text-green-600" />
                                    Excel (.xlsx)
                                </Button>
                                <Button variant="ghost" size="sm" className="justify-start gap-2 h-9" onClick={() => handleExport('pdf')}>
                                    <FileText size={16} className="text-red-600" />
                                    PDF (.pdf)
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="h-6 w-px bg-border mx-1" />

                    <button
                        onClick={() => fetchLogs()}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => setIsAdvancedFilterOpen(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${activeFilterCount > 0 ? "bg-primary/10 border-primary/20 text-primary" : "hover:bg-muted"}`}
                    >
                        <Filter size={16} />
                        Filters
                    </button>
                </div>
            </div>

            <AdvancedAuditFilterDrawer
                isOpen={isAdvancedFilterOpen}
                onClose={() => setIsAdvancedFilterOpen(false)}
                users={users}
            />

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm flex items-center gap-2">
                    <ShieldAlert size={16} />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loading && logs.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                        <Loader2 className="animate-spin mr-2" /> Loading audit logs...
                    </div>
                ) : !loading && logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                        <Filter size={32} className="mb-2 opacity-20" />
                        <p>No log entries found matching your criteria.</p>
                    </div>
                ) : (
                    <div className="rounded-lg bg-card shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-2 border-background">
                                    <tr className="bg-muted/50">
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                                            <DataTableHeader
                                                title="Timestamp"
                                                columnId="createdAt"
                                                sortable={true}
                                                currentSortConfig={currentSort}
                                                onSort={handleSort}
                                            />
                                        </th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                                            <DataTableHeader
                                                title="Action"
                                                columnId="action"
                                                sortable={true}
                                                currentSortConfig={currentSort}
                                                onSort={handleSort}
                                                filterable={true}
                                                filterType="select"
                                                filterOptions={ACTION_OPTIONS}
                                                currentFilterValue={searchParams.get("action")}
                                                onFilter={(val) => handleFilter("action", val)}
                                            />
                                        </th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                                            <DataTableHeader
                                                title="Entity"
                                                columnId="entityType"
                                                sortable={true}
                                                currentSortConfig={currentSort}
                                                onSort={handleSort}
                                                filterable={true}
                                                filterType="select"
                                                filterOptions={ENTITY_TYPES}
                                                currentFilterValue={searchParams.get("entityType")}
                                                onFilter={(val) => handleFilter("entityType", val)}
                                            />
                                        </th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                                            <DataTableHeader
                                                title="User"
                                                columnId="actorUserId"
                                                sortable={true}
                                                currentSortConfig={currentSort}
                                                onSort={handleSort}
                                                filterable={true}
                                                filterType="select"
                                                filterOptions={users.map(u => ({ label: u.fullName, value: String(u.id) }))}
                                                currentFilterValue={searchParams.get("userId")}
                                                onFilter={(val) => handleFilter("userId", val)}
                                            />
                                        </th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">Details</th>
                                        <th className="h-12 px-4 text-left font-medium text-muted-foreground">Metadata</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-2 border-background hover:bg-muted/50 cursor-pointer transition-colors">
                                            <td className="p-4 whitespace-nowrap text-muted-foreground text-xs font-mono">
                                                {formatDate(log.createdAt)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getActionBadgeColor(log.action)}`}>
                                                    {log.action.replace("DMS.", "")}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col text-xs">
                                                    <span className="font-semibold text-foreground">{log.entityName}</span>
                                                    <span className="text-muted-foreground bg-muted/50 px-1 rounded w-fit mt-0.5">
                                                        {log.entityType}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                                        {log.actorName.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{log.actorName}</span>
                                                        <span className="text-[10px] text-muted-foreground">{log.actorEmail}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-foreground">{log.details || "-"}</span>
                                            </td>
                                            <td className="p-4 align-top min-w-[200px]">
                                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                    <div className="space-y-1">
                                                        {Object.entries(log.metadata).slice(0, 3).map(([key, value]) => (
                                                            <div key={key} className="text-[10px] grid grid-cols-[80px_1fr] gap-1">
                                                                <span className="font-medium text-muted-foreground truncate" title={key}>
                                                                    {key}:
                                                                </span>
                                                                <span className="text-foreground truncate" title={String(value)}>
                                                                    {String(value)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {Object.keys(log.metadata).length > 3 && (
                                                            <span className="text-[10px] text-muted-foreground italic">
                                                                +{Object.keys(log.metadata).length - 3} more
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                            <span className="text-sm text-muted-foreground">
                                Showing {logs.length} entries (Page {page} of {totalPages})
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateUrl({ page: String(Math.max(1, page - 1)) })}
                                    disabled={page === 1 || loading}
                                    className="p-1.5 rounded hover:bg-muted disabled:opacity-50 transition-colors border"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => updateUrl({ page: String(Math.min(totalPages, page + 1)) })}
                                    disabled={page === totalPages || loading}
                                    className="p-1.5 rounded hover:bg-muted disabled:opacity-50 transition-colors border"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
