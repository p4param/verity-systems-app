import Link from "next/link"

export function TrustBadge() {
    return (
        <Link
            href="/trust"
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-muted"
        >
            🛡 Security & Trust
        </Link>
    )
}
