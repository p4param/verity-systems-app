"use client"

import { ColumnDef } from "@tanstack/react-table"
import {
    ArrowUpDown,
    MoreVertical,
    FileText,
    History,
    FileSpreadsheet,
    FileImage,
    FileVideo,
    FileAudio,
    FileArchive,
    FileCode,
    Presentation,
    File,
    type LucideIcon,
} from "lucide-react"
import { formatRelativeDate } from "@/lib/utils/format-date"
import { StatusBadge } from "@/components/dms/StatusBadge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"

// This type is used to define the shape of our data.
export interface DocumentData {
    id: string
    title: string
    documentNumber: string | null
    type: { id: string, name: string } | null
    expiryDate: string | null
    description?: string
    status: string
    effectiveStatus: string
    updatedAt: string
    currentVersion?: {
        id: string
        fileName: string
        versionNumber: number
    }
}

const EXT_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
    pdf: { icon: FileText, color: "text-red-600" },
    doc: { icon: FileText, color: "text-blue-600" },
    docx: { icon: FileText, color: "text-blue-600" },
    odt: { icon: FileText, color: "text-blue-600" },
    rtf: { icon: FileText, color: "text-blue-500" },
    txt: { icon: FileText, color: "text-slate-500" },
    xls: { icon: FileSpreadsheet, color: "text-green-600" },
    xlsx: { icon: FileSpreadsheet, color: "text-green-600" },
    csv: { icon: FileSpreadsheet, color: "text-green-500" },
    ods: { icon: FileSpreadsheet, color: "text-green-600" },
    ppt: { icon: Presentation, color: "text-orange-600" },
    pptx: { icon: Presentation, color: "text-orange-600" },
    odp: { icon: Presentation, color: "text-orange-600" },
    jpg: { icon: FileImage, color: "text-pink-600" },
    jpeg: { icon: FileImage, color: "text-pink-600" },
    png: { icon: FileImage, color: "text-pink-600" },
    gif: { icon: FileImage, color: "text-pink-600" },
    svg: { icon: FileImage, color: "text-pink-500" },
    bmp: { icon: FileImage, color: "text-pink-600" },
    webp: { icon: FileImage, color: "text-pink-600" },
    tiff: { icon: FileImage, color: "text-pink-600" },
    tif: { icon: FileImage, color: "text-pink-600" },
    mp4: { icon: FileVideo, color: "text-purple-600" },
    avi: { icon: FileVideo, color: "text-purple-600" },
    mov: { icon: FileVideo, color: "text-purple-600" },
    mkv: { icon: FileVideo, color: "text-purple-600" },
    webm: { icon: FileVideo, color: "text-purple-600" },
    mp3: { icon: FileAudio, color: "text-sky-600" },
    wav: { icon: FileAudio, color: "text-sky-600" },
    ogg: { icon: FileAudio, color: "text-sky-600" },
    flac: { icon: FileAudio, color: "text-sky-600" },
    zip: { icon: FileArchive, color: "text-amber-700" },
    rar: { icon: FileArchive, color: "text-amber-700" },
    "7z": { icon: FileArchive, color: "text-amber-700" },
    tar: { icon: FileArchive, color: "text-amber-700" },
    gz: { icon: FileArchive, color: "text-amber-700" },
    html: { icon: FileCode, color: "text-orange-500" },
    css: { icon: FileCode, color: "text-blue-500" },
    js: { icon: FileCode, color: "text-yellow-600" },
    ts: { icon: FileCode, color: "text-blue-600" },
    json: { icon: FileCode, color: "text-slate-600" },
    xml: { icon: FileCode, color: "text-teal-600" },
    dwg: { icon: FileImage, color: "text-fuchsia-600" },
    dxf: { icon: FileImage, color: "text-fuchsia-600" },
}

function getFileIcon(fileName: string | undefined | null): { icon: LucideIcon; color: string } {
    if (!fileName) return { icon: File, color: "text-muted-foreground" }
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (ext && EXT_ICON_MAP[ext]) return EXT_ICON_MAP[ext]
    return { icon: File, color: "text-muted-foreground" }
}

export const columns: ColumnDef<DocumentData>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected()
                        ? true
                        : (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "documentNumber",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Doc No.
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <div className="font-mono text-muted-foreground">{row.getValue("documentNumber") || '-'}</div>,
    },
    {
        accessorKey: "title",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Title
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const doc = row.original
            const { icon: Icon, color } = getFileIcon(doc.currentVersion?.fileName)
            return (
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/5 rounded border transition-colors">
                        <Icon size={18} className={color} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{doc.title}</span>
                        {doc.description && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-md">
                                {doc.description}
                            </span>
                        )}
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const type = row.original.type
            return type?.name ? (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                    {type.name}
                </span>
            ) : (
                <span className="text-muted-foreground text-xs">-</span>
            )
        },
    },
    {
        accessorKey: "status",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            return <StatusBadge status={row.original.effectiveStatus} />
        },
    },
    {
        accessorKey: "version",
        header: "Version",
        cell: ({ row }) => {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <History size={12} />
                    v{row.original.currentVersion?.versionNumber || 0}
                </div>
            )
        },
    },
    {
        accessorKey: "expiryDate",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Expiry
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const date = row.original.expiryDate
            if (!date) return <span className="text-xs text-muted-foreground">-</span>
            const d = new Date(date)
            const isExpired = d.getTime() < Date.now()
            return (
                <span className={`text-xs ${isExpired ? "text-destructive font-medium" : "text-muted-foreground"}`} title={d.toLocaleString()}>
                    {formatRelativeDate(date)}
                </span>
            )
        },
    },
    {
        accessorKey: "updatedAt",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Modified
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const date = row.original.updatedAt
            return <span className="text-xs text-muted-foreground" title={new Date(date).toLocaleString()}>{formatRelativeDate(date)}</span>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const doc = row.original
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(doc.id)}>
                            Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        {/* Add more actions here */}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
