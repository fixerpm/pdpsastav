"use client";

import { useEffect, useRef } from "react";

export default function CallModal({
  callState,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  callDuration,
  iceStatus = "connected",
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onDismissError,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Lokal video oqimini ulash
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState.status, isVideoOff]);

  // Masofaviy video oqimini ulash
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState.status]);

  if (callState.status === "idle" && !callState.error) {
    return null;
  }

  // Vaqtni formatlash (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-in fade-in duration-200">
      {/* Audio element for remote sound in audio/video call */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Xatolik xabari modali */}
      {callState.error && (
        <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center text-2xl font-bold">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">Qo‘ng‘iroq muammosi</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{callState.error}</p>
          </div>
          <button
            onClick={onDismissError}
            className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Tushundim
          </button>
        </div>
      )}

      {/* 1. Kiruvchi qo'ng'iroq oynasi (Incoming Call) */}
      {!callState.error && callState.status === "incoming" && (
        <div className="relative bg-zinc-900/90 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl backdrop-blur-md">
          {/* Pulsing avatar */}
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
            <span className="absolute -inset-2 rounded-full border-2 border-cyan-500/40 animate-pulse" />
            <div
              className={`w-24 h-24 rounded-full bg-gradient-to-tr ${
                callState.otherUser?.avatarBg || "from-cyan-500 to-blue-600"
              } flex items-center justify-center text-2xl font-black text-white shadow-xl relative z-10`}
            >
              {callState.otherUser?.avatarText ||
                callState.otherUser?.displayName?.[0]?.toUpperCase() ||
                "U"}
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              {callState.otherUser?.displayName || "Foydalanuvchi"}
            </h3>
            <p className="text-xs text-cyan-400 font-medium flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Kiruvchi {callState.callType === "video" ? "video" : "ovozli"} qo‘ng‘iroq...
            </p>
          </div>

          {/* Javob berish va rad etish tugmalari */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
              title="Rad etish"
            >
              <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition group-hover:scale-105">
                <svg className="w-6 h-6 rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                </svg>
              </div>
              <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200">Rad etish</span>
            </button>

            <button
              onClick={onAccept}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
              title="Qabul qilish"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition group-hover:scale-105 animate-bounce">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                </svg>
              </div>
              <span className="text-[11px] text-emerald-400 group-hover:text-emerald-300 font-semibold">Qabul qilish</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Chiquvchi qo'ng'iroq oynasi (Calling...) */}
      {!callState.error && callState.status === "calling" && (
        <div className="relative bg-zinc-900/90 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl backdrop-blur-md">
          {/* Pulsing avatar */}
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
            <span className="absolute -inset-3 rounded-full border border-cyan-500/30 animate-pulse" />
            <div
              className={`w-24 h-24 rounded-full bg-gradient-to-tr ${
                callState.otherUser?.avatarBg || "from-cyan-500 to-blue-600"
              } flex items-center justify-center text-2xl font-black text-white shadow-xl relative z-10`}
            >
              {callState.otherUser?.avatarText ||
                callState.otherUser?.displayName?.[0]?.toUpperCase() ||
                "U"}
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              {callState.otherUser?.displayName || "Foydalanuvchi"}
            </h3>
            <p className="text-xs text-cyan-400 font-medium flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Javob kutilmoqda...
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onEnd}
              className="flex flex-col items-center gap-1.5 mx-auto group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition group-hover:scale-105">
                <svg className="w-6 h-6 rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                </svg>
              </div>
              <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200">Bekor qilish</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Faol ulanish holati (Connected Call UI) */}
      {!callState.error && callState.status === "connected" && (
        <div className="relative w-full max-w-4xl h-[85vh] max-h-[700px] bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col justify-between">
          {/* Yuqori panel: Suhbatdosh ismi va vaqt */}
          <div className="absolute top-0 inset-x-0 z-20 p-4 sm:p-5 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-tr ${
                  callState.otherUser?.avatarBg || "from-amber-500 to-orange-600"
                } flex items-center justify-center text-sm font-bold text-white shadow-md`}
              >
                {callState.otherUser?.avatarText ||
                  callState.otherUser?.displayName?.[0]?.toUpperCase() ||
                  "U"}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {callState.otherUser?.displayName || "Foydalanuvchi"}
                </h4>
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {iceStatus === "failed" ? (
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Ulanish uzildi (TURN kerak)</span>
                    </span>
                  ) : iceStatus === "disconnected" ? (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span>Qayta ulanmoqda...</span>
                    </span>
                  ) : iceStatus === "checking" ? (
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                      <span>Tarmoq tekshirilmoqda...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Jonli P2P aloqa</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono font-semibold text-zinc-200">
              {formatTime(callDuration)}
            </div>
          </div>

          {/* Asosiy Video / Audio maydoni */}
          <div className="relative flex-1 w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
            {callState.callType === "video" ? (
              <>
                {/* Masofaviy asosiy video (Remote Video) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Masofaviy video hali kelmagan bo'lsa loading / placeholder */}
                {!remoteStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-zinc-400 gap-3">
                    <div className="w-10 h-10 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
                    <p className="text-xs">Suhbatdosh videosi kutilmoqda...</p>
                  </div>
                )}

                {/* Lokal video oldindan ko'rish (PiP) */}
                <div className="absolute bottom-24 right-4 sm:right-6 w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-zinc-700/80 shadow-2xl bg-zinc-900 z-20">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {isVideoOff && (
                    <div className="absolute inset-0 bg-zinc-900/90 flex items-center justify-center text-xs text-zinc-400 font-medium">
                      Kamera o‘chiq
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-medium">
                    Siz
                  </span>
                </div>
              </>
            ) : (
              // Faqat Audio qo'ng'iroq bo'lsa
              <div className="flex flex-col items-center justify-center gap-6 text-center">
                <div className="relative">
                  <span className="absolute -inset-4 rounded-full bg-amber-500/10 animate-ping" />
                  <span className="absolute -inset-8 rounded-full border border-amber-500/20 animate-pulse" />
                  <div
                    className={`w-32 h-32 rounded-full bg-gradient-to-tr ${
                      callState.otherUser?.avatarBg || "from-amber-500 to-orange-600"
                    } flex items-center justify-center text-4xl font-black text-white shadow-2xl relative z-10`}
                  >
                    {callState.otherUser?.avatarText ||
                      callState.otherUser?.displayName?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                </div>

                <div className="space-y-1 z-10">
                  <h3 className="text-xl font-bold text-white">
                    {callState.otherUser?.displayName || "Foydalanuvchi"}
                  </h3>
                  <p className="text-xs text-zinc-400">Ovozli suhbat davom etmoqda</p>
                </div>
              </div>
            )}
          </div>

          {/* Pastki boshqaruv paneli (Control bar) */}
          <div className="absolute bottom-0 inset-x-0 z-20 p-4 sm:p-6 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            {/* Mikrofonni yoqish/o'chirish */}
            <button
              onClick={onToggleMute}
              className={`p-3.5 rounded-full transition cursor-pointer shadow-lg ${
                isMuted
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30"
                  : "bg-zinc-800/90 text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
              }`}
              title={isMuted ? "Mikrofonni yoqish" : "Mikrofonni o'chirish"}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 19L5 5m14 0l-3.5 3.5M9.88 9.88A3 3 0 1014.12 14.12M12 19v3m-4 0h8m-9-7.5a6 6 0 0010.5 0" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* Video kamerani yoqish/o'chirish (faqat video call bo'lsa) */}
            {callState.callType === "video" && (
              <button
                onClick={onToggleVideo}
                className={`p-3.5 rounded-full transition cursor-pointer shadow-lg ${
                  isVideoOff
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30"
                    : "bg-zinc-800/90 text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
                }`}
                title={isVideoOff ? "Kamerani yoqish" : "Kamerani o'chirish"}
              >
                {isVideoOff ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}

            {/* Qo'ng'iroqni tugatish (Hangup) */}
            <button
              onClick={onEnd}
              className="p-3.5 px-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold transition cursor-pointer shadow-xl shadow-rose-600/30 flex items-center gap-2"
              title="Qo'ng'iroqni tugatish"
            >
              <svg className="w-5 h-5 rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
              </svg>
              <span className="text-xs">Tugatish</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
