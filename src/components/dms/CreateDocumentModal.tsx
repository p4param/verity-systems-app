"use client"

import React, { useState, useEffect } from "react"
import {
    FilePlus,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Calendar,
    Tag,
    Edit3
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Modal } from "@/components/ui/Modal"

interface CreateDocumentModalProps {
    isOpen: boolean
    onClose: () => void
    folderId: string | null
    onSuccess: (docId: string) => void
}

interface DocumentType {
    id: string;
    name: string;
}

export function CreateDocumentModal({ isOpen, onClose, folderId, onSuccess }: CreateDocumentModalProps) {
    const { fetchWithAuth } = useAuth()
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [expiryDate, setExpiryDate] = useState("")
    const [typeId, setTypeId] = useState("")
    const [selectedFolderId, setSelectedFolderId] = useState(folderId || "")
    const [selectedFolderName, setSelectedFolderName] = useState("")
    const [contentMode, setContentMode] = useState<"FILE" | "STRUCTURED">("FILE")

    // Data State
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
    const [folders, setFolders] = useState<{ id: string, name: string }[]>([])
    const [loadingTypes, setLoadingTypes] = useState(false)

    const [creating, setCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadDocumentTypes();
            if (!folderId) {
                loadFolders();
            } else {
                setSelectedFolderId(folderId);
                fetchFolderName(folderId);
            }
        }
    }, [isOpen, folderId]);

    const fetchFolderName = async (id: string) => {
        try {
            const folder = await fetchWithAuth<{ id: string, name: string }>(`/api/secure/dms/folders/${id}`);
            setSelectedFolderName(folder.name);
        } catch (err) {
            console.error("Failed to fetch folder name", err);
        }
    }

    const loadFolders = async () => {
        try {
            const data = await fetchWithAuth<{ id: string, name: string }[]>("/api/secure/dms/folders");
            setFolders(data);
        } catch (err) {
            console.error("Failed to load folders", err);
        }
    }

    const loadDocumentTypes = async () => {
        try {
            setLoadingTypes(true);
            const types = await fetchWithAuth<DocumentType[]>("/api/secure/dms/document-types?active=true");
            setDocumentTypes(types);
        } catch (err) {
            console.error("Failed to load document types", err);
        } finally {
            setLoadingTypes(false);
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return
        if (!selectedFolderId) {
            setError("Please select a folder.");
            return;
        }

        try {
            setCreating(true)
            setError(null)

            const document = await fetchWithAuth("/api/secure/dms/documents", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    description,
                    folderId: selectedFolderId,
                    typeId: typeId || undefined,
                    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                    contentMode
                })
            })

            if (contentMode === "STRUCTURED") {
                // Send a valid empty TipTap JSON doc as the initial version
                const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };
                await fetchWithAuth(`/api/secure/dms/documents/${document.id}/structured`, {
                    method: "POST",
                    body: JSON.stringify({ contentJson: emptyDoc })
                })
            }

            setSuccess(true)
            setTimeout(() => {
                onSuccess(document.id)
                handleClose()
            }, 1000)
        } catch (err: any) {
            setError(err.message || "Failed to create document")
        } finally {
            setCreating(false)
        }
    }

    const handleClose = () => {
        setTitle("")
        setDescription("")
        setExpiryDate("")
        setTypeId("")
        if (!folderId) {
            setSelectedFolderId("") // Only reset if not passed as prop
            setSelectedFolderName("")
        }
        setError(null)
        setSuccess(false)
        onClose()
    }

    const handleFolderSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedFolderId(id);
        const folder = folders.find(f => f.id === id);
        setSelectedFolderName(folder ? folder.name : "");
    }

    const modalTitle = (
        <div className="flex flex-col">
            <span>Create New Document</span>
            {selectedFolderName && (
                <span className="text-sm font-normal text-muted-foreground">
                    (in {selectedFolderName})
                </span>
            )}
        </div>
    )

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={modalTitle}
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                        disabled={creating}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all"
                        disabled={!title.trim() || !selectedFolderId || creating || success}
                    >
                        {creating ? <Loader2 size={16} className="animate-spin" /> : <FilePlus size={16} />}
                        {creating ? "Creating..." : success ? "Created!" : "Create Draft"}
                    </button>
                </div>
            }
        >
            <form onSubmit={handleCreate} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Define the initial metadata for your document. You can choose to upload files or use the integrated editor.
                </p>

                {/* Content Mode Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Document Source Mode</label>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setContentMode("FILE")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${contentMode === "FILE"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-muted bg-background text-muted-foreground hover:border-muted-foreground/50"
                                }`}
                        >
                            <FilePlus size={24} />
                            <div className="text-center">
                                <span className="text-sm font-semibold">File Upload</span>
                                <p className="text-[10px] opacity-80">PDF, Images, DOCX</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setContentMode("STRUCTURED")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${contentMode === "STRUCTURED"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-muted bg-background text-muted-foreground hover:border-muted-foreground/50"
                                }`}
                        >
                            <Edit3 size={24} />
                            <div className="text-center">
                                <span className="text-sm font-semibold">Structured</span>
                                <p className="text-[10px] opacity-80">Author in Editor</p>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                        <label className="text-sm font-medium leading-none">Document Title <span className="text-red-500">*</span></label>
                        <input
                            autoFocus
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Quarterly Financial Report"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            required
                        />
                    </div>

                    {!folderId && (
                        <div className="space-y-2 col-span-2">
                            <label className="text-sm font-medium leading-none flex items-center gap-2">
                                <FolderIcon size={14} />
                                Select Folder <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedFolderId}
                                onChange={handleFolderSelect}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            >
                                <option value="">Select a Folder...</option>
                                {folders.map(folder => (
                                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none flex items-center gap-2">
                            <Tag size={14} />
                            Document Type
                        </label>
                        <select
                            value={typeId}
                            onChange={(e) => setTypeId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Select Type (Optional)</option>
                            {documentTypes.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none flex items-center gap-2">
                            <Calendar size={14} />
                            Expiry Date
                        </label>
                        <input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Description (Optional)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief summary of the document purpose..."
                        rows={3}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md animate-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-md animate-in slide-in-from-top-2">
                        <CheckCircle2 size={16} />
                        <span>Document draft created successfully!</span>
                    </div>
                )}
            </form>
        </Modal>
    )
}

function Plus({ size }: { size: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}

function FolderIcon({ size }: { size: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
    )
}
