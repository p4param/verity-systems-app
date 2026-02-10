"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Settings,
    Users,
    FileText,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    Shield,
    Lock,
    X,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth/auth-context";

const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        name: "Admin",
        icon: Shield,
        permission: "ADMIN_ACCESS",
        children: [
            { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, permission: "USER_VIEW" },
            { name: "Security", href: "/admin/security", icon: Shield, permission: "AUDIT_VIEW" },
            { name: "Users", href: "/admin/users", icon: Users, permission: "USER_VIEW" },
            { name: "Roles", href: "/admin/roles", icon: Shield, permission: "ROLE_VIEW" },
            { name: "Permissions", href: "/admin/permissions", icon: Lock, permission: "PERMISSION_VIEW" },
            { name: "Audit Log", href: "/admin/audit", icon: FileText, permission: "AUDIT_VIEW" },
        ]
    },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Settings", href: "/settings", icon: Settings },
];

function NavItem({ item, collapsed, pathname, expandedMenus, toggleMenu, onNavigate, level = 0 }) {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.name];
    const isActive = item.href ? pathname === item.href : false;
    const isChildActive = hasChildren && item.children.some(child => pathname === child.href);

    if (hasChildren) {
        return (
            <>
                <button
                    onClick={() => toggleMenu(item.name)}
                    className={clsx(
                        "w-full group flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200",
                        isChildActive || isExpanded
                            ? "text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground",
                        collapsed && "justify-center px-2"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <item.icon
                            size={20}
                            className={clsx(
                                "transition-colors",
                                isChildActive ? "text-primary" : "group-hover:text-primary"
                            )}
                        />
                        {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
                    </div>
                    {!collapsed && (
                        <ChevronRight
                            size={16}
                            className={clsx("transition-transform duration-200", isExpanded && "rotate-90")}
                        />
                    )}
                </button>
                {!collapsed && (
                    <div
                        className={clsx(
                            "grid transition-[grid-template-rows] duration-300 ease-in-out",
                            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        )}
                    >
                        <div className="overflow-hidden flex flex-col gap-1 ml-4 border-l border-sidebar-border pl-2 mr-[5px]">
                            {item.children.map((child) => (
                                <NavItem
                                    key={child.name}
                                    item={child}
                                    collapsed={collapsed}
                                    pathname={pathname}
                                    expandedMenus={expandedMenus}
                                    toggleMenu={toggleMenu}
                                    onNavigate={onNavigate}
                                    level={level + 1}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            className={clsx(
                "group flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200",
                isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
            )}
        >
            <item.icon
                size={20}
                className={clsx(
                    "transition-colors",
                    isActive ? "text-primary-foreground" : "group-hover:text-primary"
                )}
            />
            {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
        </Link>
    );
}

export function Sidebar({ mobileOpen, setMobileOpen }) {
    const [collapsed, setCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState({ Admin: true });
    const pathname = usePathname();
    const { user } = useAuth();

    const toggleMenu = (name) => {
        setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const handleMobileNavigate = () => {
        if (setMobileOpen) {
            setMobileOpen(false);
        }
    };

    const getVisibleItems = (items) => {
        return items.reduce((acc, item) => {
            if (item.permission && !user?.permissions?.includes(item.permission)) {
                return acc;
            }

            if (item.children) {
                const visibleChildren = getVisibleItems(item.children);
                if (visibleChildren.length > 0) {
                    acc.push({ ...item, children: visibleChildren });
                }
            } else {
                acc.push(item);
            }
            return acc;
        }, []);
    };

    const visibleNavItems = getVisibleItems(navItems);

    useEffect(() => {
        if (setMobileOpen) {
            setMobileOpen(false);
        }
    }, [pathname, setMobileOpen]);

    const sidebarContent = (
        <>
            <div className={clsx(
                "border-b border-sidebar-border",
                collapsed ? "flex flex-col items-center py-3 px-2 gap-2" : "h-16 flex items-center justify-between px-4"
            )}>
                <div className={clsx(
                    "flex items-center gap-2.5",
                    collapsed ? "justify-center" : "min-w-0"
                )}>
                    <Image
                        src="/logo.png"
                        alt="Varity Systems"
                        width={28}
                        height={28}
                        className="shrink-0 rounded"
                    />
                    {!collapsed && (
                        <span className="text-lg font-bold text-sidebar-foreground truncate tracking-tight">
                            Varity Systems
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors hidden lg:block"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
                {setMobileOpen && (
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors ml-auto lg:hidden"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
                {visibleNavItems.map((item) => (
                    <NavItem
                        key={item.name}
                        item={item}
                        collapsed={collapsed}
                        pathname={pathname}
                        expandedMenus={expandedMenus}
                        toggleMenu={toggleMenu}
                        onNavigate={handleMobileNavigate}
                    />
                ))}
            </nav>

            <div className="p-4 border-t border-sidebar-border">
                <div
                    className={clsx(
                        "flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer",
                        collapsed ? "justify-center" : ""
                    )}
                >
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                        {user?.fullName ? user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "U"}
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium truncate text-sidebar-foreground">{user?.fullName || "User"}</span>
                            <span className="text-xs text-sidebar-foreground/60 truncate">
                                {user?.email}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <>
            <aside
                className={clsx(
                    "hidden lg:flex flex-col h-full z-40 transition-all duration-300",
                    "bg-sidebar border-r border-sidebar-border",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                {sidebarContent}
            </aside>

            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                className={clsx(
                    "fixed top-0 left-0 h-full z-50 lg:hidden transition-transform duration-300 ease-in-out",
                    "bg-sidebar border-r border-sidebar-border shadow-2xl",
                    "w-64 flex flex-col",
                    mobileOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
