"use client"

import React, { useEffect } from "react"
import { X } from "lucide-react"

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
    noPadding?: boolean
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md', noPadding = false }: ModalProps) {
    const sizeClasses: Record<string, string> = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        '2xl': 'max-w-6xl',
        full: 'max-w-[95vw]',
    }
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        if (isOpen) {
            window.addEventListener("keydown", handleEsc)
            document.body.style.overflow = "hidden"
        }
        return () => {
            window.removeEventListener("keydown", handleEsc)
            document.body.style.overflow = "unset"
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={`w-full ${sizeClasses[size]} bg-card border rounded-lg shadow-lg animate-in zoom-in-95 duration-200 flex flex-col ${size === 'full' ? 'h-[92vh]' : 'max-h-[85vh]'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={`overflow-y-auto flex-1 ${noPadding ? '' : 'p-6'}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/50 rounded-b-lg">
                        {footer}
                    </div>
                )}
            </div>

            {/* Backdrop Overlay (click to close) */}
            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    )
}
