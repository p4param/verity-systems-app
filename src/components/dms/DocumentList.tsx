"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { DataTable } from "@/components/dms/data-table"
import { columns, DocumentData } from "@/components/dms/columns"
import { AdvancedFilterDrawer } from "@/components/dms/AdvancedFilterDrawer"
import { TableSkeleton } from "@/components/dms/TableSkeleton"
import { EmptyState } from "@/components/dms/EmptyState"
import { VisibilityState } from "@tanstack/react-table"

interface DocumentListProps {
    folderId: string | null
    folderName?: string | null
    search?: string
    onDocumentSelect: (docId: string) => void
    onLoadComplete?: (count: number) => void
    isFilterOpen?: boolean
    onFilterOpenChange?: (open: boolean) => void
    onActiveFilterCountChange?: (count: number) => void
    columnVisibility?: VisibilityState
    onColumnVisibilityChange?: (vis: VisibilityState) => void
    canCreate?: boolean
    onCreateClick?: () => void
}

export function DmsDocumentList({
    folderId,
    folderName,
    search = "",
    onDocumentSelect,
    onLoadComplete,
    isFilterOpen = false,
    onFilterOpenChange,
    onActiveFilterCountChange,
    columnVisibility,
    onColumnVisibilityChange,
    canCreate,
    onCreateClick,
}: DocumentListProps) {
    const { fetchWithAuth } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [documents, setDocuments] = useState<DocumentData[]>([])
    const [loading, setLoading] = useState(true)
    const [initialLoad, setInitialLoad] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 })
    const [documentTypes, setDocumentTypes] = useState<{ label: string, value: string }[]>([])

    useEffect(() => {
        fetchWithAuth<{ id: string, name: string }[]>("/api/secure/dms/document-types?active=true")
            .then(types => setDocumentTypes(types.map(t => ({ label: t.name, value: t.id }))))
            .catch(console.error)
    }, [fetchWithAuth]);

    const searchParamsString = searchParams.toString()

    const updateUrl = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParamsString)
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        if (!updates.page) {
            params.set("page", "1")
        }

        const newQueryString = params.toString()
        if (newQueryString !== searchParamsString) {
            router.push(pathname + "?" + newQueryString)
        }
    }, [searchParamsString, pathname, router])

    const onLoadCompleteRef = useRef(onLoadComplete)
    useEffect(() => {
        onLoadCompleteRef.current = onLoadComplete
    }, [onLoadComplete])

    const loadDocuments = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const params = new URLSearchParams(searchParamsString)

            if (folderId) params.set("folderId", folderId)
            else params.delete("folderId")

            if (search) params.set("search", search)
            else params.delete("search")

            if (!params.has("page")) params.set("page", "1")

            if (params.has("type")) {
                const types = params.getAll("type");
                params.delete("type");
                types.forEach(t => params.append("documentTypeIds", t));
            }

            const queryString = params.toString()
            const response = await fetchWithAuth<{ data: DocumentData[], meta: any }>(`/api/secure/dms/documents?${queryString}`)

            setDocuments(response.data)

            if (onLoadCompleteRef.current) {
                onLoadCompleteRef.current(response.meta.total)
            }

            setMeta(response.meta)
        } catch (err: any) {
            setError(err.message || "Failed to load documents")
        } finally {
            setLoading(false)
            setInitialLoad(false)
        }
    }, [folderId, search, searchParamsString, fetchWithAuth])

    useEffect(() => {
        loadDocuments()
    }, [loadDocuments])

    const handlePageChange = useCallback((page: number) => {
        updateUrl({ page: String(page) })
    }, [updateUrl])

    const handlePageSizeChange = useCallback((size: number) => {
        updateUrl({ limit: String(size), page: "1" })
    }, [updateUrl])

    const activeFilterCount = Array.from(searchParams.entries()).filter(([key, val]) => {
        return ['status', 'type', 'expiryFilter', 'versionFrom', 'versionTo', 'includeSubfolders'].includes(key) && val
    }).length

    useEffect(() => {
        onActiveFilterCountChange?.(activeFilterCount)
    }, [activeFilterCount, onActiveFilterCountChange])

    const hasFiltersOrSearch = !!search || activeFilterCount > 0
    const isEmpty = !loading && documents.length === 0 && meta.total === 0

    return (
        <div className="flex flex-col min-h-full flex-1">
            <AdvancedFilterDrawer
                isOpen={isFilterOpen}
                onClose={() => onFilterOpenChange?.(false)}
                documentTypes={documentTypes.map(t => ({ id: t.value, name: t.label }))}
            />

            <div className="flex-1 flex flex-col">
                {initialLoad ? (
                    <TableSkeleton rows={8} columns={7} />
                ) : isEmpty ? (
                    <EmptyState
                        hasSearch={hasFiltersOrSearch}
                        hasFolder={!!folderId}
                        folderName={folderName}
                        canCreate={canCreate}
                        onCreateClick={onCreateClick}
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        data={documents}
                        meta={meta}
                        onRowClick={(doc) => onDocumentSelect(doc.id)}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        columnVisibility={columnVisibility}
                        onColumnVisibilityChange={onColumnVisibilityChange}
                    />
                )}
            </div>

            {error && (
                <div className="p-3 m-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}
        </div>
    )
}
