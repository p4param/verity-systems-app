"use client"

import React, { useEffect, useState, use } from "react"
import {
    FileText,
    Download,
    AlertCircle,
    Loader2,
    ShieldCheck,
    Clock,
    Calendar
} from "lucide-react"

// Types
interface SharedDocument {
    token: string
    document: {
        title: string
        description?: string
        mimeType: string
        sizeBytes: number
        updatedAt: string
    }
    expiresAt: string | null
    downloadUrl: string
}

export default function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params)
    const [data, setData] = useState<SharedDocument | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchShare = async () => {
            try {
                // Determine API URL - in robust apps we'd have a public API route or middleware.
                // For V1, let's assume we have a public endpoint or we use the existing one if public capable.
                // Looking at `api/secure/dms/...`, those are protected.
                // We need a PUBLIC route: `GET /api/public/dms/share/[token]`

                // Since we likely haven't implemented the PUBLIC API route yet, 
                // I will IMPLEMENT the UI to expect it, and if it 404s, I'll know I need to build the API route too.
                // Actually, the plan mentions "Implement Public Share View". 
                // Let's assume the API route exists or I will need to create it.
                // Checking previous tasks... "Refactor Share API Routes" was done. 
                // Let's check if there is a public route.

                const res = await fetch(`/api/public/dms/share/${token}`)

                if (!res.ok) {
                    const err = await res.json()
                    // The API returns { success: false, error: { code, message } }
                    throw new Error(err.error?.message || err.message || "Failed to load document")
                }

                const json = await res.json()
                setData(json)
            } catch (err: any) {
                // Extremely robust error message extraction to avoid [object Object]
                const message = err.message ||
                    (typeof err.error === 'string' ? err.error : err.error?.message) ||
                    (typeof err === 'string' ? err : "Invalid or expired link");
                setError(String(message));
            } finally {
                setLoading(false)
            }
        }

        fetchShare()
    }, [token])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <Loader2 size={32} className="animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground animate-pulse">Verifying secure link...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                        <AlertCircle size={32} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
                        <p className="text-gray-500 mt-2">{error}</p>
                    </div>
                    <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded">
                        This link may have expired, been revoked, or is invalid.
                        Please contact the sender for a new link.
                    </div>
                </div>
            </div>
        )
    }

    if (!data) return null

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-2 text-primary font-bold text-lg">
                    <ShieldCheck size={24} />
                    <span>VeritySecure</span>
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">
                    Secure Document Sharing
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border">
                    {/* Document Header */}
                    <div className="p-8 border-b bg-linear-to-br from-white to-gray-50">
                        <div className="flex items-start justify-between gap-6">
                            <div className="space-y-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg inline-flex">
                                    <FileText size={32} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                                        {data.document.title}
                                    </h1>
                                    <p className="text-sm text-gray-500 mt-2">
                                        {(data.document.sizeBytes / 1024 / 1024).toFixed(2)} MB • {data.document.mimeType}
                                    </p>
                                </div>
                                {data.document.description && (
                                    <p className="text-gray-600 max-w-xl leading-relaxed">
                                        {data.document.description}
                                    </p>
                                )}
                            </div>

                            <a
                                href={data.downloadUrl}
                                download
                                className="hidden sm:inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-95"
                            >
                                <Download size={20} />
                                Download File
                            </a>
                        </div>
                    </div>

                    {/* Meta Info */}
                    <div className="p-6 bg-gray-50/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-3 text-gray-600">
                            <Clock size={16} className="text-muted-foreground" />
                            <span>Expires: </span>
                            <span className="font-medium text-gray-900">
                                {data.expiresAt
                                    ? new Date(data.expiresAt).toLocaleString()
                                    : "Never"}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                            <Calendar size={16} className="text-muted-foreground" />
                            <span>Last Updated: </span>
                            <span className="font-medium text-gray-900">
                                {new Date(data.document.updatedAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* Mobile Download Button */}
                    <div className="p-6 sm:hidden border-t">
                        <a
                            href={data.downloadUrl}
                            download
                            className="flex w-full items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all shadow-md"
                        >
                            <Download size={20} />
                            Download File
                        </a>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-xs text-muted-foreground">
                Protected by VeritySystems Secure Share
            </footer>
        </div>
    )
}
