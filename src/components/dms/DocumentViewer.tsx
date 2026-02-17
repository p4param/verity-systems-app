"use client"

import * as React from "react"
import { Loader2, AlertCircle, Download, FileX, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth/auth-context"

interface DocumentViewerProps {
    documentId: string
    currentVersionId?: string | null
    mimeType?: string | null
    effectiveStatus: string
    fileName?: string
}

interface ViewerState {
    signedUrl: string | null
    isLoading: boolean
    error: string | null
    fetchedAt: number | null
}

const REFRESH_INTERVAL_MS = 4 * 60 * 1000 // 4 minutes
const SIGNED_URL_EXPIRY_S = 300 // 5 minutes (default)

export function DocumentViewer({
    documentId,
    currentVersionId,
    mimeType,
    effectiveStatus,
    fileName = "document"
}: DocumentViewerProps) {
    const { fetchWithAuth } = useAuth()
    const fetchWithAuthRef = React.useRef(fetchWithAuth)
    React.useEffect(() => { fetchWithAuthRef.current = fetchWithAuth }, [fetchWithAuth])

    const [state, setState] = React.useState<ViewerState>({
        signedUrl: null,
        isLoading: false,
        error: null,
        fetchedAt: null
    })

    const isMounted = React.useRef(true)
    const hasSignedUrl = React.useRef(false)

    React.useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
        }
    }, [])

    React.useEffect(() => {
        hasSignedUrl.current = !!state.signedUrl
    }, [state.signedUrl])

    const fetchSignedUrl = React.useCallback(async (silent = false) => {
        if (!currentVersionId) return

        if (!silent) {
            setState(prev => ({ ...prev, isLoading: true, error: null }))
        }

        try {
            const data = await fetchWithAuthRef.current<{ downloadUrl: string }>(
                `/api/secure/dms/documents/${documentId}/versions?action=view&versionId=${currentVersionId}`
            )

            if (isMounted.current) {
                setState({
                    signedUrl: data.downloadUrl,
                    isLoading: false,
                    error: null,
                    fetchedAt: Date.now()
                })
            }
        } catch (err: any) {
            console.error("[DocumentViewer] Fetch error:", err)
            if (isMounted.current) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: silent ? null : (err.message || "Failed to load document")
                }))
            }
        }
    }, [documentId, currentVersionId])

    React.useEffect(() => {
        if (effectiveStatus === "EXPIRED") {
            setState(prev => ({ ...prev, signedUrl: null, error: null }))
            return
        }

        if (currentVersionId) {
            fetchSignedUrl()
        } else {
            setState(prev => ({ ...prev, signedUrl: null, isLoading: false }))
        }
    }, [currentVersionId, effectiveStatus, fetchSignedUrl])

    React.useEffect(() => {
        if (effectiveStatus === "EXPIRED") return
        if (!currentVersionId) return

        const timer = setInterval(() => {
            if (hasSignedUrl.current) {
                fetchSignedUrl(true)
            }
        }, REFRESH_INTERVAL_MS)

        return () => clearInterval(timer)
    }, [currentVersionId, effectiveStatus, fetchSignedUrl])

    // --- State: Expired ---
    if (effectiveStatus === "OBSOLETE" || effectiveStatus === "EXPIRED") { // Assuming 'EXPIRED' maps to 'OBSOLETE' or is a computed status
        // If logic explicitly uses "EXPIRED" string, keep it. 
        // Assuming "OBSOLETE" is the enum value in schema but UI might pass "EXPIRED".
    }

    // Strict check on effectiveStatus as passed prop
    const isExpired = effectiveStatus === "EXPIRED" || effectiveStatus === "OBSOLETE"

    if (isExpired) {
        return (
            <Card className="flex flex-col items-center justify-center h-[500px] bg-gray-50 border-dashed">
                <FileX className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Document Expired</h3>
                <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">
                    This document version is no longer active.
                    <br />You cannot view the preview.
                </p>
                {/* Optional: Check if download is allowed for expired docs */}
            </Card>
        )
    }

    // --- State: No Version ---
    if (!currentVersionId) {
        return (
            <Card className="flex flex-col items-center justify-center h-[500px] bg-gray-50 border-dashed">
                <div className="p-4 rounded-full bg-gray-100 mb-4">
                    <FileX className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No Version Uploaded</h3>
                <p className="text-sm text-gray-500 mt-2">
                    Upload a file to see the preview here.
                </p>
            </Card>
        )
    }

    // --- State: Loading ---
    if (state.isLoading && !state.signedUrl) {
        return (
            <Card className="flex flex-col items-center justify-center h-[600px] bg-white">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <p className="text-sm text-gray-500">Loading preview...</p>
            </Card>
        )
    }

    // --- State: Error ---
    if (state.error) {
        return (
            <Card className="flex flex-col items-center justify-center h-[500px] bg-red-50 border-red-100">
                <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                <h3 className="text-lg font-medium text-red-900">Preview Failed</h3>
                <p className="text-sm text-red-600 mt-2 mb-6 max-w-sm text-center">
                    {state.error}
                </p>
                <Button onClick={() => fetchSignedUrl()} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry
                </Button>
            </Card>
        )
    }

    // --- Determine Viewer Type ---
    const cleanMime = mimeType?.toLowerCase() || ""
    const isPdf = cleanMime === "application/pdf"

    // Support common image formats
    const isImage = cleanMime.startsWith("image/")

    // --- Render Content ---
    return (
        <Card className="flex flex-col overflow-hidden bg-white border border-gray-200 h-full min-h-[600px] shadow-sm">
            {/* Toolbar (Optional, currently just for structure) */}

            <div className="flex-1 bg-gray-100 relative overflow-auto flex items-center justify-center min-h-[500px]">
                {state.signedUrl && (
                    <>
                        {isPdf ? (
                            <object
                                data={state.signedUrl}
                                type="application/pdf"
                                className="w-full h-full min-h-[600px]"
                            >
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                    <FileX className="h-12 w-12 text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">PDF preview not supported in this browser</h3>
                                    <p className="text-sm text-gray-500 mb-4">You can download the file to view it.</p>
                                    <a
                                        href={state.signedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        <Download className="h-4 w-4" />
                                        Open PDF
                                    </a>
                                </div>
                            </object>
                        ) : isImage ? (
                            <div className="w-full h-full flex items-center justify-center p-4">
                                <img
                                    src={state.signedUrl}
                                    alt="Preview"
                                    className="max-w-full max-h-[800px] object-contain shadow-lg rounded-sm bg-white"
                                    onError={(e) => {
                                        console.error("Image load failed", e)
                                        e.currentTarget.style.display = 'none'
                                        setState(prev => ({ ...prev, error: "Failed to load image" }))
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="text-center p-8">
                                <div className="p-4 rounded-full bg-gray-200 inline-block mb-4">
                                    <FileX className="h-8 w-8 text-gray-500" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Preview Not Available</h3>
                                <p className="text-sm text-gray-500 mt-2 mb-6">
                                    This file type ({cleanMime || "unknown"}) cannot be previewed.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer / Download Action */}
            <div className="p-4 border-t bg-white flex justify-between items-center">
                <div className="text-sm text-gray-500">
                    {fileName}
                </div>

                <Button
                    variant="outline"
                    disabled={!state.signedUrl}
                    onClick={() => {
                        if (state.signedUrl) {
                            window.open(state.signedUrl, '_blank', 'noopener,noreferrer')
                        }
                    }}
                    className="gap-2"
                >
                    <Download className="h-4 w-4" />
                    Download File
                </Button>
            </div>
        </Card>
    )
}
