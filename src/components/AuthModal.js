"use client";

import { useState } from "react";
import Image from "next/image";
import { BRAND_CONFIG } from "@/config/branding";
import { parseErrorMessage, normalizeUsername, validateUsername } from "@/lib/error-parser";

export default function AuthModal({ isOpen, onClose, onAuthSuccess, convexRegister, convexLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessMsg("");

    const validation = validateUsername(username);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }
    const cleanUsername = validation.clean;

    if (!password) {
      setError("Parol kiritilishi shart");
      return;
    }

    if (mode === "register") {
      if (!displayName.trim()) {
        setError("To‘liq ismingizni kiriting");
        return;
      }
      if (password.length < 4) {
        setError("Parol kamida 4 ta belgidan iborat bo‘lishi kerak");
        return;
      }
      if (password !== confirmPassword) {
        setError("Parollar bir-biriga mos kelmadi");
        return;
      }

      setLoading(true);
      try {
        let userResult;
        if (convexRegister) {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Server javob berish vaqti tugadi. Qayta urinib ko‘ring.")), 8000)
          );
          const res = await Promise.race([
            convexRegister({
              username: cleanUsername,
              displayName: displayName.trim(),
              password,
              bio: bio.trim() || undefined,
            }),
            timeoutPromise,
          ]);
          userResult = res.user;
        } else {
          // Fallback to local API
          const res = await fetch("/api/chat/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "register",
              username: cleanUsername,
              displayName: displayName.trim(),
              password,
              bio: bio.trim(),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Ro'yxatdan o'tishda xatolik yuz berdi");
          userResult = data.user;
        }

        // Save session
        const token = "tok-" + Math.random().toString(36).slice(2, 12);
        const finalUser = {
          ...userResult,
          id: userResult.userId || userResult.id,
          userId: userResult.userId || userResult.id,
        };
        localStorage.setItem("chat_token", token);
        localStorage.setItem("chat_username", finalUser.username);
        localStorage.setItem("chat_display_name", finalUser.displayName);
        localStorage.setItem("chat_user", JSON.stringify(finalUser));

        if (onAuthSuccess) onAuthSuccess(finalUser, token);
        onClose();
      } catch (err) {
        setError(parseErrorMessage(err, "Ro‘yxatdan o‘tishda xatolik yuz berdi"));
      } finally {
        setLoading(false);
      }
    } else if (mode === "login") {
      setLoading(true);
      try {
        let userResult;
        if (convexLogin) {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Server javob berish vaqti tugadi. Qayta urinib ko‘ring.")), 8000)
          );
          const res = await Promise.race([
            convexLogin({
              username: cleanUsername,
              password,
            }),
            timeoutPromise,
          ]);
          userResult = res.user;
        } else {
          const res = await fetch("/api/chat/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "login",
              username: cleanUsername,
              password,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Login yoki parol noto'g'ri");
          userResult = data.user;
        }

        const token = "tok-" + Math.random().toString(36).slice(2, 12);
        const finalUser = {
          ...userResult,
          id: userResult.userId || userResult.id,
          userId: userResult.userId || userResult.id,
        };
        localStorage.setItem("chat_token", token);
        localStorage.setItem("chat_username", finalUser.username);
        localStorage.setItem("chat_display_name", finalUser.displayName);
        localStorage.setItem("chat_user", JSON.stringify(finalUser));

        if (onAuthSuccess) onAuthSuccess(finalUser, token);
        onClose();
      } catch (err) {
        setError(parseErrorMessage(err, "Login yoki parol noto‘g‘ri"));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Username kiriting");
      return;
    }
    setError("");
    setSuccessMsg(
      `@${username.replace(/^@/, "")} uchun parolni tiklash xabari yuborildi (yoki ma'muriyatga murojaat qiling).`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-7 overflow-y-auto max-h-[92dvh]">
        {/* Glow accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <Image
              src={BRAND_CONFIG.avatarUrl}
              alt={BRAND_CONFIG.name}
              width={54}
              height={54}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-cyan-500/70 shadow-lg shadow-cyan-500/30"
              priority
            />
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-zinc-950 shadow" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">
            {BRAND_CONFIG.brandPrefix}{" "}
            <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              {BRAND_CONFIG.brandSuffix}
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {mode === "register"
              ? "Yangi akkaunt yarating va muloqotni boshlang"
              : mode === "login"
              ? "Platformaga xavfsiz kiring"
              : "Parolni tiklash"}
          </p>
        </div>

        {/* Mode selector tabs */}
        {mode !== "forgot" && (
          <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === "login"
                  ? "bg-zinc-800 text-cyan-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Kirish
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === "register"
                  ? "bg-zinc-800 text-cyan-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Ro‘yxatdan o‘tish
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="mb-4 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Forms */}
        {mode !== "forgot" ? (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Ism va Familiya
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Masalan: Sardor Aliyev"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Foydalanuvchi nomi (@username)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-xs text-cyan-400 font-bold">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="username"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400/80 rounded-xl pl-8 pr-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  required
                />
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Bio / Qisqa ma’lumot (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Masalan: Frontend Developer | PDP SASTAV"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-zinc-300">Parol</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    Parolni unutdingizmi?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                required
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Parolni tasdiqlang
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{mode === "register" ? "Ro‘yxatdan o‘tish" : "Tizimga kirish"}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Foydalanuvchi nomi (@username)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-400/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition cursor-pointer"
            >
              Tiklash havolasini so‘rash
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccessMsg("");
                }}
                className="text-xs text-zinc-400 hover:text-cyan-400 transition cursor-pointer"
              >
                ← Kirish sahifasiga qaytish
              </button>
            </div>
          </form>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          title="Yopish"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
