"use client"

import React, { useState, useEffect, useRef } from "react"
import { Loader2, AlertCircle, Save, Info, Lock } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Modal } from "@/components/ui/Modal"
import { TipTapEditor } from "./TipTapEditor"
import { DocumentOutline } from "./DocumentOutline"
import { useDebounce } from "@/hooks/use-debounce"

interface EditStructuredContentModalProps {
    isOpen: boolean
    onClose: () => void
    documentId: string
    currentContent: any | null
    onSuccess: (silent?: boolean) => void
    /** Pass true when document is frozen (submitted for review). Renders read-only. */
    frozen?: boolean
}

export function EditStructuredContentModal({
    isOpen,
    onClose,
    documentId,
    currentContent,
    onSuccess,
    frozen = false,
}: EditStructuredContentModalProps) {
    const { fetchWithAuth } = useAuth()

    const [content, setContent] = useState<any>(currentContent || "")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    // Debounced auto-save (5 seconds after last change)
    const debouncedContent = useDebounce(content, 5000)
    // Track whether auto-save triggered to avoid double-saving
    const autoSaveLock = useRef(false)

    // Only initialize content when the modal opens or document changes. 
    // Do NOT re-sync from currentContent prop while open, as that causes re-renders and scroll jumps 
    // when auto-save triggers a background refresh of the parent document.
    useEffect(() => {
        if (isOpen) {
            setContent(currentContent || "")
            setError(null)
        }
    }, [isOpen, documentId]) // Only re-run when modal opens or document identity changes

    // Auto-save
    useEffect(() => {
        if (!isOpen || frozen) return
        if (debouncedContent && debouncedContent !== currentContent && !autoSaveLock.current) {
            autoSaveLock.current = true
            performSave(debouncedContent).finally(() => {
                autoSaveLock.current = false
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedContent])

    const performSave = async (contentToSave: any) => {
        if (!contentToSave) return
        setSaving(true)
        setError(null)
        try {
            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/structured`, {
                method: "POST",
                body: JSON.stringify({ contentJson: contentToSave }),
            })
            onSuccess(true) // Silent reload to avoid modal unmounting/flicker
            setLastSaved(new Date())
        } catch (err: any) {
            setError(err.message || "Failed to save content")
        } finally {
            setSaving(false)
        }
    }

    const handleSaveAndClose = async () => {
        setSaving(true)
        try {
            // 1. Perform the final save
            await fetchWithAuth(`/api/secure/dms/documents/${documentId}/structured`, {
                method: "POST",
                body: JSON.stringify({ contentJson: content }),
            })

            // 2. Refresh parent data AND wait for it to complete
            // This prevents the DocumentViewer from rendering stale data when the modal closes
            await onSuccess(false) // Trigger final refresh (not silent, to ensure UI is consistent)

            // 3. Only then close
            onClose()
        } catch (err: any) {
            setError(err.message || "Failed to save content")
            setSaving(false)
        }
    }

    const handleContentChange = (newContent: any) => {
        setContent(newContent)
    }

    const editorRef = useRef<any>(null)

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2 text-base">
                    <span>Structured Authoring Studio</span>
                    {frozen && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-md font-normal">
                            <Lock size={10} /> Frozen
                        </span>
                    )}
                </div>
            }
            size="full"
            noPadding
            footer={
                frozen ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                        <Lock size={12} />
                        Document is frozen. Close to return.
                        <button onClick={onClose} className="ml-auto btn-secondary text-xs py-1 px-3">Close</button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between w-full gap-3">
                        <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                            {saving && (
                                <span className="flex items-center gap-1">
                                    <Loader2 size={11} className="animate-spin" /> Auto-saving…
                                </span>
                            )}
                            {!saving && lastSaved && (
                                <span className="text-green-600">✓ Last saved {lastSaved.toLocaleTimeString()}</span>
                            )}
                            {error && (
                                <span className="flex items-center gap-1 text-red-600">
                                    <AlertCircle size={11} /> {error}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAndClose}
                                className="btn-primary flex items-center gap-2 text-sm"
                                disabled={saving}
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {saving ? "Saving…" : "Save & Close"}
                            </button>
                        </div>
                    </div>
                )
            }
        >
            {/* Full-screen body: outline sidebar + editor canvas */}
            <div className="flex h-full overflow-hidden">
                {/* Outline Sidebar */}
                <DocumentOutline
                    contentJson={content}
                    onHeadingClick={(index) => editorRef.current?.scrollToBlock(index)}
                />

                {/* Editor Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {!frozen && (
                        <div className="flex items-start gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 text-blue-700 text-xs shrink-0">
                            <Info size={14} className="shrink-0 mt-0.5" />
                            <p>
                                <strong>Structured Document</strong> — Content is auto-saved every 5 seconds.
                                The version is frozen once submitted for review.
                            </p>
                        </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                        <TipTapEditor
                            ref={editorRef}
                            initialContent={content}
                            onChange={handleContentChange}
                            editable={!frozen}
                            frozen={frozen}
                            placeholder="Start authoring your document…"
                            saving={saving}
                            lastSaved={lastSaved}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    )
}
