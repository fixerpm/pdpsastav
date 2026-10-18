"use client";

import Image from "next/image";
import { BRAND_CONFIG } from "@/config/branding";

export default function NavigationRail({
  activeView, // "chats" | "contacts" | "groups" | "meetings" | "settings"
  onSelectView,
  unreadCount = 0,
  incomingRequestsCount = 0,
  currentUser,
  onOpenNotifications,
  isNotificationOpen,
}) {
  const navItems = [
    {
      id: "chats",
      label: "Chatlar",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      id: "contacts",
      label: "Kontaktlar",
      badge: incomingRequestsCount > 0 ? incomingRequestsCount : null,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      id: "groups",
      label: "Guruhlar",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      id: "meetings",
      label: "Uchrashuv",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Sozlamalar",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-14 sm:w-16 bg-zinc-950/90 border-r border-zinc-800/80 flex flex-col items-center py-3 sm:py-4 justify-between z-30 shrink-0">
      {/* Brand Logo */}
      <div className="flex flex-col items-center gap-3">
        <div
          onClick={() => onSelectView("chats")}
          className="relative group cursor-pointer transition transform hover:scale-105"
          title={BRAND_CONFIG.name}
        >
          <Image
            src={BRAND_CONFIG.avatarUrl}
            alt={BRAND_CONFIG.name}
            width={38}
            height={38}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-500/25"
            priority
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 border border-zinc-950" />
        </div>

        {/* Separator */}
        <div className="w-6 sm:w-8 h-px bg-zinc-800 my-1" />

        {/* Main Nav Items */}
        <nav className="flex flex-col items-center gap-1.5 sm:gap-2">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition cursor-pointer group ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
                title={item.label}
              >
                {item.icon}

                {/* Badge indicator */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-cyan-500 text-zinc-950 text-[9px] font-extrabold rounded-full">
                    {item.badge}
                  </span>
                )}

                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute -left-1 sm:-left-2 top-2 bottom-2 w-1 bg-cyan-400 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Notifications & User Avatar */}
      <div className="flex flex-col items-center gap-2.5 sm:gap-3">
        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
            isNotificationOpen
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
          title="Bildirishnomalar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </button>

        {/* User Avatar */}
        <button
          onClick={() => onSelectView("settings")}
          className="relative group cursor-pointer transition transform hover:scale-105"
          title={`${currentUser?.displayName || "Profil"} sozlamalari`}
        >
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
              currentUser?.avatarBg || "from-cyan-500 to-blue-600"
            } shadow-md ring-2 ring-zinc-800 group-hover:ring-cyan-500/60 transition`}
          >
            {currentUser?.avatarText || currentUser?.username?.slice(0, 2).toUpperCase() || "U"}
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 border border-zinc-950" />
        </button>
      </div>
    </aside>
  );
}
