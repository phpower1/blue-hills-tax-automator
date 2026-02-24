"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
    { href: "/", label: "Dashboard", icon: "📊" },
    { href: "/upload", label: "Upload", icon: "📤" },
    { href: "/chat", label: "Chat", icon: "💬" },
    { href: "/reports", label: "Reports", icon: "📋" },
];

interface SidebarProps {
    mobileOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile backdrop */}
            {mobileOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={onClose}
                />
            )}

            <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
                {/* Logo */}
                <div style={{ padding: "0 8px", marginBottom: 40 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                flexShrink: 0,
                            }}
                        >
                            🏔️
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "#f1f5f9",
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                Blue Hills
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: "#06b6d4",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                }}
                            >
                                Tax Automator
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    textDecoration: "none",
                                    fontSize: 14,
                                    fontWeight: isActive ? 600 : 400,
                                    color: isActive ? "#06b6d4" : "#94a3b8",
                                    background: isActive ? "rgba(6, 182, 212, 0.08)" : "transparent",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <span style={{ fontSize: 18 }}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile */}
                <div style={{ marginTop: "auto", padding: "0 8px" }}>
                    <UserProfile />
                </div>
            </aside>
        </>
    );
}

import TelegramLinker from "./TelegramLinker";

function UserProfile() {
    const { user, signOut } = useAuth();

    if (!user) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
                style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                {user.photoURL ? (
                    <img
                        src={user.photoURL}
                        alt=""
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            flexShrink: 0,
                        }}
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 600,
                            flexShrink: 0,
                        }}
                    >
                        {user.displayName?.[0] || "U"}
                    </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#f1f5f9",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {user.displayName || "User"}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "#64748b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {user.email}
                    </div>
                </div>
                <button
                    onClick={signOut}
                    style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: 16,
                        padding: 4,
                        flexShrink: 0,
                    }}
                    title="Sign out"
                >
                    ↪
                </button>
            </div>
            <TelegramLinker />
        </div>
    );
}
