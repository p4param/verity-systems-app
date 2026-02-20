"use client"

import React, { useState, useEffect } from "react"
import {
    Loader2,
    AlertCircle,
    Save,
    Info
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Modal } from "@/components/ui/Modal"

interface EditInlineContentModalProps {
    isOpen: boolean
    onClose: () => void
    documentId: string
    currentContent: any | null
    onSuccess: () => void
}

export function EditInlineContentModal({ isOpen, onClose, documentId, currentContent, onSuccess }: EditInlineContentModalProps) {
    const { fetchWithAuth } = useAuth()

    // Initial content parsing
    const getInitialText = () => {
        if (!currentContent) return ""
        if (typeof currentContent === 'string') return currentContent
        try {
            return JSON.stringify(currentContent, null, 2)
        } catch (e) {
            return String(currentContent)
        }
    }

    const [content, setContent] = useState(getInitialText())
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setContent(getInitialText())
            setError(null)
            setSuccess(false)
        }
    }, [isOpen, currentContent])

    const handleSave = async () => {
        try {
            setSaving(true)
            setError(null)

            // Try to parse as JSON if it looks like an object/array, 
            // otherwise treat as string
            let payloadContent: any = content
            const trimmed = content.trim()
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    payloadContent = JSON.parse(content)
                } catch (e) {
                    // If it looks like JSON but fails, maybe it IS just text that starts with {
                    // Or maybe it's invalid JSON. Let's warn but allow if they really want?
                    // For now, if it fails parsing, we treat as string.
                }
            }

            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/inline`, {
                method: "POST",
                body: JSON.stringify({ contentJson: payloadContent })
            })

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 800)
        } catch (err: any) {
            setError(err.message || "Failed to save content")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Document Content"
            size="xl"
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn-primary flex items-center gap-2"
                        disabled={saving || success}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? "Saving..." : success ? "Saved!" : "Save Content"}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <p>
                        This is an <strong>Inline Document</strong>. You can type your content below.
                        Each time you save, a new version is created. The version will be frozen once submitted for review.
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Content Editor</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full h-[400px] p-4 font-mono text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none shadow-inner"
                        placeholder="Type your document content here..."
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </Modal>
    )
}
