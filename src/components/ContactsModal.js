"use client";

import { useState } from "react";
import {
  parseErrorMessage,
  normalizeUsername,
  validateUsername,
  determineContactStatus,
} from "@/lib/error-parser";

export default function ContactsModal({
  isOpen,
  onClose,
  currentUser,
  contacts = [],
  contactRequests = { incoming: [], outgoing: [] },
  onSendRequest,
  onRespondRequest,
  onSetNickname,
  onToggleBlock,
  onRemoveContact,
  onSelectChatWithUser,
  convexSearchUsers,
}) {
  const [activeTab, setActiveTab] = useState("contacts"); // "contacts" | "requests" | "find"
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [requestTargetUsername, setRequestTargetUsername] = useState("");
  const [isDirectSending, setIsDirectSending] = useState(false);
  const [sendingUserIds, setSendingUserIds] = useState({});
  const [feedback, setFeedback] = useState({ message: "", isError: false });
  const [editingNicknameUser, setEditingNicknameUser] = useState(null);
  const [newNickname, setNewNickname] = useState("");

  if (!isOpen) return null;

  const showFeedback = (msg, isError = false) => {
    const cleanMsg = parseErrorMessage(msg);
    setFeedback({ message: cleanMsg, isError });
    setTimeout(() => setFeedback({ message: "", isError: false }), 4500);
  };

  const handleSearchUsers = async (e) => {
    if (e) e.preventDefault();
    const clean = normalizeUsername(searchQuery);
    if (!clean) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchError("");
    try {
      if (convexSearchUsers) {
        const results = await convexSearchUsers({
          searchQuery: clean,
          viewerId: currentUser?.id,
        });
        setSearchResults(results || []);
      }
    } catch (err) {
      const parsed = parseErrorMessage(err, "Qidiruvda xatolik yuz berdi");
      setSearchError(parsed);
      showFeedback(parsed, true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendDirectRequest = async (e) => {
    if (e) e.preventDefault();
    const validation = validateUsername(requestTargetUsername);
    if (!validation.isValid) {
      showFeedback(validation.error, true);
      return;
    }

    const cleanUsername = validation.clean;
    if (currentUser?.username && currentUser.username.toLowerCase() === cleanUsername) {
      showFeedback("O‘zingizga kontakt so‘rovi yubora olmaysiz", true);
      return;
    }

    const alreadyContact = contacts.some(
      (c) => c.username && c.username.toLowerCase() === cleanUsername
    );
    if (alreadyContact) {
      showFeedback(`@${cleanUsername} allaqachon kontaktingizda mavjud`, true);
      return;
    }

    const alreadyRequested = contactRequests?.outgoing?.some(
      (r) => r.user?.username && r.user.username.toLowerCase() === cleanUsername
    );
    if (alreadyRequested) {
      showFeedback("So‘rov allaqachon yuborilgan", true);
      return;
    }

    setIsDirectSending(true);
    try {
      const res = await onSendRequest(cleanUsername);
      if (res && res.success === false) {
        showFeedback(res.message || "So‘rov yuborishda xatolik", true);
        return;
      }
      showFeedback(
        res?.message || `@${cleanUsername} ga kontakt so‘rovi muvaffaqiyatli yuborildi!`
      );
      setRequestTargetUsername("");
    } catch (err) {
      showFeedback(err, true);
    } finally {
      setIsDirectSending(false);
    }
  };

  const handleSendRequestToUser = async (user) => {
    if (!user || sendingUserIds[user.id]) return;

    setSendingUserIds((prev) => ({ ...prev, [user.id]: true }));
    try {
      const res = await onSendRequest(user.username, user.id);
      if (res && res.success === false) {
        showFeedback(res.message, true);
        return;
      }
      showFeedback(res?.message || `@${user.username} ga so‘rov yuborildi`);
      // Update local search results state immediately
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, contactStatus: "pending_sent" }
            : item
        )
      );
    } catch (err) {
      showFeedback(err, true);
    } finally {
      setSendingUserIds((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleSaveNickname = async () => {
    if (!editingNicknameUser) return;
    try {
      await onSetNickname(editingNicknameUser.userId, newNickname);
      showFeedback("Taxallus muvaffaqiyatli yangilandi");
      setEditingNicknameUser(null);
      setNewNickname("");
    } catch (err) {
      showFeedback(err, true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👥</span>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">Kontaktlar</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">Foydalanuvchilarni topish va shaxsiy kontaktlar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50 px-3 pt-2 gap-2 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`pb-2.5 px-3 transition border-b-2 cursor-pointer ${
              activeTab === "contacts"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Kontaktlarim ({contacts.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`pb-2.5 px-3 transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "requests"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>So‘rovlar</span>
            {contactRequests?.incoming?.length > 0 && (
              <span className="px-1.5 py-0.2 bg-cyan-500 text-zinc-950 text-[10px] font-extrabold rounded-full">
                {contactRequests.incoming.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("find")}
            className={`pb-2.5 px-3 transition border-b-2 cursor-pointer ${
              activeTab === "find"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🔍 Odam qidirish
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback.message && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between ${
              feedback.isError
                ? "bg-rose-500/15 text-rose-300 border-b border-rose-500/25"
                : "bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/25"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{feedback.isError ? "⚠️" : "✓"}</span>
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback({ message: "", isError: false })}
              className="text-zinc-400 hover:text-white cursor-pointer ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: Contacts List */}
          {activeTab === "contacts" && (
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  <p className="text-2xl mb-2">📭</p>
                  <p>Hozircha kontaktlaringiz mavjud emas.</p>
                  <button
                    onClick={() => setActiveTab("find")}
                    className="mt-3 px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl font-bold cursor-pointer transition"
                  >
                    Foydalanuvchilarni qidirish
                  </button>
                </div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.userId}
                    className="p-3 bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-3 transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
                            contact.avatarBg || "from-cyan-500 to-blue-600"
                          } shadow-sm`}
                        >
                          {contact.avatarText || contact.username.slice(0, 2).toUpperCase()}
                        </div>
                        {contact.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-zinc-950" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            {contact.displayName}
                          </span>
                          {contact.customNickname && (
                            <span className="text-[10px] text-zinc-500 truncate">
                              ({contact.realDisplayName})
                            </span>
                          )}
                          {contact.isBlocked && (
                            <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 text-[9px] rounded font-semibold">
                              Bloklangan
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">@{contact.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          onSelectChatWithUser(contact);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 text-xs font-bold rounded-lg border border-cyan-500/30 transition cursor-pointer"
                        title="Chat ochish"
                      >
                        💬 Chat
                      </button>

                      <button
                        onClick={() => {
                          setEditingNicknameUser(contact);
                          setNewNickname(contact.customNickname || contact.realDisplayName);
                        }}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition cursor-pointer"
                        title="Taxallus belgilash"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => onToggleBlock(contact.userId, !contact.isBlocked)}
                        className={`p-1.5 hover:bg-zinc-800 rounded-lg text-xs transition cursor-pointer ${
                          contact.isBlocked ? "text-emerald-400" : "text-zinc-400 hover:text-rose-400"
                        }`}
                        title={contact.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                      >
                        🚫
                      </button>

                      <button
                        onClick={() => onRemoveContact(contact.userId)}
                        className="p-1.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg text-xs transition cursor-pointer"
                        title="Kontaktni o'chirish"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Requests */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Kiruvchi so‘rovlar ({contactRequests?.incoming?.length || 0})
                </h4>
                {contactRequests?.incoming?.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3">Kiruvchi so‘rovlar yo‘q</p>
                ) : (
                  <div className="space-y-2">
                    {contactRequests.incoming.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
                              req.user.avatarBg || "from-cyan-500 to-blue-600"
                            }`}
                          >
                            {req.user.avatarText || req.user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{req.user.displayName}</p>
                            <p className="text-[11px] text-zinc-400 truncate">@{req.user.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onRespondRequest(req.id, "accept")}
                            className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                          >
                            Qabul qilish
                          </button>
                          <button
                            onClick={() => onRespondRequest(req.id, "reject")}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition cursor-pointer"
                          >
                            Rad etish
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Yuborilgan so‘rovlar ({contactRequests?.outgoing?.length || 0})
                </h4>
                {contactRequests?.outgoing?.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3">Yuborilgan so‘rovlar yo‘q</p>
                ) : (
                  <div className="space-y-2">
                    {contactRequests.outgoing.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
                              req.user.avatarBg || "from-cyan-500 to-blue-600"
                            }`}
                          >
                            {req.user.avatarText || req.user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-200 truncate">{req.user.displayName}</p>
                            <p className="text-[11px] text-zinc-500 truncate">@{req.user.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-300/80 bg-amber-500/10 px-2 py-0.5 rounded font-medium">
                            Kutilmoqda
                          </span>
                          <button
                            onClick={() => onRespondRequest(req.id, "cancel")}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                          >
                            Bekor qilish
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Find Users */}
          {activeTab === "find" && (
            <div className="space-y-4">
              {/* Direct Username Request input */}
              <form onSubmit={handleSendDirectRequest} className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                <label className="block text-[11px] font-bold text-zinc-300">
                  To‘g‘ridan-to‘g‘ri @username orqali so‘rov yuborish
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-xs text-cyan-400 font-bold">@</span>
                    <input
                      type="text"
                      value={requestTargetUsername}
                      onChange={(e) => setRequestTargetUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, ""))}
                      placeholder="foydalanuvchi_nomi"
                      disabled={isDirectSending}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-400 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!requestTargetUsername.trim() || isDirectSending}
                    className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                  >
                    {isDirectSending ? "Yuborilmoqda..." : "So‘rov yuborish"}
                  </button>
                </div>
              </form>

              {/* Search input with live results */}
              <div>
                <form onSubmit={handleSearchUsers} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ism yoki @username bo‘yicha qidirish..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    {isSearching ? "Qidirilmoqda..." : "Qidirish"}
                  </button>
                </form>

                {/* Search Error State */}
                {searchError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center justify-between mb-3">
                    <span>⚠️ {searchError}</span>
                    <button
                      onClick={handleSearchUsers}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                    >
                      Qayta urinish
                    </button>
                  </div>
                )}

                {/* Loading State */}
                {isSearching && (
                  <div className="text-center py-8 text-zinc-400 text-xs flex flex-col items-center gap-2">
                    <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>Foydalanuvchilar qidirilmoqda...</span>
                  </div>
                )}

                {/* Empty Results State */}
                {!isSearching && hasSearched && searchResults.length === 0 && !searchError && (
                  <div className="text-center py-8 text-zinc-500 text-xs space-y-1">
                    <p className="text-2xl">🔍</p>
                    <p className="font-semibold text-zinc-400">Hech kim topilmadi</p>
                    <p className="text-[11px]">Username yoki ism to‘g‘ri kiritilganini tekshirib ko‘ring.</p>
                  </div>
                )}

                {/* Results List */}
                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-zinc-400">
                      Natijalar ({searchResults.length}):
                    </p>
                    {searchResults.map((u) => {
                      const computedStatus =
                        u.contactStatus ||
                        determineContactStatus({
                          currentUserId: currentUser?.id,
                          targetUserId: u.id,
                          contacts,
                          contactRequests,
                        });

                      const isSending = Boolean(sendingUserIds[u.id]);

                      return (
                        <div
                          key={u.id}
                          className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
                                u.avatarBg || "from-cyan-500 to-blue-600"
                              } shrink-0`}
                            >
                              {u.avatarText || u.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{u.displayName}</p>
                              <p className="text-[11px] text-zinc-400 truncate">@{u.username}</p>
                              {u.bio && <p className="text-[10px] text-zinc-500 truncate mt-0.5">{u.bio}</p>}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {computedStatus === "self" ? (
                              <span className="text-[11px] text-zinc-400 font-semibold px-2.5 py-1 bg-zinc-800/80 rounded-lg">
                                Siz
                              </span>
                            ) : computedStatus === "accepted" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 rounded-lg">
                                  ✓ Kontaktingizda
                                </span>
                                <button
                                  onClick={() => {
                                    onSelectChatWithUser(u);
                                    onClose();
                                  }}
                                  className="px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 text-xs font-bold rounded-lg border border-cyan-500/30 transition cursor-pointer"
                                >
                                  💬 Chat
                                </button>
                              </div>
                            ) : computedStatus === "pending_sent" ? (
                              <span className="text-[11px] text-amber-300 font-semibold px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                ⏳ So‘rov yuborilgan
                              </span>
                            ) : computedStatus === "pending_received" ? (
                              <button
                                onClick={() => {
                                  const reqId =
                                    u.requestId ||
                                    contactRequests?.incoming?.find(
                                      (r) => r.user?.id === u.id
                                    )?.id;
                                  if (reqId) onRespondRequest(reqId, "accept");
                                }}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition cursor-pointer shadow-sm"
                              >
                                Qabul qilish
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendRequestToUser(u)}
                                disabled={isSending}
                                className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400 font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-40"
                              >
                                {isSending ? "Yuborilmoqda..." : "+ Qo‘shish"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal: Edit Nickname */}
        {editingNicknameUser && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
              <h4 className="text-sm font-bold text-white mb-1">
                Shaxsiy taxallus ({editingNicknameUser.displayName})
              </h4>
              <p className="text-xs text-zinc-400 mb-3">
                Bu taxallus faqat siz uchun ko‘rinadi.
              </p>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="Taxallus kiriting..."
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingNicknameUser(null)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSaveNickname}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Saqlash
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
