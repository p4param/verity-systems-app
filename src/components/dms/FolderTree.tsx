"use client"

import React, { useEffect, useState, useCallback } from "react"
import {
    Folder,
    FolderPlus,
    ChevronRight,
    ChevronDown,
    Plus,
    Loader2,
    Shield
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { usePermission } from "@/lib/auth/use-permission"
import { Modal } from "@/components/ui/Modal"
import { ApplyLegalHoldModal } from "./ApplyLegalHoldModal"

interface FolderData {
    id: string
    name: string
    parentId: string | null
    createdById: number
    createdAt: string
    isUnderLegalHold?: boolean
}

interface FolderTreeProps {
    onFolderSelect: (folderId: string | null, folderName?: string | null) => void
    selectedFolderId: string | null
}

export function FolderTree({ onFolderSelect, selectedFolderId }: FolderTreeProps) {
    const { fetchWithAuth, user } = useAuth()
    const [folders, setFolders] = useState<FolderData[]>([])
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["root"]))
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")
    const [creating, setCreating] = useState(false)
    const [targetParentId, setTargetParentId] = useState<string | null>(null)

    // Permission check
    const canCreateFolder = usePermission("DMS_FOLDER_CREATE")
    const canAttachHold = usePermission("LEGAL_HOLD_ATTACH")
    const [refreshKey, setRefreshKey] = useState(0) // Used to force tree updates

    // Legal Hold state
    const [holdModalFolder, setHoldModalFolder] = useState<{ id: string, name: string } | null>(null)

    const loadFolders = useCallback(async () => {
        try {
            setLoading(true)
            // Fetch flat list of folders for the tenant
            // The API /api/secure/dms/folders returns folders for a given parentId.
            // But we might want a full tree or fetch on demand.
            // Rule says: GET /api/secure/dms/folders?parentId=

            // For V1, we'll fetch root folders initially
            const rootFolders = await fetchWithAuth<FolderData[]>("/api/secure/dms/folders")
            setFolders(rootFolders)
        } catch (err: any) {
            setError(err.message || "Failed to load folders")
        } finally {
            setLoading(false)
        }
    }, [fetchWithAuth])

    useEffect(() => {
        loadFolders()
    }, [loadFolders])

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const next = new Set(expandedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setExpandedIds(next)
    }

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newFolderName.trim()) return

        try {
            setCreating(true)
            const newFolder = await fetchWithAuth<FolderData>("/api/secure/dms/folders", {
                method: "POST",
                body: JSON.stringify({
                    name: newFolderName,
                    parentId: targetParentId
                })
            })

            // Optimistic update: Add to list ONLY if it's a root folder
            if (!newFolder.parentId) {
                setFolders(prev => [...prev, newFolder])
            } else {
                // If it's a subfolder, we rely on the FolderItem to re-fetch.
                // Since FolderItem is defined inside the component (which forces remount on parent state change)
                // or via other triggers, we might technically need to trigger a refresh.
                // For now, let's just NOT add it to root.

                // To force a refresh of the UI without full reload:
                // We can toggle the expanded state of the parent if it's open, 
                // or simpler: just let the user re-expand.
                // BUT, since we have the "re-mount on render" performance "bug/feature",
                // triggering a state change in parent (like this setFolders or a dummy state)
                // might actually help refresh the tree.
                // Let's force a re-render of the tree by updating a version counter.
                setRefreshKey(prev => prev + 1)
            }

            // Reset and close
            setNewFolderName("")
            setIsCreateModalOpen(false)
            setTargetParentId(null)
        } catch (err: any) {
            alert(err.message || "Failed to create folder")
        } finally {
            setCreating(false)
        }
    }

    const openCreateModal = (e: React.MouseEvent, parentId: string | null = null) => {
        e.stopPropagation()
        setTargetParentId(parentId)
        setIsCreateModalOpen(true)
    }

    // Recursive component for folder items
    const FolderItem = ({ folder, level = 0 }: { folder: FolderData, level?: number }) => {
        const isSelected = selectedFolderId === folder.id
        const isExpanded = expandedIds.has(folder.id)
        const [subfolders, setSubfolders] = useState<FolderData[]>([])
        const [fetching, setFetching] = useState(false)
        const [loaded, setLoaded] = useState(false)

        const fetchSubfolders = useCallback(async () => {
            if (loaded || fetching) return
            try {
                setFetching(true)
                const data = await fetchWithAuth<FolderData[]>(`/api/secure/dms/folders?parentId=${folder.id}`)
                setSubfolders(data)
                setLoaded(true)
            } catch (err) {
                console.error("Failed to load subfolders", err)
            } finally {
                setFetching(false)
            }
        }, [folder.id, loaded, fetching])

        useEffect(() => {
            if (isExpanded && !loaded) {
                fetchSubfolders()
            }
        }, [isExpanded, loaded, fetchSubfolders])

        return (
            <div className="flex flex-col">
                <div
                    onClick={() => onFolderSelect(folder.id, folder.name)}
                    className={`
                        group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors
                        ${isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}
                    `}
                    style={{ paddingLeft: `${(level * 16) + 8}px` }}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span
                            onClick={(e) => toggleExpand(folder.id, e)}
                            className="p-0.5 hover:bg-muted-foreground/10 rounded-sm transition-colors text-muted-foreground"
                        >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <Folder className={isSelected ? "text-primary fill-primary/20" : folder.isUnderLegalHold ? "text-amber-500" : "text-muted-foreground"} size={16} />
                        <span className={`truncate text-sm ${folder.isUnderLegalHold ? "text-amber-700 font-medium" : ""}`}>
                            {folder.name}
                        </span>
                        {folder.isUnderLegalHold && (
                            <span title="Legal Hold Active" className="shrink-0 ml-auto mr-1">
                                <Shield size={12} className="text-amber-500 fill-amber-500/20" />
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        {canAttachHold && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setHoldModalFolder({ id: folder.id, name: folder.name });
                                }}
                                className="p-1 hover:bg-amber-500/20 rounded-sm text-muted-foreground hover:text-amber-600"
                                title="Apply Legal Hold"
                            >
                                <Shield size={14} />
                            </button>
                        )}
                        {canCreateFolder && (
                            <button
                                onClick={(e) => openCreateModal(e, folder.id)}
                                className="p-1 hover:bg-muted-foreground/20 rounded-sm text-muted-foreground hover:text-foreground"
                                title="New Subfolder"
                            >
                                <Plus size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="flex flex-col">
                        {fetching && (
                            <div
                                className="flex items-center gap-2 py-1 text-xs text-muted-foreground italic animate-pulse"
                                style={{ paddingLeft: `${((level + 1) * 16) + 24}px` }}
                            >
                                <Loader2 size={12} className="animate-spin" />
                                Loading...
                            </div>
                        )}
                        {subfolders.map(sub => (
                            <FolderItem key={sub.id} folder={sub} level={level + 1} />
                        ))}
                        {loaded && subfolders.length === 0 && (
                            <div
                                className="py-1 text-[11px] text-muted-foreground/60 italic"
                                style={{ paddingLeft: `${((level + 1) * 16) + 24}px` }}
                            >
                                Empty
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full rounded-lg bg-card shadow-sm w-64 min-w-[240px] overflow-hidden">
            {/* Tree Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2 font-semibold text-sm">
                    <Folder className="text-primary" size={18} />
                    <span>Folders</span>
                </div>
                {canCreateFolder && (
                    <button
                        onClick={(e) => openCreateModal(e, null)}
                        className="p-1.5 rounded-md hover:bg-muted border border-border shadow-sm transition-all text-muted-foreground hover:text-foreground"
                        title="New Root Folder"
                    >
                        <FolderPlus size={16} />
                    </button>
                )}
            </div>

            {/* Tree Content */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {/* Root Link (All Files) */}
                <div
                    onClick={() => onFolderSelect(null)}
                    className={`
                        flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm
                        ${selectedFolderId === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}
                    `}
                >
                    <ChevronDown size={14} className="opacity-0" />
                    <Folder size={16} />
                    <span>All Documents</span>
                </div>

                <div className="h-px bg-border my-2 mx-2" />

                {loading && folders.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
                        <Loader2 className="animate-spin text-muted-foreground" size={20} />
                        <span className="text-xs text-muted-foreground">Syncing folders...</span>
                    </div>
                )}

                {!loading && folders.length === 0 && (
                    <div className="p-4 text-center">
                        <p className="text-xs text-muted-foreground italic">No folders found.</p>
                    </div>
                )}

                {folders.map(folder => (
                    <FolderItem key={`${folder.id}-${refreshKey}`} folder={folder} />
                ))}
            </div>

            {/* Error State */}
            {error && (
                <div className="p-2 m-2 text-[11px] bg-destructive/10 text-destructive border border-destructive/20 rounded">
                    {error}
                </div>
            )}

            {/* Create Folder Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title={`New ${targetParentId ? "Subfolder" : "Folder"}`}
                footer={
                    <>
                        <button
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-md"
                            disabled={creating}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateFolder}
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2"
                            disabled={creating || !newFolderName.trim()}
                        >
                            {creating && <Loader2 size={14} className="animate-spin" />}
                            Create
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Folder Name</label>
                        <input
                            autoFocus
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Enter folder name..."
                            className="w-full px-3 py-2 bg-background border rounded-md text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder(e as any)}
                        />
                    </div>
                </div>
            </Modal>

            {/* Legal Hold Modal */}
            <ApplyLegalHoldModal
                isOpen={!!holdModalFolder}
                onClose={() => setHoldModalFolder(null)}
                targetType="FOLDER"
                targetId={holdModalFolder?.id || ""}
                targetName={holdModalFolder?.name || ""}
                onSuccess={() => {
                    setRefreshKey(prev => prev + 1)
                    loadFolders()
                }}
            />
        </div>
    )
}
