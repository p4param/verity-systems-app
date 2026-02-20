"use client"

import React, { useEffect, useState, useCallback, useRef, use } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    FileText,
    Calendar,
    Shield,
    Share2,
    Loader2,
    AlertTriangle,
    Edit3 // Added
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { usePermission } from "@/lib/auth/use-permission"
import { StatusBadge } from "@/components/dms/StatusBadge"
import { DocumentHeaderActions } from "@/components/dms/DocumentHeaderActions"
import { DocumentViewer } from "@/components/dms/DocumentViewer"
import { DmsVersionHistory } from "@/components/dms/VersionHistory"
import { ShareDocumentModal } from "@/components/dms/ShareDocumentModal"
import { EditDocumentModal } from "@/components/dms/EditDocumentModal" // Added
import { DocumentAuditPanel } from "@/components/dms/DocumentAuditPanel"
import { DocumentReviews } from "@/components/dms/DocumentReviews"
import { DocumentComments } from "@/components/dms/DocumentComments"
import { DocumentAcknowledgement } from "@/components/dms/DocumentAcknowledgement"
import { DocumentAttachments } from "@/components/dms/DocumentAttachments"

// Updated DocumentDetail interface to include supersededBy
interface DocumentDetail {
    id: string
    title: string
    documentNumber: string | null
    type: { id: string, name: string } | null
    expiryDate: string | null
    description?: string
    status: string
    effectiveStatus: string
    createdAt: string
    updatedAt: string
    folderId: string | null
    folder?: {
        id: string
        name: string
    }
    createdById: number
    createdBy: {
        fullName: string
        email: string
    }
    currentVersion?: {
        id: string
        versionNumber: number
        fileName: string
        mimeType: string
        isFrozen?: boolean
        attachments?: any[]
    }
    // Added for Revision UI
    supersededById: string | null
    supersededBy?: {
        id: string
        documentNumber: string | null
    }
    effectivePermissions?: string[]
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { fetchWithAuth } = useAuth()
    const fetchWithAuthRef = useRef(fetchWithAuth)
    useEffect(() => { fetchWithAuthRef.current = fetchWithAuth }, [fetchWithAuth])

    const [document, setDocument] = useState<DocumentDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<"about" | "versions" | "audit" | "reviews" | "comments">("about")

    const canShare = usePermission("DMS_SHARE_CREATE")
    const canEdit = usePermission("DMS_DOCUMENT_EDIT")

    const loadDocument = useCallback(async () => {
        try {
            setLoading(true)
            // The API endpoint must return supersededBy relation. 
            // We assume the backend route /api/secure/dms/documents/[id] already does or we need to check.
            // Let's check the backend route first.
            const data = await fetchWithAuthRef.current<DocumentDetail>(`/api/secure/dms/documents/${id}`)
            setDocument(data)
        } catch (err: any) {
            // ... error handling
            console.error("Failed to load document:", err)
            let errorMessage = "Failed to load document"
            if (err?.error?.message) {
                errorMessage = err.error.message
            } else if (err?.message) {
                errorMessage = err.message
            } else if (typeof err === "string") {
                errorMessage = err
            }
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => {
        loadDocument()
    }, [loadDocument])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading document details...</p>
            </div>
        )
    }

    if (error || !document) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <div className="p-4 bg-destructive/10 text-destructive rounded-full">
                    <AlertTriangle size={32} />
                </div>
                <h2 className="text-xl font-semibold">Unable to load document</h2>
                <p className="text-muted-foreground">{error || "Document not found or access denied."}</p>
                <button
                    onClick={() => router.push("/dms")}
                    className="btn-secondary mt-4"
                >
                    Return to Dashboard
                </button>
            </div>
        )
    }

    // Determine if editable
    const isEditable = (document.status === "DRAFT" || document.status === "REJECTED") && canEdit

    return (
        <div className="max-w-6xl mx-auto py-6 px-4 space-y-6 animate-in fade-in duration-500">
            {/* Header / Nav */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/dms")}
                        className="p-2 hover:bg-muted rounded-full transition-colors group"
                        title="Back to Documents"
                    >
                        <ArrowLeft size={20} className="text-muted-foreground group-hover:text-foreground" />
                    </button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight">{document.title}</h1>
                            {isEditable && (
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                                    title="Edit Document Metadata"
                                >
                                    <Edit3 size={18} />
                                </button>
                            )}
                            <StatusBadge status={document.effectiveStatus} />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            {document.documentNumber && (
                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                                    {document.documentNumber}
                                </span>
                            )}
                            <span className="text-muted-foreground/60">•</span>
                            {document.folder ? (
                                <span className="flex items-center gap-1">
                                    In: <span className="font-medium text-foreground">{document.folder.name}</span>
                                </span>
                            ) : (
                                <span>Unfiled</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    {/* Workflow Actions in Header */}
                    <DocumentHeaderActions
                        document={document}
                        onSuccess={loadDocument}
                    />

                    {canShare && document.effectiveStatus === "APPROVED" && (
                        <button
                            onClick={() => setIsShareModalOpen(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors"
                        >
                            <Share2 size={16} />
                            <span>Share</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN (2/3) - Content & Description */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Description Section */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            <FileText size={14} />
                            Description
                        </div>
                        <div className="p-4 bg-card border rounded-lg shadow-sm">
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {document.description || "No description provided."}
                            </p>
                        </div>
                    </div>

                    {/* Document Viewer */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                <Shield size={14} />
                                Preview
                            </div>
                        </div>
                        <DocumentViewer
                            documentId={document.id}
                            currentVersionId={document.currentVersion?.id}
                            mimeType={document.currentVersion?.mimeType}
                            fileName={document.currentVersion?.fileName}
                            effectiveStatus={document.effectiveStatus}
                        />
                    </div>

                    {/* Attachments Section */}
                    {document.currentVersion && (
                        <div className="p-6 bg-card border rounded-lg shadow-sm space-y-4">
                            <DocumentAttachments
                                documentId={document.id}
                                version={{
                                    id: document.currentVersion.id,
                                    isFrozen: document.currentVersion.isFrozen || false,
                                    attachments: document.currentVersion.attachments || []
                                }}
                                documentStatus={document.status}
                                onRefresh={loadDocument}
                            />
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN (1/3) - Metadata & History */}
                <div className="space-y-4">

                    {/* Acknowledgement Banner */}
                    <DocumentAcknowledgement
                        documentId={document.id}
                        documentStatus={document.effectiveStatus}
                        currentVersionId={document.currentVersion?.id}
                    />

                    {/* Tabs Logic */}
                    <div className="flex items-center space-x-1 border-b">
                        <button
                            onClick={() => setActiveTab("about")}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "about"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            About
                        </button>
                        <button
                            onClick={() => setActiveTab("versions")}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "versions"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Versions
                        </button>
                        <button
                            onClick={() => setActiveTab("reviews")}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "reviews"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Reviews
                        </button>
                        <button
                            onClick={() => setActiveTab("comments")}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "comments"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Comments
                        </button>
                        <button
                            onClick={() => setActiveTab("audit")}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "audit"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Audit
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[400px]">
                        {activeTab === "about" && (
                            <div className="p-5 bg-card border rounded-lg shadow-sm space-y-4 animate-in fade-in duration-200">
                                <div className="flex items-center gap-2 font-medium border-2 border-background pb-2 text-foreground">
                                    <FileText size={16} />
                                    <h3>About This Document</h3>
                                </div>

                                <div className="space-y-3 text-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-muted-foreground">Document No.</span>
                                        <span className="font-medium text-right text-foreground font-mono">{document.documentNumber || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-muted-foreground">Type</span>
                                        <span className="font-medium text-right text-foreground">{document.type?.name || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-muted-foreground">Expiry Date</span>
                                        <span className="font-medium text-right text-foreground">
                                            {document.expiryDate ? new Date(document.expiryDate).toLocaleDateString() : '-'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-muted-foreground">Status</span>
                                        <span className="font-medium text-right text-foreground">{document.effectiveStatus}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-muted-foreground">Version</span>
                                        <span className="font-medium text-right font-mono">v{document.currentVersion?.versionNumber || 0}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-muted-foreground">Format</span>
                                        <span className="font-medium text-right truncate">
                                            {document.currentVersion?.fileName.split('.').pop()?.toUpperCase() || '-'}
                                        </span>
                                    </div>
                                    <div className="pt-2 border-t mt-2">
                                        <div className="text-xs text-muted-foreground mb-1">Created</div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={12} />
                                            <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                                            <span className="text-muted-foreground/60">•</span>
                                            <span>{document.createdBy.fullName}</span>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t mt-2">
                                        <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={12} />
                                            <span>{new Date(document.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "versions" && (
                            <div className="p-5 bg-card border rounded-lg shadow-sm space-y-4 animate-in fade-in duration-200">
                                {/* <div className="flex items-center gap-2 font-medium  pb-2 text-foreground">
                                    <Shield size={16} />
                                    <h3>Version History</h3>
                                </div> */}
                                <div className="">
                                    <DmsVersionHistory
                                        documentId={document.id}
                                        documentStatus={document.effectiveStatus}
                                        onVersionUploaded={loadDocument}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "reviews" && (
                            <div className="animate-in fade-in duration-200">
                                <DocumentReviews
                                    documentId={document.id}
                                    // currentUserId not strictly needed if handled internally by component using useAuth?
                                    // But DocumentReviews prop accepts it. We can fetch user from useAuth inside component?
                                    // The page has access to user but we removed it from loadDocument.
                                    // Component uses useAuth() so it's fine.
                                    onReviewActionComplete={loadDocument}
                                />
                            </div>
                        )}

                        {activeTab === "comments" && (
                            <div className="animate-in fade-in duration-200 h-[500px] border rounded-lg bg-card overflow-hidden">
                                <div className="animate-in fade-in duration-200 h-[500px] border rounded-lg bg-card overflow-hidden">
                                    <DocumentComments
                                        documentId={document.id}
                                        readOnly={document.effectiveStatus === "APPROVED" || document.effectiveStatus === "OBSOLETE"}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "audit" && (
                            <div className="animate-in fade-in duration-200">
                                <DocumentAuditPanel documentId={document.id} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Share Modal */}
            {document && (
                <ShareDocumentModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    document={document}
                />
            )}

            {/* Edit Modal */}
            {document && (
                <EditDocumentModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    document={document}
                    onSuccess={loadDocument}
                />
            )}
        </div>
    )
}
