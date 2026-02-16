"use client"

import React, { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Filter, X } from "lucide-react"

interface UserOption {
    id: number
    fullName: string
    email: string
}

interface AdvancedAuditFilterDrawerProps {
    isOpen: boolean
    onClose: () => void
    users: UserOption[]
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

const ENTITY_TYPES = ["DOCUMENT", "FOLDER", "VERSION", "WORKFLOW"]

export function AdvancedAuditFilterDrawer({ isOpen, onClose, users }: AdvancedAuditFilterDrawerProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [localFilters, setLocalFilters] = useState<any>({})

    // Initialize state from URL when drawer opens
    useEffect(() => {
        if (isOpen) {
            setLocalFilters({
                startDate: searchParams.get("startDate") || "",
                endDate: searchParams.get("endDate") || "",
                action: searchParams.get("action") || "",
                userId: searchParams.get("userId") || "",
                entityType: searchParams.get("entityType") || ""
            })
        }
    }, [isOpen, searchParams])

    const handleApply = () => {
        const params = new URLSearchParams(searchParams.toString())

        const update = (key: string, value: string) => {
            if (!value) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        }

        update("startDate", localFilters.startDate)
        update("endDate", localFilters.endDate)
        update("action", localFilters.action)
        update("userId", localFilters.userId)
        update("entityType", localFilters.entityType)

        params.set("page", "1") // Reset page
        router.push(pathname + "?" + params.toString())
        onClose()
    }

    const handleReset = () => {
        setLocalFilters({})
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-sm bg-background h-full shadow-xl flex flex-col border-l animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b flex justify-between items-center bg-card">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Filter size={18} />
                            Audit Filters
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Filter audit trail events</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-8 bg-card/50">

                    {/* Date Range */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Date Range</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                                <input
                                    type="date"
                                    className="w-full text-sm border rounded h-9 px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={localFilters.startDate || ""}
                                    onChange={(e) => setLocalFilters({ ...localFilters, startDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
                                <input
                                    type="date"
                                    className="w-full text-sm border rounded h-9 px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={localFilters.endDate || ""}
                                    onChange={(e) => setLocalFilters({ ...localFilters, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Event Details</h3>

                        <div className="space-y-3">
                            <label className="text-sm font-medium block">Action</label>
                            <select
                                className="w-full text-sm border rounded-md h-9 px-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                value={localFilters.action || ""}
                                onChange={(e) => setLocalFilters({ ...localFilters, action: e.target.value })}
                            >
                                <option value="">All Actions</option>
                                {ACTION_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium block">Entity Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {ENTITY_TYPES.map(type => (
                                    <label key={type} className="flex items-center gap-2 text-sm cursor-pointer bg-background p-2 rounded-md border hover:border-primary/50 transition-colors">
                                        <input
                                            type="radio"
                                            name="entityType"
                                            className="text-primary focus:ring-primary h-4 w-4"
                                            checked={localFilters.entityType === type}
                                            onChange={() => setLocalFilters({ ...localFilters, entityType: type })}
                                        />
                                        <span className="capitalize">{type.toLowerCase()}</span>
                                    </label>
                                ))}
                                <label className="flex items-center gap-2 text-sm cursor-pointer bg-background p-2 rounded-md border hover:border-primary/50 transition-colors">
                                    <input
                                        type="radio"
                                        name="entityType"
                                        className="text-primary focus:ring-primary h-4 w-4"
                                        checked={localFilters.entityType === ""}
                                        onChange={() => setLocalFilters({ ...localFilters, entityType: "" })}
                                    />
                                    <span className="capitalize">All</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* User */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">User</h3>
                        <div className="space-y-3">
                            <label className="text-sm font-medium block">Peformed By</label>
                            <select
                                className="w-full text-sm border rounded-md h-9 px-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                value={localFilters.userId || ""}
                                onChange={(e) => setLocalFilters({ ...localFilters, userId: e.target.value })}
                            >
                                <option value="">All Users</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.fullName}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-card flex gap-3">
                    <button
                        onClick={handleReset}
                        className="flex-1 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    )
}
