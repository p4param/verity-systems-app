// app/trust/page.tsx

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Security & Trust | Varity Systems",
    description:
        "Security, tenant isolation, and compliance practices for the Varity Systems platform.",
}

export default function TrustCenterPage() {
    return (
        <main className="mx-auto max-w-5xl px-6 py-16">
            {/* Header */}
            <section className="mb-12">
                <h1 className="text-4xl font-bold tracking-tight">
                    Security & Trust
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                    This page outlines the security principles, controls, and operational
                    practices that protect customer data on the Varity Systems platform.
                </p>
            </section>

            {/* Downloadable Documents */}
            <section className="mb-14 rounded-lg border bg-muted/30 p-6">
                <h2 className="mb-3 text-xl font-semibold">
                    Security & Compliance Documents
                </h2>

                <p className="mb-4 text-sm text-muted-foreground">
                    The following documents provide additional detail on our security
                    architecture and compliance posture.
                </p>

                <ul className="space-y-3 text-sm">
                    <li>
                        <a
                            href="/trust/DMS_Customer_Trust_Center.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline underline-offset-4 hover:text-primary"
                        >
                            Customer Trust Overview (PDF)
                        </a>
                    </li>

                    <li>
                        <a
                            href="/trust/DMS_SOC2_Type_II_Full_Coverage.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline underline-offset-4 hover:text-primary"
                        >
                            SOC 2 Type II Control Coverage (PDF)
                        </a>
                    </li>

                    <li>
                        <a
                            href="/trust/DMS_Executive_Security_Summary.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline underline-offset-4 hover:text-primary"
                        >
                            Executive Security Summary (PDF)
                        </a>
                    </li>
                </ul>
            </section>

            {/* Security by Design */}
            <Section title="Security by Design">
                <Bullet>
                    Tenant isolation is enforced at the <strong>database layer</strong>,
                    not the UI or API layer.
                </Bullet>
                <Bullet>
                    Authenticated requests always operate within a verified tenant
                    context.
                </Bullet>
                <Bullet>
                    Cross-tenant data access is structurally prevented by design.
                </Bullet>
            </Section>

            {/* Authentication & Sessions */}
            <Section title="Authentication & Session Management">
                <Bullet>
                    Short-lived JWT access tokens with rotating refresh tokens.
                </Bullet>
                <Bullet>
                    Each refresh token represents a single logical session.
                </Bullet>
                <Bullet>
                    Users and administrators can revoke individual sessions or all active
                    sessions.
                </Bullet>
                <Bullet>
                    Revoked sessions cannot be reused or restored.
                </Bullet>
            </Section>

            {/* Tenant Isolation */}
            <Section title="Tenant Isolation Guarantees">
                <Bullet>
                    Tenant isolation is enforced post-authentication at the database
                    access layer.
                </Bullet>
                <Bullet>
                    Pre-authentication access is limited strictly to identity resolution
                    flows (e.g. login, password reset).
                </Bullet>
                <Bullet>
                    Any post-authentication access without tenant scoping is treated as a
                    security defect.
                </Bullet>
            </Section>

            {/* Operational Security */}
            <Section title="Operational Security">
                <Bullet>
                    Security-relevant actions generate immutable audit and alert records.
                </Bullet>
                <Bullet>
                    Administrative access is governed by role-based access control (RBAC).
                </Bullet>
                <Bullet>
                    Sensitive actions such as session revocation and password changes are
                    monitored and logged.
                </Bullet>
            </Section>

            {/* Compliance */}
            <Section title="Compliance & Assurance">
                <Bullet>
                    The Varity Systems security architecture is aligned with SOC 2 Type II trust
                    service criteria.
                </Bullet>
                <Bullet>
                    Controls are designed and operated continuously throughout the
                    reporting period.
                </Bullet>
                <Bullet>
                    Additional audit evidence can be provided under NDA upon request.
                </Bullet>
            </Section>

            {/* Report a Security Issue */}
            <section className="mt-16 rounded-lg border bg-muted/30 p-6">
                <h2 className="text-xl font-semibold">
                    Report a Security Issue
                </h2>

                <p className="mt-3 text-sm text-muted-foreground">
                    We take security reports seriously and appreciate responsible
                    disclosure. If you believe you have identified a security
                    vulnerability, please contact us directly.
                </p>

                <div className="mt-4 space-y-2 text-sm">
                    <p>
                        📧 Email:{" "}
                        <a
                            href="mailto:security@yourcompany.com"
                            className="font-medium underline underline-offset-4 hover:text-primary"
                        >
                            security@yourcompany.com
                        </a>
                    </p>

                    <p className="text-muted-foreground">
                        Please include a detailed description of the issue, steps to
                        reproduce, and any relevant proof-of-concept information.
                    </p>
                </div>
            </section>

            {/* Trust Changelog */}
            <section className="mt-14">
                <h2 className="mb-4 text-xl font-semibold">
                    Trust & Security Changelog
                </h2>

                <ul className="space-y-4 text-sm">
                    <li className="rounded-md border p-4">
                        <p className="font-medium">March 2026</p>
                        <p className="text-muted-foreground">
                            Published Security & Trust Center, including tenant isolation
                            guarantees and SOC 2 Type II–aligned control documentation.
                        </p>
                    </li>

                    <li className="rounded-md border p-4">
                        <p className="font-medium">February 2026</p>
                        <p className="text-muted-foreground">
                            Introduced session management enhancements, including per-session
                            revocation and security alerting.
                        </p>
                    </li>
                </ul>
            </section>

            {/* Footer */}
            <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
            </footer>
        </main>
    )
}

/* ---------- UI helpers ---------- */

function Section({
    title,
    children,
}: {
    title: string
    children: React.ReactNode
}) {
    return (
        <section className="mb-10">
            <h2 className="mb-4 text-2xl font-semibold">{title}</h2>
            <ul className="space-y-2">{children}</ul>
        </section>
    )
}

function Bullet({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground" />
            <span className="text-base text-muted-foreground">{children}</span>
        </li>
    )
}
