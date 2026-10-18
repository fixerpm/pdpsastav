"use client";

import { useState } from "react";
import Image from "next/image";
import { BRAND_CONFIG } from "@/config/branding";

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onChangePassword,
  onLogout,
  onDeleteAccount,
}) {
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "privacy" | "security" | "appearance"
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [whoCanCall, setWhoCanCall] = useState(currentUser?.privacySettings?.whoCanCall || "everyone");
  const [showLastSeen, setShowLastSeen] = useState(currentUser?.privacySettings?.showLastSeen || "everyone");
  const [feedback, setFeedback] = useState({ message: "", isError: false });
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  if (!isOpen) return null;

  const showFeedback = (msg, isError = false) => {
    setFeedback({ message: msg, isError });
    setTimeout(() => setFeedback({ message: "", isError: false }), 4000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showFeedback("Ism bo‘sh bo‘lishi mumkin emas", true);
      return;
    }

    setLoading(true);
    try {
      await onUpdateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
      });
      showFeedback("Profil muvaffaqiyatli yangilandi!");
    } catch (err) {
      showFeedback(err.message || "Xatolik yuz berdi", true);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    setLoading(true);
    try {
      await onUpdateProfile({
        privacySettings: {
          whoCanCall,
          showLastSeen,
        },
      });
      showFeedback("Maxfiylik sozlamalari saqlandi!");
    } catch (err) {
      showFeedback(err.message || "Xatolik yuz berdi", true);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      showFeedback("Yangi parol kamida 4 belgidan iborat bo‘lishi lozim", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showFeedback("Yangi parollar mos kelmadi", true);
      return;
    }

    setLoading(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      showFeedback("Parol muvaffaqiyatli almashtirildi!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showFeedback(err.message || "Parolni almashtirishda xatolik", true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await onDeleteAccount(deletePassword);
      onClose();
    } catch (err) {
      showFeedback(err.message || "Akkauntni o‘chirishda xatolik", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚙️</span>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">Sozlamalar</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">Profil, maxfiylik va tizim parametrlari</p>
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
            onClick={() => setActiveTab("profile")}
            className={`pb-2.5 px-3 transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === "profile"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            👤 Profil
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`pb-2.5 px-3 transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === "privacy"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🔒 Maxfiylik
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`pb-2.5 px-3 transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === "security"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🛡️ Xavfsizlik
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

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: Profile */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-white text-lg bg-gradient-to-tr ${
                    currentUser?.avatarBg || "from-cyan-500 to-blue-600"
                  } shadow-md shrink-0 ring-2 ring-cyan-500/40`}
                >
                  {currentUser?.avatarText || currentUser?.username?.slice(0, 2).toUpperCase() || "PDP"}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{currentUser?.displayName}</h4>
                  <p className="text-xs text-cyan-400 font-mono">@{currentUser?.username}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">PDP SASTAV rasmiy a‘zosi</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Ko‘rinadigan ism
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Bio / Qisqa tavsif
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="O‘zingiz haqingizda qisqacha yozing..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Saqlanmoqda..." : "Profilni saqlash"}
              </button>
            </form>
          )}

          {/* TAB 2: Privacy */}
          {activeTab === "privacy" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-2">
                  Kim menga qo‘ng‘iroq qila oladi?
                </label>
                <div className="space-y-1.5">
                  {[
                    { value: "everyone", label: "Hamma" },
                    { value: "contacts", label: "Faqat kontaktlarim" },
                    { value: "nobody", label: "Hech kim" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2.5 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-900 transition text-xs text-zinc-300"
                    >
                      <input
                        type="radio"
                        name="whoCanCall"
                        value={opt.value}
                        checked={whoCanCall === opt.value}
                        onChange={() => setWhoCanCall(opt.value)}
                        className="text-cyan-500 focus:ring-0"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-2">
                  Oxirgi marta kirgan vaqtimni kim ko‘ra oladi?
                </label>
                <div className="space-y-1.5">
                  {[
                    { value: "everyone", label: "Hamma" },
                    { value: "contacts", label: "Faqat kontaktlarim" },
                    { value: "nobody", label: "Hech kim" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2.5 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-900 transition text-xs text-zinc-300"
                    >
                      <input
                        type="radio"
                        name="showLastSeen"
                        value={opt.value}
                        checked={showLastSeen === opt.value}
                        onChange={() => setShowLastSeen(opt.value)}
                        className="text-cyan-500 focus:ring-0"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSavePrivacy}
                disabled={loading}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Maxfiylikni saqlash
              </button>
            </div>
          )}

          {/* TAB 3: Security & Session */}
          {activeTab === "security" && (
            <div className="space-y-5">
              {/* Change Password form */}
              <form onSubmit={handleChangePassword} className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Parolni o‘zgartirish
                </h4>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Eski parol
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Yangi parol
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Yangi parolni tasdiqlang
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Parolni yangilash
                </button>
              </form>

              {/* Logout button */}
              <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  🚪 Tizimdan chiqish (Logout)
                </button>

                {/* Delete Account */}
                {!deleteConfirmOpen ? (
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="w-full py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    Akkauntni butunlay o‘chirish
                  </button>
                ) : (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                    <p className="text-xs text-rose-300 font-bold">
                      Haqiqatan ham akkauntni o‘chirmoqchimisiz? Barcha xabarlaringiz va kontaktlaringiz o‘chiriladi.
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Tasdiqlash uchun parolni kiriting"
                      className="w-full bg-zinc-950 border border-rose-500/40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirmOpen(false)}
                        className="flex-1 py-1 text-xs text-zinc-400 hover:text-white"
                      >
                        Bekor qilish
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        className="flex-1 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg"
                      >
                        Ha, o‘chirilsin
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
