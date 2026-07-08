"use client"

import React from "react"
import { DocumentData, getFileIcon, PdfIcon } from "@/components/dms/columns"
import { StatusBadge } from "@/components/dms/StatusBadge"
import { formatRelativeDate } from "@/lib/utils/format-date"
import {
    MoreVertical,
    History,
    File,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface DocumentGridProps {
    data: DocumentData[]
    onRowClick?: (row: DocumentData) => void
    meta?: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
    onPageChange?: (page: number) => void
    onPageSizeChange?: (size: number) => void
}

export function DocumentGrid({
    data,
    onRowClick,
    meta,
    onPageChange,
    onPageSizeChange,
}: DocumentGridProps) {

    const getPageNumbers = () => {
        if (!meta) return []
        const { page, totalPages } = meta
        const pages: (number | "...")[] = []

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            pages.push(1)
            if (page > 3) pages.push("...")
            const start = Math.max(2, page - 1)
            const end = Math.min(totalPages - 1, page + 1)
            for (let i = start; i <= end; i++) pages.push(i)
            if (page < totalPages - 2) pages.push("...")
            pages.push(totalPages)
        }

        return pages
    }

    const getStatusColors = (status: string) => {
        const normalized = status.toUpperCase()
        switch (normalized) {
            case "APPROVED": return "border-t-green-500"
            case "SUBMITTED": return "border-t-blue-500"
            case "REJECTED": return "border-t-red-500"
            case "EXPIRED": return "border-t-red-600"
            case "OBSOLETE": return "border-t-orange-500"
            case "DRAFT": return "border-t-gray-400"
            default: return "border-t-gray-300"
        }
    }

    return (
        <div className="flex flex-col min-h-full flex-1">
            <div className="flex-1 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-4">
                    {data.map((doc) => {
                        const { icon: Icon, color, isPdf } = getFileIcon(doc.currentVersion?.fileName)
                        const statusColors = getStatusColors(doc.effectiveStatus)
                        
                        return (
                            <div
                                key={doc.id}
                                onClick={() => onRowClick?.(doc)}
                                className={`relative flex flex-col p-4 rounded-xl shadow-sm cursor-pointer border border-border/80 border-t-[3px] transition-all group bg-card hover:shadow-md ${statusColors}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-2.5 bg-background rounded-lg border shadow-sm ring-1 ring-border/50">
                                        {isPdf ? (
                                            <PdfIcon size={24} className={color} />
                                        ) : Icon ? (
                                            <Icon size={24} className={color} />
                                        ) : (
                                            <File size={24} className="text-muted-foreground" />
                                        )}
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(doc.id)}>
                                                    Copy ID
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => onRowClick?.(doc)}>
                                                    View Details
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <h3 className="font-semibold text-foreground line-clamp-2 leading-tight mb-1.5" title={doc.title}>
                                        {doc.title}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-mono mb-2">
                                        {doc.documentNumber || 'No Doc #'}
                                    </p>
                                    {doc.description ? (
                                        <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3">
                                            {doc.description}
                                        </p>
                                    ) : (
                                        <div className="h-8 mb-3" />
                                    )}
                                </div>
                                
                                <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-border/50">
                                    <div className="flex justify-between items-center">
                                        <StatusBadge status={doc.effectiveStatus} />
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-background/50 px-2 py-1 rounded-md border">
                                            <History size={12} />
                                            v{doc.currentVersion?.versionNumber || 0}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap justify-between items-center gap-1 text-[11px] text-muted-foreground">
                                        <span title={new Date(doc.updatedAt).toLocaleString()}>
                                            Updated {formatRelativeDate(doc.updatedAt)}
                                        </span>
                                        {doc.expiryDate && (
                                            <span 
                                                className={new Date(doc.expiryDate).getTime() < Date.now() ? "text-destructive font-medium" : ""}
                                                title={new Date(doc.expiryDate).toLocaleString()}    
                                            >
                                                Expires {formatRelativeDate(doc.expiryDate)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {meta && meta.totalPages > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 mt-auto">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground whitespace-nowrap">
                            {meta.total} document{meta.total !== 1 ? "s" : ""}
                        </p>
                        {onPageSizeChange && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Rows:</span>
                                <Select
                                    value={String(meta.limit)}
                                    onValueChange={(val) => onPageSizeChange(Number(val))}
                                >
                                    <SelectTrigger className="h-7 w-[62px] text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    {meta.totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onPageChange?.(1)}
                                disabled={!onPageChange || meta.page <= 1}
                            >
                                <ChevronsLeft size={14} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onPageChange?.(meta.page - 1)}
                                disabled={!onPageChange || meta.page <= 1}
                            >
                                <ChevronLeft size={14} />
                            </Button>
                            <div className="hidden sm:flex items-center gap-1">
                                {getPageNumbers().map((p, i) =>
                                    p === "..." ? (
                                        <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">...</span>
                                    ) : (
                                        <Button
                                            key={p}
                                            variant={meta.page === p ? "default" : "outline"}
                                            size="icon"
                                            className="h-7 w-7 text-xs"
                                            onClick={() => onPageChange?.(p as number)}
                                            disabled={!onPageChange}
                                        >
                                            {p}
                                        </Button>
                                    )
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onPageChange?.(meta.page + 1)}
                                disabled={!onPageChange || meta.page >= meta.totalPages}
                            >
                                <ChevronRight size={14} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onPageChange?.(meta.totalPages)}
                                disabled={!onPageChange || meta.page >= meta.totalPages}
                            >
                                <ChevronsRight size={14} />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
