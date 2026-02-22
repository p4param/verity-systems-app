"use client"

import * as React from "react"
import { Loader2, AlertCircle, FileX, RefreshCw, FileText } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth/auth-context"
import dynamic from "next/dynamic"

const DocumentPdfViewer = dynamic(() => import("./DocumentPdfViewer").then(mod => ({ default: mod.DocumentPdfViewer })), { ssr: false })
const DocumentImagePreview = dynamic(() => import("./DocumentImagePreview").then(mod => ({ default: mod.DocumentImagePreview })), { ssr: false })

interface DocumentViewerProps {
    documentId: string
    currentVersionId?: string | null
    mimeType?: string | null
    effectiveStatus: string
    fileName?: string
    contentMode?: "FILE" | "STRUCTURED"
    contentJson?: any | null
    onEdit?: () => void
    canEdit?: boolean
    initialPreviewSource?: {
        type: PreviewType,
        url: string | null
    } | null
}

type PreviewType = "PDF" | "IMAGE" | "UNSUPPORTED"

interface ViewerState {
    previewUrl: string | null
    previewType: PreviewType
    isLoading: boolean
    isRendering: boolean
    error: string | null
    fetchedAt: number | null
}

const REFRESH_INTERVAL_MS = 4 * 60 * 1000 // 4 minutes

export const DocumentViewer = React.memo(function DocumentViewer({
    documentId,
    currentVersionId,
    mimeType,
    effectiveStatus,
    fileName = "document",
    contentMode = "FILE",
    contentJson,
    onEdit,
    canEdit = false,
    initialPreviewSource
}: DocumentViewerProps) {
    const { fetchWithAuth } = useAuth()
    const fetchWithAuthRef = React.useRef(fetchWithAuth)
    React.useEffect(() => { fetchWithAuthRef.current = fetchWithAuth }, [fetchWithAuth])

    const [state, setState] = React.useState<ViewerState>({
        previewUrl: initialPreviewSource?.url || null,
        previewType: initialPreviewSource?.type || "UNSUPPORTED",
        isLoading: !initialPreviewSource && !!currentVersionId,
        isRendering: !!initialPreviewSource?.url,
        error: null,
        fetchedAt: initialPreviewSource ? Date.now() : null
    })

    const isMounted = React.useRef(true)
    const isExpired = effectiveStatus === "EXPIRED" || effectiveStatus === "OBSOLETE"

    React.useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const resolveSource = React.useCallback(async (silent = false) => {
        if (!documentId || !currentVersionId) {
            console.log(`[DocumentViewer] Skipping resolve: doc=${documentId}, version=${currentVersionId}`);
            if (isMounted.current) {
                setState(prev => ({ ...prev, isLoading: false }));
            }
            return;
        }

        if (!silent) {
            setState(prev => ({ ...prev, isLoading: true, error: null }))
        }

        try {
            const url = `/api/secure/dms/documents/${documentId}/versions/${currentVersionId}/source-p`;
            console.log(`[DocumentViewer] Resolving source: ${url}`);

            // Call the authoritative preview-source resolver
            const response = await fetchWithAuthRef.current<{
                type: PreviewType,
                url: string | null,
                message?: string
            }>(url);

            if (isMounted.current) {
                console.log(`[DocumentViewer] Resolved: type=${response.type}, hasUrl=${!!response.url}`);
                if (response.url) {
                    setState({
                        previewUrl: response.url,
                        previewType: response.type,
                        isLoading: false,
                        isRendering: true,
                        error: null,
                        fetchedAt: Date.now()
                    })
                } else if (response.type === "UNSUPPORTED") {
                    setState(prev => ({
                        ...prev,
                        isLoading: false,
                        previewType: "UNSUPPORTED",
                        error: null
                    }))
                } else {
                    setState(prev => ({
                        ...prev,
                        isLoading: false,
                        error: response.message || "Preview not available for this version"
                    }))
                }
            }
        } catch (err: any) {
            console.error(`[DocumentViewer] Failed to resolve source for doc=${documentId}, version=${currentVersionId}:`, err);
            if (isMounted.current) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: err.message || "Failed to load document preview"
                }))
            }
        }
    }, [documentId, currentVersionId])

    React.useEffect(() => {
        if (isExpired) {
            setState(prev => ({ ...prev, previewUrl: null, error: null }))
            return
        }

        // If we have an initial source and currentVersionId matches what we expect?
        // Actually, resolveSource handles skip if null.
        // We only want to trigger resolveSource if we DON'T have an initial URL or if currentVersionId changed.
        if (currentVersionId) {
            if (!state.previewUrl || state.error) {
                resolveSource()
            }
        } else {
            setState(prev => ({ ...prev, previewUrl: null, isLoading: false }))
        }
    }, [currentVersionId, isExpired, resolveSource])

    // Periodic refresh for signed URLs
    React.useEffect(() => {
        if (effectiveStatus === "EXPIRED" || !currentVersionId) return

        const timer = setInterval(() => {
            if (state.previewUrl) {
                resolveSource(true)
            }
        }, REFRESH_INTERVAL_MS)

        return () => clearInterval(timer)
    }, [currentVersionId, effectiveStatus, resolveSource, state.previewUrl])

    // --- RENDER HELPERS ---

    if (isExpired && contentMode === "FILE") {
        return (
            <Card className="flex flex-col items-center justify-center h-[500px] bg-gray-50 border-dashed">
                <FileX className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Document Expired</h3>
                <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">
                    This document version is no longer active.
                    <br />Access to the original file is restricted.
                </p>
            </Card>
        )
    }

    if (!currentVersionId) {
        return (
            <Card className="flex flex-col items-center justify-center h-[500px] bg-gray-50 border-dashed">
                <div className="p-4 rounded-full bg-gray-100 mb-4">
                    <FileX className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No Content</h3>
                <p className="text-sm text-gray-500 mt-2">Upload a file or add content to see preview.</p>
            </Card>
        )
    }

    if (state.isLoading && !state.previewUrl) {
        return (
            <Card className="flex flex-col items-center justify-center h-[600px] bg-white">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <p className="text-sm text-gray-500">Initializing secure preview...</p>
            </Card>
        )
    }

    if (state.error) {
        return (
            <Card className="flex flex-col items-center justify-center h-[500px] bg-red-50 border-red-100">
                <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                <h3 className="text-lg font-medium text-red-900">Preview Failed</h3>
                <p className="text-sm text-red-600 mt-2 mb-6 max-w-sm text-center">{state.error}</p>
                <Button onClick={() => resolveSource()} variant="outline" className="gap-2 font-bold text-xs uppercase">
                    <RefreshCw className="h-3 w-3" />
                    Retry Load
                </Button>
            </Card>
        )
    }

    const showGlobalLoading = state.isLoading || state.isRendering;

    // --- MAIN RENDERING LOGIC ---

    return (
        <Card className="flex flex-col overflow-hidden bg-gray-100 border-none h-full min-h-[600px] shadow-lg relative">
            <div className="flex-1 overflow-hidden relative">
                {state.previewUrl ? (
                    <>
                        {showGlobalLoading && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">
                                    {state.isLoading ? "Authorizing..." : "Rendering..."}
                                </p>
                            </div>
                        )}
                        {state.previewType === "PDF" ? (
                            <DocumentPdfViewer
                                fileUrl={state.previewUrl}
                                zoom={1.0}
                                documentId={documentId}
                                versionId={currentVersionId}
                                onLoadComplete={() => setState(s => ({ ...s, isRendering: false }))}
                            />
                        ) : state.previewType === "IMAGE" ? (
                            <DocumentImagePreview
                                imageUrl={state.previewUrl}
                                canDownload={true}
                                onDownload={() => {
                                    const downloadUrl = `/api/secure/dms/documents/${documentId}/versions/${currentVersionId}/download`
                                    window.open(downloadUrl, '_blank')
                                }}
                                onLoadComplete={() => setState(s => ({ ...s, isRendering: false }))}
                            />
                        ) : (
                            <UnsupportedPreview mimeType={mimeType} documentId={documentId} currentVersionId={currentVersionId} />
                        )}
                    </>
                ) : (
                    <UnsupportedPreview mimeType={mimeType} documentId={documentId} currentVersionId={currentVersionId} />
                )}
            </div>

            {/* Footer Status Bar */}
            <div className="px-4 py-3 border-t bg-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                        {contentMode === "STRUCTURED" ? "Structured Canvas" : `Secure File Preview (${state.previewType})`}
                    </span>
                    <span className="text-xs text-gray-300 font-mono hidden sm:inline">{fileName}</span>
                </div>

                {contentMode === "STRUCTURED" && canEdit && onEdit && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2 h-8 px-4"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        Edit Content
                    </Button>
                )}
            </div>
        </Card>
    )
})

function UnsupportedPreview({ mimeType, documentId, currentVersionId }: { mimeType?: string | null, documentId: string, currentVersionId: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-white rounded-xl mx-8 my-8 shadow-sm">
            <div className="p-8 rounded-full bg-gray-50 border border-gray-100 mb-8 shadow-inner">
                <FileX className="h-16 w-16 text-gray-200" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Preview Unavailable</h3>
            <p className="text-sm text-gray-500 mt-4 max-w-sm mx-auto leading-relaxed">
                The format (<strong>{mimeType || "unknown"}</strong>) does not support in-browser previewing.
            </p>
            <Button
                variant="outline"
                onClick={() => {
                    const downloadUrl = `/api/secure/dms/documents/${documentId}/versions/${currentVersionId}/download`
                    window.open(downloadUrl, '_blank')
                }}
                className="mt-10 gap-2 border-2 font-bold px-8 h-12 rounded-xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
            >
                Download to View Locally
            </Button>
        </div>
    )
}
