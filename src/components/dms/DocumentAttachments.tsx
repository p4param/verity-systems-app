"use client"

import React, { useState, useRef } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import {
    Paperclip,
    X,
    Download,
    Plus,
    Loader2,
    FileIcon,
    AlertCircle
} from "lucide-react"

interface Attachment {
    id: string
    fileName: string
    fileSize: number
    mimeType: string
}

interface DocumentAttachmentsProps {
    documentId: string
    version: {
        id: string
        isFrozen: boolean
        attachments: Attachment[]
    }
    documentStatus: string
    onRefresh: () => void
}

export function DocumentAttachments({ documentId, version, documentStatus, onRefresh }: DocumentAttachmentsProps) {
    const { fetchWithAuth } = useAuth()
    const [uploading, setUploading] = useState(false)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const isEditable = documentStatus === "DRAFT" && !version.isFrozen

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)

            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/versions/${version.id}/attachments`, {
                method: "POST",
                body: formData
            })
            onRefresh()
        } catch (err: any) {
            alert(err.message || "Upload failed")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleRemove = async (attachmentId: string) => {
        if (!confirm("Are you sure you want to remove this attachment?")) return

        setRemovingId(attachmentId)
        try {
            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/versions/${version.id}/attachments/${attachmentId}`, {
                method: "DELETE"
            })
            onRefresh()
        } catch (err: any) {
            alert(err.message || "Removal failed")
        } finally {
            setRemovingId(null)
        }
    }

    const handleDownload = async (attachment: Attachment) => {
        try {
            const { url } = await fetchWithAuth<{ url: string }>(
                `/api/secure/dms/documents/${documentId}/versions/${version.id}/attachments/${attachment.id}`
            )
            const link = document.createElement('a')
            link.href = url
            link.download = attachment.fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err: any) {
            alert(err.message || "Download failed")
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    <Paperclip size={14} />
                    Supporting Attachments
                </div>
                {isEditable && (
                    <>
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="text-xs flex items-center gap-1 text-primary hover:underline font-medium disabled:opacity-50"
                        >
                            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Add Attachment
                        </button>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2">
                {version.attachments.length === 0 ? (
                    <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground italic">
                        No attachments.
                    </div>
                ) : (
                    version.attachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between p-3 bg-card border rounded-lg hover:bg-muted/30 transition-colors group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-primary/5 rounded">
                                    <FileIcon size={16} className="text-primary/60" />
                                </div>
                                <div className="overflow-hidden">
                                    <div className="text-sm font-medium truncate max-w-[200px] lg:max-w-[400px]">
                                        {att.fileName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {(att.fileSize / 1024).toFixed(1)} KB
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleDownload(att)}
                                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                    title="Download"
                                >
                                    <Download size={14} />
                                </button>
                                {isEditable && (
                                    <button
                                        onClick={() => handleRemove(att.id)}
                                        disabled={removingId === att.id}
                                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        title="Remove"
                                    >
                                        {removingId === att.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {version.isFrozen && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground border">
                    <AlertCircle size={12} />
                    <span>This version is frozen. Attachments are read-only.</span>
                </div>
            )}
        </div>
    )
}
