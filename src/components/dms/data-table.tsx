"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    onRowClick?: (row: TData) => void
    meta?: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
    onPageChange?: (page: number) => void
    onPageSizeChange?: (size: number) => void
    columnVisibility?: VisibilityState
    onColumnVisibilityChange?: (vis: VisibilityState) => void
}

export function DataTable<TData, TValue>({
    columns,
    data,
    onRowClick,
    meta,
    onPageChange,
    onPageSizeChange,
    columnVisibility: externalColumnVisibility,
    onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    const columnVisibility = externalColumnVisibility ?? internalColumnVisibility
    const handleColumnVisibilityChange = React.useCallback((updater: any) => {
        const newValue = typeof updater === 'function' ? updater(columnVisibility) : updater
        if (onColumnVisibilityChange) {
            onColumnVisibilityChange(newValue)
        } else {
            setInternalColumnVisibility(newValue)
        }
    }, [columnVisibility, onColumnVisibilityChange])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: handleColumnVisibilityChange,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

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

    return (
        <div className="flex flex-col min-h-full flex-1">
            <div className="rounded-md border bg-card shadow-sm overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b text-xs uppercase tracking-wider">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th key={header.id} className="px-4 py-3">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y">
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        onClick={() => onRowClick?.(row.original)}
                                        className="cursor-pointer bg-background hover:bg-muted/30 transition-colors data-[state=selected]:bg-muted"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-4 py-3 align-middle">
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        No results.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {meta && meta.totalPages > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground whitespace-nowrap">
                            {meta.total} document{meta.total !== 1 ? "s" : ""}
                        </p>
                        {onPageSizeChange && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Rows:</span>
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
        </div>
    )
}
