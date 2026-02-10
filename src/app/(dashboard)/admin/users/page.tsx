"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
    Mail,
    User as UserIcon,
    UserPlus,
    Ban,
    CheckCircle,
    Clock,
    XCircle,
} from "lucide-react";

type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

type User = {
    id: number;
    fullName: string;
    email: string;
    status: UserStatus;
    roles: string[];
    createdAt: string;
};

type InviteUserModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
};

type ConfirmModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant?: "danger" | "primary";
};

function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    confirmVariant = "danger",
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-lg shadow-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <h2 className="text-xl font-semibold mb-2">{title}</h2>
                    <p className="text-muted-foreground mb-6">{message}</p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`px-4 py-2 rounded-md transition-colors ${
                                confirmVariant === "danger"
                                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
    const { fetchWithAuth } = useAuth();
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            // Fetch available roles
            fetchWithAuth<{ id: number; name: string }[]>("/api/admin/roles")
                .then(setRoles)
                .catch(() => setError("Failed to load roles"));
        }
    }, [isOpen, fetchWithAuth]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await fetchWithAuth("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    fullName,
                    roleIds: selectedRoles,
                }),
            });

            // Reset form
            setEmail("");
            setFullName("");
            setSelectedRoles([]);
            onSuccess();
            onClose();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to invite user",
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-lg shadow-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <h2 className="text-xl font-semibold mb-4">
                        Invite New User
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="user@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="John Doe"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Roles
                            </label>
                            <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-md p-2">
                                {roles.map((role) => (
                                    <label
                                        key={role.id}
                                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedRoles.includes(
                                                role.id,
                                            )}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedRoles([
                                                        ...selectedRoles,
                                                        role.id,
                                                    ]);
                                                } else {
                                                    setSelectedRoles(
                                                        selectedRoles.filter(
                                                            (id) =>
                                                                id !== role.id,
                                                        ),
                                                    );
                                                }
                                            }}
                                            className="rounded border-border"
                                        />
                                        <span className="text-sm">
                                            {role.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {loading ? "Inviting..." : "Send Invite"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: UserStatus }) {
    const variants = {
        PENDING: {
            icon: Clock,
            className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
            label: "Pending",
        },
        ACTIVE: {
            icon: CheckCircle,
            className: "bg-green-500/10 text-green-500 border-green-500/20",
            label: "Active",
        },
        DISABLED: {
            icon: XCircle,
            className: "bg-red-500/10 text-red-500 border-red-500/20",
            label: "Disabled",
        },
    };

    // Safety check: fallback to PENDING if status is undefined or invalid
    const variant = variants[status] || variants.PENDING;
    const Icon = variant.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variant.className}`}
        >
            <Icon className="h-3 w-3" />
            {variant.label}
        </span>
    );
}

export default function UsersPage() {
    const router = useRouter();
    const { fetchWithAuth } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        userId?: number;
        action?: "deactivate" | "reactivate";
    }>({ isOpen: false });

    const loadUsers = async () => {
        try {
            const data = await fetchWithAuth<User[]>("/api/admin/users");
            setUsers(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load users",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleDeactivate = async (userId: number) => {
        try {
            await fetchWithAuth(`/api/admin/users/${userId}/deactivate`, {
                method: "POST",
            });
            await loadUsers();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to deactivate user",
            );
        }
    };

    const handleReactivate = async (userId: number) => {
        try {
            await fetchWithAuth(`/api/admin/users/${userId}/reactivate`, {
                method: "POST",
            });
            await loadUsers();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to reactivate user",
            );
        }
    };

    if (loading) return <div className="p-6">Loading users...</div>;
    if (error && users.length === 0)
        return <div className="p-6 text-destructive">{error}</div>;

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Users</h1>
                <button
                    onClick={() => setInviteModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <UserPlus className="h-4 w-4" />
                    Invite User
                </button>
            </div>

            {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    {error}
                </div>
            )}

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {users.map((user) => (
                    <Link
                        key={user.id}
                        href={`/admin/users/${user.id}`}
                        className="block bg-card rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <h3 className="font-medium truncate">
                                        {user.email}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                    <UserIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                        {user.fullName}
                                    </span>
                                </div>
                                <StatusBadge status={user.status} />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {user.roles.map((role) => (
                                <span
                                    key={role}
                                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground"
                                >
                                    {role}
                                </span>
                            ))}
                            {user.roles.length === 0 && (
                                <span className="text-muted-foreground italic text-xs">
                                    No Roles
                                </span>
                            )}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {user.status === "ACTIVE" && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setConfirmModal({
                                            isOpen: true,
                                            userId: user.id,
                                            action: "deactivate",
                                        });
                                    }}
                                    className="text-sm text-destructive hover:underline font-medium"
                                >
                                    Deactivate
                                </button>
                            )}
                            {user.status === "DISABLED" && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setConfirmModal({
                                            isOpen: true,
                                            userId: user.id,
                                            action: "reactivate",
                                        });
                                    }}
                                    className="text-sm text-green-500 hover:underline font-medium"
                                >
                                    Reactivate
                                </button>
                            )}
                        </div>
                    </Link>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                        <thead className="[&_tr]:border-b-2 border-background">
                            <tr className="border-b-2 border-background transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Name
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Email
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Status
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    Roles
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {users.map((user) => (
                                <tr
                                    key={user.id}
                                    onClick={() =>
                                        router.push(`/admin/users/${user.id}`)
                                    }
                                    className="border-b-2 border-background transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer"
                                >
                                    <td className="p-4 align-middle font-medium">
                                        {user.fullName || "-"}
                                    </td>
                                    <td className="p-4 align-middle">
                                        {user.email}
                                    </td>
                                    <td className="p-4 align-middle">
                                        <StatusBadge status={user.status} />
                                    </td>
                                    <td className="p-4 align-middle">
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.map((role) => (
                                                <span
                                                    key={role}
                                                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                                >
                                                    {role}
                                                </span>
                                            ))}
                                            {user.roles.length === 0 && (
                                                <span className="text-muted-foreground italic text-xs">
                                                    No Roles
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle text-right">
                                        <div className="flex gap-3 justify-end">
                                            {user.status === "ACTIVE" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmModal({
                                                            isOpen: true,
                                                            userId: user.id,
                                                            action: "deactivate",
                                                        });
                                                    }}
                                                    className="text-destructive hover:underline font-medium"
                                                >
                                                    Deactivate
                                                </button>
                                            )}
                                            {user.status === "DISABLED" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmModal({
                                                            isOpen: true,
                                                            userId: user.id,
                                                            action: "reactivate",
                                                        });
                                                    }}
                                                    className="text-green-500 hover:underline font-medium"
                                                >
                                                    Reactivate
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <InviteUserModal
                isOpen={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                onSuccess={loadUsers}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false })}
                onConfirm={() => {
                    if (
                        confirmModal.userId &&
                        confirmModal.action === "deactivate"
                    ) {
                        handleDeactivate(confirmModal.userId);
                    } else if (
                        confirmModal.userId &&
                        confirmModal.action === "reactivate"
                    ) {
                        handleReactivate(confirmModal.userId);
                    }
                }}
                title={
                    confirmModal.action === "deactivate"
                        ? "Deactivate User"
                        : "Reactivate User"
                }
                message={
                    confirmModal.action === "deactivate"
                        ? "This will immediately revoke all active sessions and prevent the user from logging in. The user's data will be preserved."
                        : "This will allow the user to log in again. The user will need to authenticate with their credentials."
                }
                confirmText={
                    confirmModal.action === "deactivate"
                        ? "Deactivate"
                        : "Reactivate"
                }
                confirmVariant={
                    confirmModal.action === "deactivate" ? "danger" : "primary"
                }
            />
        </div>
    );
}
