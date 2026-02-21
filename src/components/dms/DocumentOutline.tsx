"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'

interface HeadingItem {
    level: number
    text: string
    index: number
}

interface DocumentOutlineProps {
    contentJson: any
    onHeadingClick?: (index: number) => void
}

function extractHeadings(json: any): HeadingItem[] {
    if (!json || !json.content) return []
    const headings: HeadingItem[] = []
    let blockIndex = 0

    for (const node of json.content) {
        if (node.type === 'heading') {
            const text = node.content
                ?.map((c: any) => c.text || '')
                .join('') || '(Untitled)'
            headings.push({ level: node.attrs?.level ?? 1, text, index: blockIndex })
        }
        blockIndex++
    }
    return headings
}

export function DocumentOutline({ contentJson, onHeadingClick }: DocumentOutlineProps) {
    const [collapsed, setCollapsed] = useState(false)
    const headings = extractHeadings(contentJson)

    if (headings.length === 0) {
        return (
            <div className="w-48 shrink-0 border-r bg-gray-50 p-3 text-xs text-gray-400 italic select-none">
                No headings yet
            </div>
        )
    }

    const indentClass: Record<number, string> = {
        1: 'pl-2 font-semibold text-gray-800',
        2: 'pl-5 text-gray-700',
        3: 'pl-8 text-gray-600',
        4: 'pl-10 text-gray-500',
    }

    return (
        <div className={`shrink-0 border-r bg-gray-50 flex flex-col transition-all ${collapsed ? 'w-8' : 'w-52'}`}>
            {/* Header */}
            <div
                className="flex items-center gap-1 px-2 py-2 border-b bg-gray-100 cursor-pointer select-none"
                onClick={() => setCollapsed(v => !v)}
                title={collapsed ? 'Show Outline' : 'Collapse Outline'}
            >
                {collapsed ? (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                ) : (
                    <>
                        <ListTree size={13} className="text-gray-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Outline</span>
                        <ChevronDown size={12} className="ml-auto text-gray-400" />
                    </>
                )}
            </div>

            {!collapsed && (
                <div className="flex-1 overflow-y-auto py-2">
                    {headings.map((h, i) => (
                        <button
                            key={i}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault()
                                onHeadingClick?.(h.index)
                            }}
                            className={`
                                w-full text-left px-2 py-1 text-[11px] leading-tight rounded
                                hover:bg-blue-50 hover:text-blue-700 transition-colors truncate
                                ${indentClass[h.level] ?? 'pl-2 text-gray-700'}
                            `}
                            title={h.text}
                        >
                            {h.text}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
