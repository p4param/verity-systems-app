"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { pdfjs, Document, Page } from 'react-pdf'
import {
    Loader2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    Download,
    Minus,
    Plus,
    Maximize,
    Minimize
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

// Set up the worker for pdf.js using the exact version from the package
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentPdfViewerProps {
    fileUrl: string
    zoom?: number
    onPageChange?: (page: number, total: number) => void
    documentId?: string
    versionId?: string
    onLoadComplete?: () => void
}

type ViewMode = 'FIT_WIDTH' | 'FIT_HEIGHT' | 'CUSTOM'

export function DocumentPdfViewer({
    fileUrl,
    zoom: initialZoom = 0.8,
    onPageChange,
    documentId,
    versionId,
    onLoadComplete
}: DocumentPdfViewerProps) {
    const { fetchRawWithAuth, user } = useAuth()
    const [numPages, setNumPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [isLoading, setIsLoading] = useState(true)
    const [isDownloading, setIsDownloading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [errorDetail, setErrorDetail] = useState<string | null>(null)
    const [blobUrl, setBlobUrl] = useState<string | null>(null)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [localZoom, setLocalZoom] = useState(initialZoom)
    const [viewMode, setViewMode] = useState<ViewMode>('FIT_WIDTH')
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
    const [pageOriginalSize, setPageOriginalSize] = useState({ width: 840, height: 1188 })

    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const canDownload = user?.permissions?.includes("DMS_DOCUMENT_DOWNLOAD")

    // Sync initial zoom
    useEffect(() => {
        setLocalZoom(initialZoom)
        setViewMode('CUSTOM')
    }, [initialZoom])

    // Resize Observer for container
    useEffect(() => {
        if (!containerRef.current) return
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerSize({
                    width: entry.contentRect.width - 64, // Margin
                    height: entry.contentRect.height - 64
                })
            }
        })
        observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [])

    // Calculate Scale
    const calculatedScale = useMemo(() => {
        if (viewMode === 'CUSTOM') return localZoom
        if (containerSize.width <= 0 || containerSize.height <= 0) return localZoom

        if (viewMode === 'FIT_WIDTH') {
            return containerSize.width / pageOriginalSize.width
        } else {
            return containerSize.height / pageOriginalSize.height
        }
    }, [viewMode, localZoom, containerSize, pageOriginalSize])

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault()
                setCurrentPage(p => Math.min(numPages, p + 1))
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                setCurrentPage(p => Math.max(1, p - 1))
            } else if (e.key === 'Home') {
                e.preventDefault()
                setCurrentPage(1)
            } else if (e.key === 'End') {
                e.preventDefault()
                setCurrentPage(numPages)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [numPages])

    // Fetch PDF as Blob with credentials
    useEffect(() => {
        let active = true
        let currentBlobUrl: string | null = null

        async function fetchPdf() {
            setIsLoading(true)
            setError(null)
            setErrorDetail(null)

            try {
                // Determine if we need to send Authorization header
                // Internal API calls (relative URLs starting with /) need auth
                // External signed URLs (S3, Cloudflare, etc.) will fail if Authorization is present
                const isInternal = fileUrl.startsWith('/');
                const fetchFn = isInternal ? fetchRawWithAuth : fetch;

                console.log(`[DocumentPdfViewer] Fetching PDF. Internal: ${isInternal}, URL: ${fileUrl.substring(0, 100)}...`);

                const response = await fetchFn(fileUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'application/pdf' }
                });

                if (!response.ok) {
                    // Logic to handle 401/403 specifically
                    if (response.status === 401) {
                        throw new Error("Unauthorized: Please log in again.");
                    }
                    if (response.status === 403) {
                        throw new Error("Access Denied: You do not have permission to view this document or the signed URL has expired.");
                    }
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }

                const blob = await response.blob();
                if (active) {
                    currentBlobUrl = URL.createObjectURL(blob);
                    setBlobUrl(currentBlobUrl);
                }
            } catch (err: any) {
                if (active) {
                    setError("Failed to fetch PDF document.")
                    setErrorDetail(err.message || String(err))
                    setIsLoading(false)
                }
            }
        }

        fetchPdf()

        const timeoutId = setTimeout(() => {
            if (active && isLoading && !error) {
                setErrorDetail("Initializing is taking longer than expected. Large documents may take time to render.")
            }
        }, 15000)

        return () => {
            active = false
            clearTimeout(timeoutId)
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl)
            }
        }
    }, [fileUrl, fetchRawWithAuth])

    // Notify Parent
    useEffect(() => {
        onPageChange?.(currentPage, numPages)
    }, [currentPage, numPages, onPageChange])

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages)
        setIsLoading(false)
        onLoadComplete?.()
    }

    const onDocumentLoadError = (err: any) => {
        setError("Failed to render PDF document.")
        setErrorDetail(err.message || String(err))
        setIsLoading(false)
        onLoadComplete?.()
    }

    const onPageLoadSuccess = (page: any) => {
        setPageOriginalSize({
            width: page.width,
            height: page.height
        })
    }

    const handleDownload = async () => {
        if (!documentId || !versionId) return
        setIsDownloading(true)
        try {
            const downloadUrl = `/api/secure/dms/documents/${documentId}/versions/${versionId}/download`
            window.open(downloadUrl, '_blank')
        } catch (err) {
            console.error("Download failed:", err)
        } finally {
            setIsDownloading(false)
        }
    }

    const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value)
        if (!isNaN(value)) {
            setCurrentPage(Math.max(1, Math.min(numPages, value)))
        }
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#f1f5f9] overflow-hidden select-none border-t border-gray-200">
            {/* Enterprise Toolbar (Fixed) */}
            <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
                        title={isSidebarCollapsed ? "Show Thumbnails" : "Hide Thumbnails"}
                    >
                        {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </button>

                    <div className="h-6 w-[1px] bg-gray-200 mx-1" />

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage <= 1 || isLoading}
                            className="p-1.5 hover:bg-gray-100 disabled:opacity-30 rounded-md transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5 text-gray-600" />
                        </button>

                        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md">
                            <input
                                ref={inputRef}
                                type="number"
                                min={1}
                                max={numPages}
                                value={currentPage}
                                onChange={handlePageInput}
                                className="w-10 text-center text-sm font-bold bg-transparent outline-none text-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">OF</span>
                            <span className="text-sm font-bold text-gray-700 min-w-[20px]">{numPages || '...'}</span>
                        </div>

                        <button
                            onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                            disabled={currentPage >= numPages || isLoading}
                            className="p-1.5 hover:bg-gray-100 disabled:opacity-30 rounded-md transition-colors"
                        >
                            <ChevronRight className="h-5 w-5 text-gray-600" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md p-1 shadow-inner">
                        <button
                            onClick={() => { setViewMode('FIT_WIDTH') }}
                            className={`p-1.5 rounded transition-all ${viewMode === 'FIT_WIDTH' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Fit Width"
                        >
                            <Maximize className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => { setViewMode('FIT_HEIGHT') }}
                            className={`p-1.5 rounded transition-all ${viewMode === 'FIT_HEIGHT' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Fit Height"
                        >
                            <Minimize className="h-4 w-4" />
                        </button>

                        <div className="h-4 w-[1px] bg-gray-200 mx-1" />

                        <button
                            onClick={() => { setViewMode('CUSTOM'); setLocalZoom(Math.max(0.5, localZoom - 0.1)) }}
                            className="p-1 hover:bg-white rounded transition-all disabled:opacity-30"
                            disabled={isLoading}
                        >
                            <Minus className="h-4 w-4 text-gray-600" />
                        </button>
                        <select
                            value={viewMode === 'CUSTOM' ? String(Math.round(localZoom * 100)) : ''}
                            onChange={(e) => {
                                const val = parseInt(e.target.value)
                                if (!isNaN(val)) {
                                    setViewMode('CUSTOM')
                                    setLocalZoom(val / 100)
                                }
                            }}
                            className="text-[11px] font-black text-blue-600 w-16 text-center tabular-nums bg-transparent outline-none cursor-pointer border-none"
                            title="Zoom level"
                        >
                            {viewMode !== 'CUSTOM' && (
                                <option value="">{Math.round(calculatedScale * 100)}%</option>
                            )}
                            {[50, 75, 80, 90, 100, 125, 150, 200].map(pct => (
                                <option key={pct} value={String(pct)}>{pct}%</option>
                            ))}
                        </select>
                        <button
                            onClick={() => { setViewMode('CUSTOM'); setLocalZoom(Math.min(3.0, localZoom + 0.1)) }}
                            className="p-1 hover:bg-white rounded transition-all disabled:opacity-30"
                            disabled={isLoading}
                        >
                            <Plus className="h-4 w-4 text-gray-600" />
                        </button>
                    </div>

                    {canDownload && (
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading || !documentId || isLoading}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95
                                ${isDownloading || isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Download
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Global Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-50/95">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                        <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] animate-pulse">Enterprise Viewer</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 text-center bg-white">
                        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Viewer Error</h3>
                        <p className="text-sm text-gray-500 mt-2 max-w-xs">{error}</p>
                        {errorDetail && (
                            <p className="text-[10px] text-red-500 mt-4 font-mono bg-red-50 p-3 rounded-lg border border-red-100 max-w-md break-all">
                                {errorDetail}
                            </p>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-8 px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-black hover:bg-blue-100 transition-colors"
                        >
                            RELOAD
                        </button>
                    </div>
                )}

                {blobUrl && (
                    <Document
                        file={blobUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={null}
                        className="flex flex-1 overflow-hidden h-full"
                    >
                        {/* Thumbnail Sidebar (Fixed Width, Scrollable Content) */}
                        <div
                            className={`bg-[#f8fafc] border-r border-gray-200 transition-all duration-300 ease-in-out overflow-y-auto custom-scrollbar flex flex-col gap-8 py-8 shrink-0
                                ${isSidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-[200px] opacity-100'}`}
                        >
                            {numPages > 0 && Array.from(new Array(numPages), (el, index) => (
                                <div
                                    key={`thumb_${index + 1}`}
                                    onClick={() => setCurrentPage(index + 1)}
                                    className="flex flex-col items-center gap-3 cursor-pointer group px-4"
                                >
                                    <div className={`relative transition-all duration-200 shadow-md border-2 rounded bg-white
                                        ${currentPage === index + 1 ? 'border-blue-500 scale-105 shadow-blue-200/50' : 'border-transparent group-hover:border-gray-300 group-hover:scale-105'}`}>
                                        <Page
                                            pageNumber={index + 1}
                                            scale={0.15}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            loading={<div className="w-[124px] h-[175px] bg-gray-100 rounded" />}
                                            className="overflow-hidden rounded"
                                        />
                                        {currentPage === index + 1 && (
                                            <div className="absolute -top-1 -right-1">
                                                <div className="bg-blue-500 rounded-full w-3 h-3 border-2 border-white shadow-sm" />
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-black tracking-widest ${currentPage === index + 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {index + 1}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Controlled Single-Page Canvas */}
                        <div
                            ref={containerRef}
                            className="flex-1 relative overflow-auto bg-[#cbd5e1] flex items-start justify-center p-8 custom-scrollbar"
                        >
                            {numPages > 0 && (
                                <div
                                    className="relative shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-gray-400 bg-white"
                                    style={{
                                        width: 'fit-content',
                                        height: 'fit-content'
                                    }}
                                >
                                    {/* Watermark Overlay */}
                                    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none flex items-center justify-center opacity-[0.03]">
                                        <div className="rotate-[-45deg] scale-[2] font-black text-gray-900 whitespace-nowrap text-[80px]">
                                            VERITY SECURE DMS • {user?.tenantId} • {new Date().toLocaleDateString()}
                                        </div>
                                    </div>

                                    <Page
                                        pageNumber={currentPage}
                                        scale={calculatedScale}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        onLoadSuccess={onPageLoadSuccess}
                                        loading={
                                            <div className="bg-white flex items-center justify-center" style={{ width: pageOriginalSize.width * calculatedScale, height: pageOriginalSize.height * calculatedScale }}>
                                                <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                                            </div>
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </Document>
                )}
            </div>

            <style jsx>{`
                :global(.custom-scrollbar::-webkit-scrollbar) {
                    width: 8px;
                    height: 8px;
                }
                :global(.custom-scrollbar::-webkit-scrollbar-track) {
                    background: transparent;
                }
                :global(.custom-scrollbar::-webkit-scrollbar-thumb) {
                    background: #94a3b8;
                    border-radius: 10px;
                    border: 2px solid transparent;
                    background-clip: content-box;
                }
                :global(.custom-scrollbar::-webkit-scrollbar-thumb:hover) {
                    background: #64748b;
                    background-clip: content-box;
                }
            `}</style>
        </div>
    )
}
