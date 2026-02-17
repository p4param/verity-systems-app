"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    PanelLeft,
    X,
    FolderOpen,
    Search,
    Filter,
    Plus,
    Columns,
    ChevronDown,
} from "lucide-react"
import { FolderTree } from "@/components/dms/FolderTree"
import { DmsDocumentList } from "@/components/dms/DocumentList"
import { CreateDocumentModal } from "@/components/dms/CreateDocumentModal"
import { usePermission } from "@/lib/auth/use-permission"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { VisibilityState } from "@tanstack/react-table"

const COLUMN_LABELS: Record<string, string> = {
    select: "Select",
    documentNumber: "Doc #",
    title: "Title",
    type: "Type",
    status: "Status",
    version: "Version",
    expiryDate: "Expiry",
    updatedAt: "Updated",
}

const TOGGLEABLE_COLUMNS = ["documentNumber", "title", "type", "status", "version", "expiryDate", "updatedAt"]

export default function DmsDashboard() {
    const router = useRouter()

    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchInput, setSearchInput] = useState("")
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [itemCount, setItemCount] = useState(0)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [activeFilterCount, setActiveFilterCount] = useState(0)
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("dms-column-visibility")
                if (saved) return JSON.parse(saved)
            } catch {}
        }
        return {}
    })

    useEffect(() => {
        try {
            localStorage.setItem("dms-column-visibility", JSON.stringify(columnVisibility))
        } catch {}
    }, [columnVisibility])

    const canCreateDocument = usePermission("DMS_DOCUMENT_CREATE")

    const handleDocumentSelect = useCallback((docId: string) => {
        router.push(`/dms/documents/${docId}`)
    }, [router])

    const handleCreateSuccess = useCallback((docId: string) => {
        router.push(`/dms/documents/${docId}`)
    }, [router])

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput)
        }, 400)
        return () => clearTimeout(timer)
    }, [searchInput])

    const handleClearSearch = () => {
        setSearchInput("")
        setSearchQuery("")
    }

    const isColumnVisible = (colId: string) => {
        return columnVisibility[colId] !== false
    }

    const toggleColumn = (colId: string, visible: boolean) => {
        setColumnVisibility(prev => ({ ...prev, [colId]: visible }))
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] -m-4 sm:-m-6">
            <div className="border-b bg-background">
                <div className="flex items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="lg:hidden p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                        >
                            {isSidebarOpen ? <X size={18} /> : <PanelLeft size={18} />}
                        </button>
                        <div className="flex items-center gap-2 min-w-0">
                            <FolderOpen className="text-primary shrink-0 hidden sm:block" size={22} />
                            <h1 className="text-lg font-semibold text-foreground leading-tight truncate">
                                Document Management
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search documents..."
                                className="w-48 md:w-64 lg:w-80 pl-8 pr-8 py-1.5 text-sm bg-muted/50 border border-transparent rounded-md outline-none transition-all placeholder:text-muted-foreground/60 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-muted-foreground/20"
                            />
                            {searchInput && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <TooltipProvider delayDuration={300}>
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 px-2.5">
                                                <Columns size={15} />
                                                <ChevronDown className="ml-1 h-3 w-3 hidden sm:block" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Toggle Columns</p></TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align="end">
                                    {TOGGLEABLE_COLUMNS.map((colId) => (
                                        <DropdownMenuCheckboxItem
                                            key={colId}
                                            checked={isColumnVisible(colId)}
                                            onCheckedChange={(checked) => toggleColumn(colId, !!checked)}
                                        >
                                            {COLUMN_LABELS[colId] || colId}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsFilterOpen(true)}
                                        className={`h-8 px-2.5 ${activeFilterCount > 0 ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15" : ""}`}
                                    >
                                        <Filter size={15} />
                                        {activeFilterCount > 0 && (
                                            <span className="ml-1 text-xs font-medium">{activeFilterCount}</span>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Advanced Filters</p></TooltipContent>
                            </Tooltip>

                            {canCreateDocument && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="sm"
                                            onClick={() => setIsCreateModalOpen(true)}
                                            className="h-8 px-2.5 shadow-sm"
                                        >
                                            <Plus size={15} />
                                            <span className="hidden md:inline ml-1">New</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>New Document</p></TooltipContent>
                                </Tooltip>
                            )}
                        </TooltipProvider>
                    </div>
                </div>

                <div className="sm:hidden px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search documents..."
                            className="w-full pl-8 pr-8 py-1.5 text-sm bg-muted/50 border border-transparent rounded-md outline-none transition-all placeholder:text-muted-foreground/60 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                        />
                        {searchInput && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted-foreground/10 text-muted-foreground"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                <div className={`
                    absolute lg:relative inset-y-0 left-0 z-30 transition-transform duration-300 transform bg-background
                    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                    lg:translate-x-0 ${isSidebarOpen ? "lg:w-64" : "lg:w-0"}
                    overflow-hidden
                `}>
                    <FolderTree
                        selectedFolderId={selectedFolderId}
                        onFolderSelect={(id) => {
                            setSelectedFolderId(id)
                            if (window.innerWidth < 1024) setIsSidebarOpen(false)
                        }}
                    />
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col bg-muted/20">
                    <DmsDocumentList
                        folderId={selectedFolderId}
                        search={searchQuery}
                        onDocumentSelect={handleDocumentSelect}
                        onLoadComplete={setItemCount}
                        isFilterOpen={isFilterOpen}
                        onFilterOpenChange={setIsFilterOpen}
                        onActiveFilterCountChange={setActiveFilterCount}
                        columnVisibility={columnVisibility}
                        onColumnVisibilityChange={setColumnVisibility}
                    />
                </div>

                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </div>

            <CreateDocumentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                folderId={selectedFolderId}
                onSuccess={handleCreateSuccess}
            />
        </div>
    )
}
