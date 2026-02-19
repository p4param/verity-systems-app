"use client"

import { useRouter } from "next/navigation"

import React, { useState, useEffect, useCallback } from "react"
import {
    History,
    Download,
    Upload,
    FileText,
    Loader2,
    AlertCircle
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { usePermission } from "@/lib/auth/use-permission"
import { UploadVersionModal } from "@/components/dms/UploadVersionModal"
import { canUploadNewVersion } from "@/lib/dms/ui-logic"

interface Version {
    id: string
    versionNumber: number
    fileName: string
    mimeType: string
    fileSize: number
    createdAt: string
    createdBy: {
        fullName: string
    }
    document: {
        id: string
        documentNumber: string
        status: string
    }
}

interface VersionHistoryProps {
    documentId: string
    documentStatus: string
    onVersionUploaded?: () => void
}

export function DmsVersionHistory({ documentId, documentStatus, onVersionUploaded }: VersionHistoryProps) {
    const { fetchWithAuth, user } = useAuth()
    const router = useRouter()
    const [versions, setVersions] = useState<Version[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [downloadingId, setDownloadingId] = useState<string | null>(null)

    // Permissions
    const canUpload = usePermission("DMS_DOCUMENT_UPLOAD")

    const loadVersions = useCallback(async () => {
        try {
            setLoading(true)
            const data = await fetchWithAuth<Version[]>(`/api/secure/dms/documents/${documentId}/versions`)
            setVersions(data)
        } catch (err: any) {
            setError(err.message || "Failed to load version history")
        } finally {
            setLoading(false)
        }
    }, [documentId, fetchWithAuth])

    useEffect(() => {
        loadVersions()
    }, [loadVersions])

    const handleDownload = async (version: Version) => {
        try {
            setDownloadingId(version.id)
            // 1. Get signed URL
            const { downloadUrl } = await fetchWithAuth<{ downloadUrl: string }>(
                `/api/secure/dms/documents/${documentId}/versions?versionId=${version.id}&action=download`
            )

            // 2. Trigger download
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = version.fileName // Hint to browser
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err: any) {
            alert(err.message || "Download failed")
        } finally {
            setDownloadingId(null)
        }
    }

    const handleUploadSuccess = () => {
        loadVersions()
        router.refresh()
        if (onVersionUploaded) {
            onVersionUploaded()
        }
    }

    if (loading && versions.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 size={24} className="animate-spin" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <History size={16} />
                    Version History
                </h3>
                {canUploadNewVersion(documentStatus, user.permissions || []) && (
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="text-xs flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                        <Upload size={12} />
                        Upload New Version
                    </button>
                )}
            </div>

            <div className="border rounded-md bg-background overflow-hidden">
                {versions.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground italic">
                        No versions uploaded yet.
                    </div>
                ) : (
                    versions.map((version, index) => {
                        // Check if we need a revision header
                        // Show header if:
                        // 1. First item
                        // 2. Document ID changed from previous item
                        const showHeader = index === 0 || version.document?.id !== versions[index - 1].document?.id;
                        const isCurrentDoc = version.document?.id === documentId;

                        return (
                            <React.Fragment key={version.id}>
                                {showHeader && (
                                    <div className="bg-muted/40 p-2 px-3 text-xs font-semibold text-muted-foreground border-b flex items-center justify-between">
                                        <span>
                                            REVISION {version.document?.documentNumber || "UNKNOWN"}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border ${isCurrentDoc
                                            ? "bg-primary/10 text-primary border-primary/20"
                                            : "bg-muted text-muted-foreground border-muted-foreground/20"
                                            }`}>
                                            {isCurrentDoc ? "Current" : version.document?.status || "Archived"}
                                        </span>
                                    </div>
                                )}
                                <div className="p-3 flex items-center justify-between group hover:bg-muted/30 transition-colors border-b last:border-b-0">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-muted rounded">
                                            <FileText size={16} className="text-muted-foreground" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-semibold">v{version.versionNumber}</span>
                                                <span className="text-sm truncate max-w-[200px]">{version.fileName}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                                <span>{((version.fileSize || 0) / 1024).toFixed(1)} KB</span>
                                                <span>•</span>
                                                <span>{new Date(version.createdAt).toLocaleString()}</span>
                                                <span>•</span>
                                                <span>by {version.createdBy.fullName}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDownload(version)}
                                        disabled={downloadingId === version.id}
                                        className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-all"
                                        title="Download"
                                    >
                                        {downloadingId === version.id ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Download size={16} />
                                        )}
                                    </button>
                                </div>
                            </React.Fragment>
                        )
                    })
                )}
            </div>

            <UploadVersionModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                documentId={documentId}
                onSuccess={handleUploadSuccess}
            />
        </div>
    )
}
