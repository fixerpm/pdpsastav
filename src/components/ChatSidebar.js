"use client";

import { useState } from "react";
import Image from "next/image";
import { BRAND_CONFIG } from "@/config/branding";

export default function ChatSidebar({
  users = [],
  groupSettings = { title: BRAND_CONFIG.defaultGroupTitle },
  activeChat = "public",
  onSelectChat,
  onStartCall,
  onOpenEditNickname,
  onOpenEditGroupTitle,
  onArchiveChat,
  onClearHistory,
  onDeleteChat,
  isOpen,
  onClose,
  unreadCounts = {},
  currentUserId,
  groups = [],
  onOpenCreateGroup,
  mobileView = "list",
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all" | "archived"
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);

  // Foydalanuvchilarni filtrlash
  const filteredUsers = users.filter((u) => {
    if (u.id === currentUserId) return false;

    // Arxiv filtri
    if (activeTab === "archived" && !u.isArchived) return false;
    if (activeTab === "all" && u.isArchived) return false;

    // Yashirilgan chatlar (agar qidirilmayotgan bo'lsa)
    if (u.isHidden && !search.trim()) return false;

    if (!search.trim()) return true;
    return (
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.originalDisplayName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const archivedCount = users.filter((u) => u.id !== currentUserId && u.isArchived).length;
  const onlineCount = users.filter((u) => u.isOnline && u.id !== currentUserId).length;

  return (
    <>
      <aside
        className={`${
          mobileView === "chat" ? "hidden lg:flex" : "flex w-full"
        } lg:w-80 lg:static top-0 bottom-0 left-0 z-20 bg-zinc-950 lg:bg-zinc-950/70 border-r-0 lg:border-r border-zinc-800/80 flex-col h-full overflow-hidden backdrop-blur-xl shrink-0`}
      >
        {/* Sidebar Header with PDP SASTAV Brand Avatar */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <Image
                src={BRAND_CONFIG.avatarUrl}
                alt={BRAND_CONFIG.name}
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-500/25"
                priority
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-zinc-950 shadow-sm" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-white tracking-wider">
                  {BRAND_CONFIG.brandPrefix}
                </span>
                <span className="text-sm font-extrabold text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] tracking-wider">
                  {BRAND_CONFIG.brandSuffix}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>{onlineCount} onlayn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Qidiruv */}
        <div className="p-3 border-b border-zinc-800/50">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Foydalanuvchilarni qidirish..."
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-500/30 rounded-xl pl-9 pr-7 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition shadow-inner"
            />
            <svg
              className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tablar: Barcha suhbatlar vs Arxiv */}
        <div className="flex border-b border-zinc-800/60 px-3 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-2 px-2 transition border-b-2 cursor-pointer ${
              activeTab === "all"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-300"
            }`}
          >
            Barchasi
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={`pb-2 px-2 transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "archived"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-300"
            }`}
          >
            <span>Arxiv</span>
            {archivedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300 font-bold">
                {archivedCount}
              </span>
            )}
          </button>
        </div>

        {/* Ro'yxat */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 pb-20 lg:pb-3">
          {/* Umumiy guruh chati (faqat "Barchasi" tabida) */}
          {activeTab === "all" && (
            <div
              className={`group flex items-center justify-between p-2 rounded-xl transition ${
                activeChat === "public"
                  ? "bg-cyan-500/15 border border-cyan-500/40 text-white shadow-sm shadow-cyan-950/50"
                  : "hover:bg-zinc-900/80 text-zinc-300"
              }`}
            >
              <button
                onClick={() => {
                  onSelectChat("public");
                  onClose?.();
                }}
                className="flex-1 flex items-center gap-3 min-w-0 text-left cursor-pointer"
              >
                <div className="relative shrink-0">
                  <Image
                    src={BRAND_CONFIG.avatarUrl}
                    alt={BRAND_CONFIG.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-cyan-500/60 shadow-md shadow-cyan-500/20"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-zinc-950" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100 truncate flex items-center gap-1">
                      {groupSettings?.title || BRAND_CONFIG.defaultGroupTitle}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                      Barchaga
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {BRAND_CONFIG.supportText}
                  </p>
                </div>
              </button>

              {/* Guruh nomini tahrirlash tugmasi */}
              <button
                type="button"
                onClick={() => onOpenEditGroupTitle?.()}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 transition cursor-pointer"
                title="Guruh nomini tahrirlash"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {/* Guruhlar ro'yxati */}
          {activeTab === "all" && groups.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                <span>Guruhlar ({groups.length})</span>
                {onOpenCreateGroup && (
                  <button
                    onClick={onOpenCreateGroup}
                    className="text-cyan-400 hover:text-cyan-300 font-bold lowercase text-[10px] cursor-pointer"
                  >
                    + yangi
                  </button>
                )}
              </div>
              {groups.map((group) => {
                const isGroupActive =
                  activeChat?.type === "group" &&
                  (activeChat?.id === group.groupId || activeChat?.groupId === group.groupId);
                return (
                  <div
                    key={group.groupId}
                    className={`group flex items-center justify-between p-2 rounded-xl transition ${
                      isGroupActive
                        ? "bg-zinc-900 border border-cyan-500/40 text-white shadow-sm"
                        : "hover:bg-zinc-900/60 text-zinc-300"
                    }`}
                  >
                    <button
                      onClick={() => {
                        onSelectChat({
                          type: "group",
                          id: group.groupId,
                          groupId: group.groupId,
                          displayName: group.name,
                          avatarBg: group.avatarBg,
                          memberCount: group.memberIds?.length || 1,
                        });
                        onClose?.();
                      }}
                      className="flex-1 flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
                          group.avatarBg || "from-cyan-500 to-blue-600"
                        } shadow-sm shrink-0`}
                      >
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold truncate text-zinc-100 block">
                          {group.name}
                        </span>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {group.memberIds?.length || 1} a‘zo • Kod: {group.inviteCode}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 pb-1 px-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            {activeTab === "archived" ? "Arxivlangan suhbatlar" : "Foydalanuvchilar"}
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-6 px-4 text-xs text-zinc-500">
              {activeTab === "archived"
                ? "Arxivlangan suhbatlar yo‘q"
                : "Hozircha foydalanuvchilar topilmadi"}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isActive = activeChat !== "public" && activeChat?.id === user.id;
              const unread = unreadCounts[user.id] || 0;
              const isMenuOpen = activeMenuUserId === user.id;

              return (
                <div
                  key={user.id}
                  className={`group relative flex items-center justify-between p-2 rounded-xl transition ${
                    isActive
                      ? "bg-zinc-900 border border-cyan-500/30 text-white shadow-sm"
                      : "hover:bg-zinc-900/60 text-zinc-300"
                  }`}
                >
                  {/* Chatni tanlash tugmasi */}
                  <button
                    onClick={() => {
                      onSelectChat(user);
                      onClose?.();
                    }}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`w-9 h-9 rounded-full bg-gradient-to-tr ${
                          user.avatarBg || "from-blue-500 to-indigo-600"
                        } flex items-center justify-center text-xs font-bold text-white shadow-sm`}
                      >
                        {user.avatarText || user.displayName?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                          user.isOnline ? "bg-emerald-400" : "bg-zinc-600"
                        }`}
                        title={user.isOnline ? "Onlayn" : "Oflayn"}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate text-zinc-100">
                          {user.displayName}
                        </span>
                        {unread > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-400 text-zinc-950 shadow-sm">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                        {user.lastMessage ? (
                          <span>
                            {user.lastMessage.isMe ? "Siz: " : ""}
                            {user.lastMessage.type === "voice"
                              ? "🎙️ Ovozli xabar"
                              : user.lastMessage.type === "video"
                              ? "📹 Videoxabar"
                              : user.lastMessage.type === "sticker"
                              ? "Stiker"
                              : user.lastMessage.body}
                          </span>
                        ) : user.isOnline ? (
                          <span className="text-emerald-400/90 font-medium">Onlayn</span>
                        ) : (
                          "Oflayn"
                        )}
                      </p>
                    </div>
                  </button>

                  {/* Amallar: Qo'ng'iroq va Chat menyusi */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 ml-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartCall(user, "video");
                      }}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 transition cursor-pointer"
                      title="Video qo'ng'iroq"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    {/* Chat amallari nuqtalari */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuUserId(isMenuOpen ? null : user.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                        title="Chat amallari"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuUserId(null);
                            }}
                          />
                          <div className="absolute right-0 top-7 z-50 w-44 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1 text-xs text-zinc-300">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuUserId(null);
                                onOpenEditNickname?.(user);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
                            >
                              <span>✏️</span> Taxallus berish
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuUserId(null);
                                onArchiveChat?.(user.id, !user.isArchived);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
                            >
                              <span>{user.isArchived ? "📤" : "📦"}</span>
                              {user.isArchived ? "Arxivdan chiqarish" : "Arxivlash"}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuUserId(null);
                                onClearHistory?.(user);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 hover:text-amber-400 flex items-center gap-2 cursor-pointer"
                            >
                              <span>🧹</span> Tarixni tozalash
                            </button>

                            <div className="my-1 border-t border-zinc-800" />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuUserId(null);
                                onDeleteChat?.(user);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 cursor-pointer"
                            >
                              <span>🗑️</span> Chatni o‘chirish
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
