"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
    Loader2,
    AlertCircle,
    Maximize,
    Minimize,
    Minus,
    Plus,
    Download
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

interface DocumentImagePreviewProps {
    imageUrl: string
    onDownload?: () => void
    canDownload?: boolean
    onLoadComplete?: () => void
}

type ViewMode = 'FIT_WIDTH' | 'FIT_HEIGHT' | 'CUSTOM'

export function DocumentImagePreview({
    imageUrl,
    onDownload,
    canDownload = false,
    onLoadComplete
}: DocumentImagePreviewProps) {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>('FIT_WIDTH')
    const [zoom, setZoom] = useState(1.0)
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
    const [imageOriginalSize, setImageOriginalSize] = useState({ width: 0, height: 0 })

    const containerRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)

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

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget
        setImageOriginalSize({
            width: img.naturalWidth,
            height: img.naturalHeight
        })
        setIsLoading(false)
        onLoadComplete?.()
    }

    const handleImageError = () => {
        setError("Failed to load image preview. The link may have expired.")
        setIsLoading(false)
        onLoadComplete?.()
    }

    // Calculate Scale
    const calculatedScale = useMemo(() => {
        if (viewMode === 'CUSTOM') return zoom
        if (containerSize.width <= 0 || containerSize.height <= 0 || imageOriginalSize.width <= 0) return zoom

        if (viewMode === 'FIT_WIDTH') {
            return containerSize.width / imageOriginalSize.width
        } else {
            return containerSize.height / imageOriginalSize.height
        }
    }, [viewMode, zoom, containerSize, imageOriginalSize])

    return (
        <div className="flex flex-col h-full w-full bg-[#f1f5f9] overflow-hidden select-none border-t border-gray-200">
            {/* Toolbar (Fixed) */}
            <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-md">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Image Preview</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md p-1 shadow-inner">
                        <button
                            onClick={() => setViewMode('FIT_WIDTH')}
                            className={`p-1.5 rounded transition-all ${viewMode === 'FIT_WIDTH' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Fit Width"
                        >
                            <Maximize className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('FIT_HEIGHT')}
                            className={`p-1.5 rounded transition-all ${viewMode === 'FIT_HEIGHT' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Fit Height"
                        >
                            <Minimize className="h-4 w-4" />
                        </button>

                        <div className="h-4 w-px bg-gray-200 mx-1" />

                        <button
                            onClick={() => { setViewMode('CUSTOM'); setZoom(Math.max(0.1, zoom - 0.1)) }}
                            className="p-1 hover:bg-white rounded transition-all disabled:opacity-30"
                            disabled={isLoading}
                        >
                            <Minus className="h-4 w-4 text-gray-600" />
                        </button>
                        <span className="text-[11px] font-black text-blue-600 w-12 text-center tabular-nums">
                            {Math.round(calculatedScale * 100)}%
                        </span>
                        <button
                            onClick={() => { setViewMode('CUSTOM'); setZoom(Math.min(5.0, zoom + 0.1)) }}
                            className="p-1 hover:bg-white rounded transition-all disabled:opacity-30"
                            disabled={isLoading}
                        >
                            <Plus className="h-4 w-4 text-gray-600" />
                        </button>
                    </div>

                    {canDownload && onDownload && (
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden flex flex-col">
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-50/95">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                        <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] animate-pulse">Enterprise Viewer</p>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 text-center bg-white">
                        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Preview Error</h3>
                        <p className="text-sm text-gray-500 mt-2 max-w-xs">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-8 px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-black hover:bg-blue-100 transition-colors"
                        >
                            RELOAD
                        </button>
                    </div>
                )}

                <div
                    ref={containerRef}
                    className="flex-1 relative overflow-auto bg-[#cbd5e1] flex items-center justify-center p-8 custom-scrollbar"
                >
                    <div
                        className="relative shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-gray-400 bg-white leading-0"
                        style={{
                            width: imageOriginalSize.width ? imageOriginalSize.width * calculatedScale : 'auto',
                            height: imageOriginalSize.height ? imageOriginalSize.height * calculatedScale : 'auto'
                        }}
                    >
                        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none flex items-center justify-center opacity-[0.03]">
                            <div className="-rotate-45 scale-[2] font-black text-gray-900 whitespace-nowrap text-[80px]">
                                VERITY SECURE DMS • {user?.tenantId} • {new Date().toLocaleDateString()}
                            </div>
                        </div>

                        <img
                            ref={imageRef}
                            src={imageUrl}
                            alt="Document Preview"
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            className="w-full h-full object-contain"
                            style={{
                                imageRendering: calculatedScale < 1 ? 'auto' : 'pixelated'
                            }}
                        />
                    </div>
                </div>
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
