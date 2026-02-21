"use client"

import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react'
import { Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Link } from '@tiptap/extension-link'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { FontFamily } from '@tiptap/extension-font-family'
import { Superscript } from '@tiptap/extension-superscript'
import { Subscript } from '@tiptap/extension-subscript'
import { CharacterCount } from '@tiptap/extension-character-count'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import React, { useEffect, useState, useCallback } from 'react'
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
    Code, RemoveFormatting, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, ListChecks,
    Heading1, Heading2, Heading3, Heading4, Quote,
    Undo, Redo, Link as LinkIcon, Unlink, Minus,
    Table as TableIcon, Merge, Split,
    ChevronDown, Type,
} from 'lucide-react'

// ─── Allowed options (governance: no arbitrary injection) ─────────────────────
const ALLOWED_FONTS = [
    { label: 'Default', value: '' },
    { label: 'Serif', value: 'Georgia, serif' },
    { label: 'Sans-Serif', value: 'Arial, sans-serif' },
    { label: 'Mono', value: 'Courier New, monospace' },
    { label: 'Times', value: 'Times New Roman, serif' },
]

const ALLOWED_SIZES = ['10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36']

const TEXT_COLORS = [
    '#111827', '#374151', '#6B7280', '#EF4444', '#F97316', '#EAB308',
    '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#FFFFFF',
]

const HIGHLIGHT_COLORS = [
    '#FEF08A', '#BBF7D0', '#BFDBFE', '#FDE68A', '#FBCFE8', '#DDD6FE',
    '#FCA5A5', '#A5F3FC',
]

const MAX_CHARS = 100_000


// ProseMirror node for page break

const PageBreakNode = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,

    parseHTML() {
        return [{ tag: 'div[data-page-break]' }]
    },

    renderHTML() {
        return ['div', { 'data-page-break': 'true', class: 'page-break' }, 0]
    },

    addCommands(): any {
        return {
            insertPageBreak: () => ({ chain }: any) =>
                chain().insertContent({ type: this.name }).run(),
        }
    },
})

// Custom extension for Font Size
const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        }
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize.replace(/px$/, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontSize) {
                                return {}
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}px`,
                            }
                        },
                    },
                },
            },
        ]
    },
    addCommands(): any {
        return {
            setFontSize: (fontSize: string) => ({ chain }: any) => {
                return chain().setMark('textStyle', { fontSize }).run()
            },
            unsetFontSize: () => ({ chain }: any) => {
                return chain().setMark('textStyle', { fontSize: null }).run()
            },
        }
    },
})

// ─── Link validation helper ────────────────────────────────────────────────────
function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
        return false
    }
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────
type ToolbarTab = 'home' | 'paragraph' | 'insert' | 'table'

function ToolBtn({
    onClick, active = false, disabled = false, title, children
}: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick() }}
            disabled={disabled}
            title={title}
            className={`
                inline-flex items-center justify-center w-7 h-7 rounded text-xs transition-colors
                ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed'
                }
            `}
        >
            {children}
        </button>
    )
}

function Divider() {
    return <div className="w-px h-5 bg-gray-300 mx-1 shrink-0" />
}

// ─── Tab: Home ────────────────────────────────────────────────────────────────
function HomeTab({ editor }: { editor: Editor }) {
    const [showTextColor, setShowTextColor] = useState(false)
    const [showHighlight, setShowHighlight] = useState(false)
    const [fontSize, setFontSize] = useState('14')

    const applyFontSize = (size: string) => {
        setFontSize(size)
        if (size) (editor.chain().focus() as any).setFontSize(size).run()
        else (editor.chain().focus() as any).unsetFontSize().run()
    }

    return (
        <div className="flex flex-wrap items-center gap-0.5">
            {/* Font Family */}
            <select
                className="h-7 text-xs border border-gray-200 rounded px-1 bg-white text-gray-700 mr-1"
                value={editor.getAttributes('textStyle').fontFamily || ''}
                onChange={e => {
                    const v = e.target.value
                    if (v) editor.chain().focus().setFontFamily(v).run()
                    else editor.chain().focus().unsetFontFamily().run()
                }}
                title="Font Family"
            >
                {ALLOWED_FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                ))}
            </select>

            {/* Font Size */}
            <select
                className="h-7 w-14 text-xs border border-gray-200 rounded px-1 bg-white text-gray-700 mr-1"
                value={fontSize}
                onChange={e => applyFontSize(e.target.value)}
                title="Font Size"
            >
                {ALLOWED_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <Divider />

            {/* Bold / Italic / Underline / Strike */}
            <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
                <Bold size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
                <Italic size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
                <UnderlineIcon size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
                <Strikethrough size={13} />
            </ToolBtn>

            <Divider />

            {/* Super / Subscript */}
            <ToolBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript">
                <SuperscriptIcon size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript">
                <SubscriptIcon size={13} />
            </ToolBtn>

            {/* Inline Code */}
            <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline Code">
                <Code size={13} />
            </ToolBtn>

            <Divider />

            {/* Text Color */}
            <div className="relative">
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setShowTextColor(v => !v); setShowHighlight(false) }}
                    title="Text Color"
                    className="h-7 px-1.5 flex items-center gap-0.5 rounded text-xs text-gray-700 hover:bg-gray-200"
                >
                    <Type size={12} />
                    <div className="w-3 h-1 rounded-sm mt-0.5" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#111827' }} />
                    <ChevronDown size={8} />
                </button>
                {showTextColor && (
                    <div className="absolute z-50 top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-xl grid grid-cols-6 gap-1 w-36">
                        {TEXT_COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    editor.chain().focus().setColor(color).run()
                                    setShowTextColor(false)
                                }}
                                className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowTextColor(false) }}
                            className="col-span-6 text-[9px] text-gray-500 hover:text-gray-900 mt-1 text-center"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>

            {/* Highlight */}
            <div className="relative">
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setShowHighlight(v => !v); setShowTextColor(false) }}
                    title="Highlight Color"
                    className="h-7 px-1.5 flex items-center gap-0.5 rounded text-xs text-gray-700 hover:bg-gray-200"
                >
                    <span className="text-[10px] font-bold">A</span>
                    <div className="w-3 h-1 rounded-sm mt-0.5 bg-yellow-300" />
                    <ChevronDown size={8} />
                </button>
                {showHighlight && (
                    <div className="absolute z-50 top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-xl grid grid-cols-4 gap-1 w-28">
                        {HIGHLIGHT_COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    editor.chain().focus().toggleHighlight({ color }).run()
                                    setShowHighlight(false)
                                }}
                                className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setShowHighlight(false) }}
                            className="col-span-4 text-[9px] text-gray-500 hover:text-gray-900 mt-1 text-center"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>

            <Divider />

            {/* Clear Formatting */}
            <ToolBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear Formatting">
                <RemoveFormatting size={13} />
            </ToolBtn>
        </div>
    )
}

// ─── Tab: Paragraph ───────────────────────────────────────────────────────────
function ParagraphTab({ editor }: { editor: Editor }) {
    const getActiveStyle = () => {
        if (editor.isActive('heading', { level: 1 })) return 'h1'
        if (editor.isActive('heading', { level: 2 })) return 'h2'
        if (editor.isActive('heading', { level: 3 })) return 'h3'
        if (editor.isActive('heading', { level: 4 })) return 'h4'
        if (editor.isActive('blockquote')) return 'blockquote'
        return 'p'
    }

    const setStyle = (v: string) => {
        if (v === 'p') editor.chain().focus().setParagraph().run()
        else if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run()
        else if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run()
        else if (v === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run()
        else if (v === 'h4') editor.chain().focus().toggleHeading({ level: 4 }).run()
        else if (v === 'blockquote') editor.chain().focus().toggleBlockquote().run()
    }

    const setLineSpacing = (spacing: string) => {
        editor.chain().focus().setMark('textStyle', { lineHeight: spacing }).run()
    }

    return (
        <div className="flex flex-wrap items-center gap-0.5">
            {/* Paragraph Style */}
            <select
                className="h-7 text-xs border border-gray-200 rounded px-1 bg-white text-gray-700 mr-1 w-28"
                value={getActiveStyle()}
                onChange={e => setStyle(e.target.value)}
                title="Paragraph Style"
            >
                <option value="p">Normal</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="h4">Heading 4</option>
                <option value="blockquote">Blockquote</option>
            </select>

            <Divider />

            {/* Alignment */}
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
                <AlignLeft size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
                <AlignCenter size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
                <AlignRight size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
                <AlignJustify size={13} />
            </ToolBtn>

            <Divider />

            {/* Lists */}
            <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
                <List size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
                <ListOrdered size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task List">
                <ListChecks size={13} />
            </ToolBtn>

            <Divider />

            {/* Indent */}
            <ToolBtn onClick={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')} title="Increase Indent">
                <span className="text-[10px] font-bold">→</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')} title="Decrease Indent">
                <span className="text-[10px] font-bold">←</span>
            </ToolBtn>

            <Divider />

            {/* Line Spacing */}
            <select
                className="h-7 w-14 text-xs border border-gray-200 rounded px-1 bg-white text-gray-700"
                title="Line Spacing"
                onChange={e => setLineSpacing(e.target.value)}
                defaultValue="1.7"
            >
                <option value="1">1.0</option>
                <option value="1.15">1.15</option>
                <option value="1.5">1.5</option>
                <option value="1.7">1.7</option>
                <option value="2">2.0</option>
            </select>
        </div>
    )
}

// ─── Tab: Insert ──────────────────────────────────────────────────────────────
function InsertTab({ editor }: { editor: Editor }) {
    const [showTableDialog, setShowTableDialog] = useState(false)
    const [tableRows, setTableRows] = useState(3)
    const [tableCols, setTableCols] = useState(3)

    const insertLink = () => {
        const url = window.prompt('Enter URL (https://...)')
        if (!url) return
        if (!isSafeUrl(url)) {
            alert('Only https:// and http:// URLs are allowed.')
            return
        }
        editor.chain().focus().setLink({ href: url }).run()
    }

    const insertTable = () => {
        editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run()
        setShowTableDialog(false)
    }

    return (
        <div className="flex flex-wrap items-center gap-0.5">
            {/* Link */}
            <ToolBtn onClick={insertLink} active={editor.isActive('link')} title="Insert Link">
                <LinkIcon size={13} />
            </ToolBtn>
            <ToolBtn
                onClick={() => editor.chain().focus().unsetLink().run()}
                disabled={!editor.isActive('link')}
                title="Remove Link"
            >
                <Unlink size={13} />
            </ToolBtn>

            <Divider />

            {/* Horizontal Rule */}
            <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
                <Minus size={13} />
            </ToolBtn>

            {/* Page Break */}
            <ToolBtn onClick={() => (editor.chain().focus() as any).insertPageBreak().run()} title="Page Break">
                <span className="text-[9px] font-bold leading-none">PG↵</span>
            </ToolBtn>

            <Divider />

            {/* Table Insert */}
            <div className="relative">
                <ToolBtn onClick={() => setShowTableDialog(v => !v)} title="Insert Table">
                    <TableIcon size={13} />
                </ToolBtn>
                {showTableDialog && (
                    <div className="absolute z-50 top-full left-0 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-xl space-y-2 w-48">
                        <p className="text-[11px] font-semibold text-gray-700">Insert Table</p>
                        <div className="flex gap-2 items-center text-xs">
                            <label>Rows</label>
                            <input type="number" min={1} max={20} value={tableRows}
                                onChange={e => setTableRows(+e.target.value)}
                                className="w-12 border rounded px-1 h-6 text-center" />
                        </div>
                        <div className="flex gap-2 items-center text-xs">
                            <label>Cols</label>
                            <input type="number" min={1} max={10} value={tableCols}
                                onChange={e => setTableCols(+e.target.value)}
                                className="w-12 border rounded px-1 h-6 text-center" />
                        </div>
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); insertTable() }}
                            className="w-full bg-blue-600 text-white text-xs rounded py-1 hover:bg-blue-700"
                        >
                            Insert
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Tab: Table ───────────────────────────────────────────────────────────────
function TableTab({ editor }: { editor: Editor }) {
    return (
        <div className="flex flex-wrap items-center gap-0.5">
            <ToolBtn onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above">
                <span className="text-[9px] font-bold">↑Row</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below">
                <span className="text-[9px] font-bold">↓Row</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                <span className="text-[9px] font-bold text-red-600">✕Row</span>
            </ToolBtn>

            <Divider />

            <ToolBtn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Col Left">
                <span className="text-[9px] font-bold">←Col</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Col Right">
                <span className="text-[9px] font-bold">Col→</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                <span className="text-[9px] font-bold text-red-600">✕Col</span>
            </ToolBtn>

            <Divider />

            <ToolBtn onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells">
                <Merge size={13} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell">
                <Split size={13} />
            </ToolBtn>

            <Divider />

            <ToolBtn onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle Header Row">
                <span className="text-[9px] font-bold">H.Row</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeaderColumn().run()} title="Toggle Header Column">
                <span className="text-[9px] font-bold">H.Col</span>
            </ToolBtn>

            <Divider />

            <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                <span className="text-[9px] font-bold text-red-600">✕Tbl</span>
            </ToolBtn>
        </div>
    )
}

// ─── Full Ribbon Toolbar ──────────────────────────────────────────────────────
function RibbonToolbar({ editor, saving, lastSaved }: { editor: Editor; saving: boolean; lastSaved: Date | null }) {
    const [activeTab, setActiveTab] = useState<ToolbarTab>('home')
    const inTable = editor.isActive('table')

    const tabClass = (t: ToolbarTab) =>
        `px-3 py-1 text-xs font-medium border-b-2 transition-colors ${activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
        }`

    return (
        <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
            {/* Tab Row */}
            <div className="flex items-center gap-1 px-2 pt-1 border-b border-gray-100">
                <button type="button" className={tabClass('home')} onClick={() => setActiveTab('home')}>Home</button>
                <button type="button" className={tabClass('paragraph')} onClick={() => setActiveTab('paragraph')}>Paragraph</button>
                <button type="button" className={tabClass('insert')} onClick={() => setActiveTab('insert')}>Insert</button>
                {inTable && (
                    <button type="button" className={tabClass('table')} onClick={() => setActiveTab('table')}>Table</button>
                )}

                {/* Spacer + Undo/Redo + Status */}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run() }}
                        disabled={!editor.can().undo()}
                        title="Undo (Ctrl+Z)"
                        className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    >
                        <Undo size={14} />
                    </button>
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run() }}
                        disabled={!editor.can().redo()}
                        title="Redo (Ctrl+Y)"
                        className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    >
                        <Redo size={14} />
                    </button>
                    {saving && (
                        <span className="text-[10px] text-blue-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Saving…
                        </span>
                    )}
                    {!saving && lastSaved && (
                        <span className="text-[10px] text-green-600">✓ Saved</span>
                    )}
                </div>
            </div>

            {/* Active Tab Content */}
            <div className="px-2 py-1.5 flex items-center gap-0.5 flex-wrap min-h-[36px]">
                {activeTab === 'home' && <HomeTab editor={editor} />}
                {activeTab === 'paragraph' && <ParagraphTab editor={editor} />}
                {activeTab === 'insert' && <InsertTab editor={editor} />}
                {activeTab === 'table' && inTable && <TableTab editor={editor} />}
            </div>
        </div>
    )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export interface TipTapEditorProps {
    initialContent: any
    onChange: (content: any) => void
    editable?: boolean
    frozen?: boolean
    placeholder?: string
    saving?: boolean
    lastSaved?: Date | null
}

export function TipTapEditor({
    initialContent,
    onChange,
    editable = true,
    frozen = false,
    placeholder = 'Start authoring your document…',
    saving = false,
    lastSaved = null,
}: TipTapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
            Underline,
            TextStyle,
            Color,
            FontFamily,
            Highlight.configure({ multicolor: true }),
            Superscript,
            Subscript,
            CharacterCount.configure({ limit: MAX_CHARS }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Link.configure({
                openOnClick: false,
                validate: (href) => isSafeUrl(href),
                HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' },
            }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({
                resizable: true,
                HTMLAttributes: { class: 'border-collapse w-full my-4' },
            }),
            TableRow,
            TableHeader.configure({
                HTMLAttributes: { class: 'border border-gray-300 bg-gray-50 px-3 py-2 text-left font-semibold text-sm' },
            }),
            TableCell.configure({
                HTMLAttributes: { class: 'border border-gray-300 px-3 py-2 text-sm' },
            }),
            Placeholder.configure({ placeholder }),
            PageBreakNode,
            FontSize,
        ],
        content: initialContent,
        editable,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getJSON())
        },
    })

    // Sync content when initialContent changes externally
    useEffect(() => {
        if (!editor || !initialContent) return

        // Case 1: Editor is empty (standard initialization)
        if (editor.isEmpty) {
            editor.commands.setContent(initialContent)
            return
        }

        // Case 2: Editor is in read-only mode (Viewer mode)
        // We sync if the incoming content is different to ensure the viewer refreshes after a save.
        if (!editable) {
            const currentJson = JSON.stringify(editor.getJSON())
            const nextJson = JSON.stringify(initialContent)

            if (currentJson !== nextJson) {
                // preserveScroll: true is not a standard TipTap option but we use setContent
                // which usually resets scroll. However, for a read-only viewer, 
                // this is the desired behavior to show the fresh data.
                editor.commands.setContent(initialContent)
            }
        }
    }, [editor, initialContent, editable])

    // Sync editable flag
    useEffect(() => {
        if (editor) editor.setEditable(editable)
    }, [editor, editable])

    const wordCount = editor?.storage.characterCount?.words() ?? 0
    const charCount = editor?.storage.characterCount?.characters() ?? 0

    return (
        <div className={`flex flex-col border rounded-md overflow-hidden bg-white shadow-sm h-full ${!editable ? 'opacity-95' : ''}`}>
            {/* Frozen Banner — only shown when version is explicitly frozen */}
            {frozen && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-medium">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current shrink-0"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 5h2v5H7zm0 6h2v2H7z" /></svg>
                    This version is frozen. Content is read-only.
                </div>
            )}

            {/* Ribbon Toolbar */}
            {editable && editor && (
                <RibbonToolbar editor={editor} saving={saving} lastSaved={lastSaved} />
            )}

            {/* Editor Canvas */}
            <div className="flex-1 overflow-auto custom-editor">
                <EditorContent editor={editor} />
            </div>

            {/* Status Bar */}
            <div className="px-3 py-1 border-t bg-gray-50 flex items-center justify-between text-[10px] text-gray-400">
                <span>{wordCount.toLocaleString()} words · {charCount.toLocaleString()} characters</span>
                {charCount >= MAX_CHARS * 0.9 && (
                    <span className="text-orange-500 font-medium">{MAX_CHARS - charCount} chars remaining</span>
                )}
            </div>

            <style jsx global>{`
                .custom-editor .tiptap {
                    min-height: 440px;
                    outline: none;
                    color: #111827;
                    background-color: #ffffff;
                    font-size: 13px;
                    line-height: 1.7;
                    padding: 20px 28px;
                    font-family: Arial, sans-serif;
                }
                .custom-editor .tiptap > * + * { margin-top: 0.5em; }
                .custom-editor .tiptap h1 { font-size: 2em; font-weight: 700; margin: 1.2em 0 0.4em; color: #111827; line-height: 1.2; }
                .custom-editor .tiptap h2 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.4em; color: #1e293b; line-height: 1.3; }
                .custom-editor .tiptap h3 { font-size: 1.25em; font-weight: 600; margin: 0.9em 0 0.35em; color: #1e293b; }
                .custom-editor .tiptap h4 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; color: #374151; }
                .custom-editor .tiptap p { margin: 0.3em 0; color: #111827; }
                .custom-editor .tiptap ul { list-style-type: disc; padding-left: 1.5rem; }
                .custom-editor .tiptap ol { list-style-type: decimal; padding-left: 1.5rem; }
                .custom-editor .tiptap ul li, .custom-editor .tiptap ol li { margin: 0.2em 0; color: #111827; }
                .custom-editor .tiptap ul[data-type="taskList"] { list-style: none; padding-left: 0; }
                .custom-editor .tiptap ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
                .custom-editor .tiptap ul[data-type="taskList"] li > label { margin-top: 2px; }
                .custom-editor .tiptap blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; margin: 0.7em 0; color: #4b5563; font-style: italic; }
                .custom-editor .tiptap hr { border: none; border-top: 2px solid #e5e7eb; margin: 1.5em 0; }
                .custom-editor .tiptap code { background: #f3f4f6; color: #dc2626; padding: 0.15em 0.35em; border-radius: 3px; font-size: 0.875em; font-family: 'Courier New', monospace; }
                .custom-editor .tiptap pre { background: #1e293b; color: #f8fafc; padding: 1em; border-radius: 6px; overflow-x: auto; font-size: 0.875em; }
                .custom-editor .tiptap a { color: #2563eb; text-decoration: underline; }
                .custom-editor .tiptap table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                .custom-editor .tiptap td, .custom-editor .tiptap th { border: 1px solid #d1d5db; padding: 6px 10px; vertical-align: top; min-width: 60px; }
                .custom-editor .tiptap th { background: #f9fafb; font-weight: 600; }
                .custom-editor .tiptap .selectedCell:after { background: rgba(59,130,246,0.12); content: ""; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; position: absolute; z-index: 2; }
                .custom-editor .tiptap td { position: relative; }
                .custom-editor .tiptap .page-break { display: block; border-bottom: 2px dashed #94a3b8; margin: 2em 0; position: relative; }
                .custom-editor .tiptap .page-break::after { content: "— Page Break —"; position: absolute; left: 50%; transform: translateX(-50%); top: -9px; background: white; padding: 0 8px; color: #94a3b8; font-size: 10px; font-family: sans-serif; white-space: nowrap; }
                .custom-editor .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: #9ca3af; pointer-events: none; height: 0; }
                @media print { .page-break { page-break-before: always !important; } }
            `}</style>
        </div>
    )
}
