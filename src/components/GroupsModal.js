"use client";

import { useState } from "react";
import { parseErrorMessage } from "@/lib/error-parser";

export default function GroupsModal({
  isOpen,
  onClose,
  currentUser,
  groups = [],
  contacts = [],
  onCreateGroup,
  onJoinByCode,
  onSelectGroupChat,
  onUpdateGroup,
  onLeaveGroup,
  onRemoveMember,
  onSetAdminRole,
  convexGetGroupDetails,
}) {
  const [activeTab, setActiveTab] = useState("groups"); // "groups" | "create" | "join" | "manage"
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [feedback, setFeedback] = useState({ message: "", isError: false });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const showFeedback = (msg, isError = false) => {
    const cleanMsg = parseErrorMessage(msg);
    setFeedback({ message: cleanMsg, isError });
    setTimeout(() => setFeedback({ message: "", isError: false }), 4500);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!newGroupName.trim()) {
      showFeedback("Guruh nomini kiriting", true);
      return;
    }

    setLoading(true);
    try {
      await onCreateGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        memberUserIds: selectedMemberIds,
      });
      showFeedback("Guruh muvaffaqiyatli yaratildi!");
      setNewGroupName("");
      setNewGroupDesc("");
      setSelectedMemberIds([]);
      setActiveTab("groups");
    } catch (err) {
      showFeedback(err, true);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (loading || !joinCode.trim()) return;

    setLoading(true);
    try {
      await onJoinByCode(joinCode.trim().toUpperCase());
      showFeedback("Guruhga muvaffaqiyatli qo‘shildingiz!");
      setJoinCode("");
      setActiveTab("groups");
    } catch (err) {
      showFeedback(err, true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenManageGroup = async (group) => {
    setSelectedGroup(group);
    setActiveTab("manage");
    if (convexGetGroupDetails) {
      try {
        const details = await convexGetGroupDetails({
          groupId: group.groupId,
          userId: currentUser?.id,
        });
        setGroupDetails(details);
      } catch (err) {
        showFeedback(err.message, true);
      }
    }
  };

  const toggleSelectMember = (userId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏢</span>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-wide">Guruhlar</h3>
              <p className="text-xs text-zinc-400">Jamoaviy muloqot va guruhlarni boshqarish</p>
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
        <div className="flex border-b border-zinc-800 bg-zinc-900/50 px-3 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("groups")}
            className={`pb-2.5 px-3 transition border-b-2 cursor-pointer ${
              activeTab === "groups"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Guruhlarim ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`pb-2.5 px-3 transition border-b-2 cursor-pointer ${
              activeTab === "create"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            + Guruh yaratish
          </button>
          <button
            onClick={() => setActiveTab("join")}
            className={`pb-2.5 px-3 transition border-b-2 cursor-pointer ${
              activeTab === "join"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🔑 Kod orqali qo‘shilish
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback.message && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between ${
              feedback.isError
                ? "bg-rose-500/10 text-rose-400 border-b border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20"
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback({ message: "", isError: false })} className="cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: Groups List */}
          {activeTab === "groups" && (
            <div className="space-y-2">
              {groups.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  <p className="text-2xl mb-2">👥</p>
                  <p>Hozircha hech qanday guruhga a’zo emassiz.</p>
                  <div className="flex gap-2 justify-center mt-3">
                    <button
                      onClick={() => setActiveTab("create")}
                      className="px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl font-bold cursor-pointer transition"
                    >
                      Yangi guruh ochish
                    </button>
                    <button
                      onClick={() => setActiveTab("join")}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-bold cursor-pointer transition"
                    >
                      Kodni kiritish
                    </button>
                  </div>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.groupId}
                    className="p-3 bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
                          group.avatarBg || "from-cyan-500 to-blue-600"
                        } shadow-sm shrink-0`}
                      >
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{group.name}</span>
                          {group.ownerId === currentUser?.id && (
                            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] rounded font-semibold">
                              Egasi
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {group.memberIds?.length || 1} a‘zo • Kod: {group.inviteCode || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          onSelectGroupChat(group);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 text-xs font-bold rounded-lg border border-cyan-500/30 transition cursor-pointer"
                      >
                        💬 Chat
                      </button>
                      <button
                        onClick={() => handleOpenManageGroup(group)}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition cursor-pointer"
                        title="Guruh ma'lumotlari va boshqaruv"
                      >
                        ⚙️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Create Group */}
          {activeTab === "create" && (
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Guruh nomi
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Masalan: Frontend PDP SASTAV"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Tavsif (ixtiyoriy)
                </label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Guruh maqsadi yoki qoidalari..."
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none resize-none"
                />
              </div>

              {/* Select initial members from contacts */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  A’zolarni tanlang ({selectedMemberIds.length} tanlandi)
                </label>
                {contacts.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2">
                    Kontaklaringiz yo‘q. Guruhni yaratib, keyin taklif kodi orqali ham odam qo‘sha olasiz.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                    {contacts.map((contact) => {
                      const isSelected = selectedMemberIds.includes(contact.userId);
                      return (
                        <div
                          key={contact.userId}
                          onClick={() => toggleSelectMember(contact.userId)}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition text-xs ${
                            isSelected ? "bg-cyan-500/20 text-cyan-300" : "hover:bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{contact.displayName}</span>
                            <span className="text-[10px] text-zinc-500">@{contact.username}</span>
                          </div>
                          <span>{isSelected ? "✓" : "+"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Yaratilmoqda..." : "Guruh yaratish"}
              </button>
            </form>
          )}

          {/* TAB 3: Join by Code */}
          {activeTab === "join" && (
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center space-y-2">
                <span className="text-3xl">🔑</span>
                <h4 className="text-xs font-bold text-white">Guruh taklif kodi</h4>
                <p className="text-[11px] text-zinc-400">
                  Guruh admini tomonidan berilgan 6 xonali taklif kodini kiriting
                </p>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="MASALAN: X7AB9Q"
                  maxLength={10}
                  className="w-48 mx-auto text-center font-mono font-extrabold tracking-widest text-base bg-zinc-950 border border-zinc-800 focus:border-cyan-400 rounded-xl py-2 px-3 text-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !joinCode.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Tekshirilmoqda..." : "Guruhga qo‘shilish"}
              </button>
            </form>
          )}

          {/* TAB 4: Manage Group */}
          {activeTab === "manage" && selectedGroup && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <button
                  onClick={() => setActiveTab("groups")}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  ← Orqaga
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 text-cyan-400">
                    Kod: {selectedGroup.inviteCode}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedGroup.inviteCode || "");
                      showFeedback("Taklif kodi nusxalandi!");
                    }}
                    className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded text-xs cursor-pointer"
                    title="Nusxalash"
                  >
                    📋
                  </button>
                </div>
              </div>

              {groupDetails?.owner && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">👑</span>
                    <div>
                      <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">Guruh Asoschisi</span>
                      <span className="font-bold text-white">{groupDetails.owner.displayName}</span>
                      {groupDetails.owner.username && (
                        <span className="text-zinc-400 text-[11px] ml-1.5">@{groupDetails.owner.username}</span>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-extrabold text-[10px] rounded-lg">
                    Egasi
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Guruh a‘zolari ({groupDetails?.members?.length || selectedGroup.memberIds?.length || 1})
                </h4>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(groupDetails?.members || []).map((member) => (
                    <div
                      key={member.userId}
                      className="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs bg-gradient-to-tr ${
                            member.avatarBg || "from-cyan-500 to-blue-600"
                          } shrink-0`}
                        >
                          {member.avatarText || member.username?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{member.displayName}</p>
                          <p className="text-[10px] text-zinc-500 truncate">@{member.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            member.role === "owner"
                              ? "bg-amber-500/20 text-amber-300"
                              : member.role === "admin"
                              ? "bg-cyan-500/20 text-cyan-300"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {member.role === "owner"
                            ? "Egasi"
                            : member.role === "admin"
                            ? "Admin"
                            : "A‘zo"}
                        </span>

                        {/* Owner actions */}
                        {groupDetails?.isOwner && member.userId !== currentUser?.id && (
                          <button
                            onClick={async () => {
                              await onSetAdminRole(
                                selectedGroup.groupId,
                                member.userId,
                                member.role !== "admin"
                              );
                              handleOpenManageGroup(selectedGroup);
                            }}
                            className="p-1 text-zinc-400 hover:text-cyan-400 text-xs cursor-pointer"
                            title={member.role === "admin" ? "Adminlikni olish" : "Admin qilish"}
                          >
                            ⭐
                          </button>
                        )}

                        {/* Remove button */}
                        {(groupDetails?.isAdmin || groupDetails?.isOwner) &&
                          member.role !== "owner" &&
                          member.userId !== currentUser?.id && (
                            <button
                              onClick={async () => {
                                await onRemoveMember(selectedGroup.groupId, member.userId);
                                handleOpenManageGroup(selectedGroup);
                              }}
                              className="p-1 text-zinc-400 hover:text-rose-400 text-xs cursor-pointer"
                              title="Guruhdan chiqarish"
                            >
                              ✕
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave group button */}
              <div className="pt-3 border-t border-zinc-800">
                <button
                  onClick={async () => {
                    await onLeaveGroup(selectedGroup.groupId);
                    setActiveTab("groups");
                    onClose();
                  }}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Guruhdan chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
