"use client"

import React, { useState, useRef } from "react"
import {
    Upload,
    File,
    X,
    AlertCircle,
    Loader2,
    CheckCircle2
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Modal } from "@/components/ui/Modal"

interface UploadVersionModalProps {
    isOpen: boolean
    onClose: () => void
    documentId: string
    onSuccess: () => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadVersionModal({ isOpen, onClose, documentId, onSuccess }: UploadVersionModalProps) {
    const { fetchWithAuth } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        setError(null)
        setSuccess(false)

        if (!selectedFile) return

        if (selectedFile.size > MAX_FILE_SIZE) {
            setError("File size exceeds 10MB limit.")
            setFile(null)
            return
        }

        setFile(selectedFile)
    }

    const handleUpload = async () => {
        if (!file) return

        try {
            setUploading(true)
            setError(null)

            const formData = new FormData()
            formData.append("file", file)

            // Note: fetchWithAuth automatically handles Authorization header
            const res = await fetchWithAuth(`/api/secure/dms/documents/${documentId}/versions`, {
                method: "POST",
                // FormData automatically sets the correct Content-Type with boundary
                body: formData
            })

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                handleClose()
            }, 1000)
        } catch (err: any) {
            setError(err.message || "Upload failed. Please try again.")
        } finally {
            setUploading(false)
        }
    }

    const handleClose = () => {
        setFile(null)
        setError(null)
        setSuccess(false)
        onClose()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Upload New Version"
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all"
                        disabled={!file || uploading || success}
                    >
                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploading ? "Uploading..." : success ? "Uploaded!" : "Upload Version"}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded p-2 flex gap-2 items-center text-amber-800 text-sm">
                    {/* <AlertCircle size={14} className="shrink-0" /> */}
                    <p className="italic">
                        “Approved documents are recommended to be published in PDF format.”
                    </p>
                </div>

                <p className="text-sm text-muted-foreground">
                    Select a new file to create a new version of this document. Older versions will be preserved in the history.
                    Max file size: <span className="font-semibold">10MB</span>.
                </p>

                <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`
                        relative border-2 border-dashed rounded-lg p-8 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer
                        ${file ? "border-primary/50 bg-primary/5" : "border-muted hover:border-primary/30 hover:bg-muted/30"}
                        ${uploading ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {file ? (
                        <>
                            <div className="p-3 bg-primary/10 rounded-full text-primary">
                                <File size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium truncate max-w-[280px]">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                            {!uploading && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setFile(null)
                                    }}
                                    className="absolute top-2 right-2 p-1 hover:bg-muted-foreground/10 rounded-full transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="p-3 bg-muted rounded-full text-muted-foreground">
                                <Upload size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium">Click to select file</p>
                                <p className="text-xs text-muted-foreground">PDF, DOCX, PNG, JPG supported</p>
                            </div>
                        </>
                    )}

                    {success && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg animate-in fade-in duration-300">
                            <div className="flex flex-col items-center gap-2 text-green-600">
                                <CheckCircle2 size={32} className="animate-bounce" />
                                <span className="font-semibold">Version Uploaded!</span>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md animate-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </Modal>
    )
}
