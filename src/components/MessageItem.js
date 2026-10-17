"use client";

import { useState } from "react";

export default function MessageItem({
  msg,
  isMe,
  getAvatarColor,
  formatTime,
  onEditMessage,
  onDeleteMessage,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.body || "");
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const isSticker = msg.type === "sticker";
  const isVoice = msg.type === "voice";
  const isVideo = msg.type === "video";
  const isDeleted = msg.type === "deleted" || msg.isDeletedForEveryone;

  // Nusxalash
  const handleCopy = () => {
    const textToCopy = msg.body || msg.mediaUrl || "";
    if (textToCopy) {
      navigator.clipboard?.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setShowMenu(false);
  };

  // Tahrirlashni saqlash
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editText.trim()) return;
    onEditMessage?.(msg._id || msg.id, editText.trim());
    setIsEditing(false);
  };

  // Bekor qilish
  const handleCancelEdit = () => {
    setEditText(msg.body || "");
    setIsEditing(false);
  };

  // Holat piktogrammasi (Status Icon)
  const renderStatus = () => {
    if (!isMe) return null;
    const status = msg.status || "delivered";

    if (status === "sending") {
      return <span className="text-[10px] opacity-60 animate-pulse">⏳</span>;
    }
    if (status === "sent") {
      return (
        <span className="text-[10px] opacity-80 font-bold text-cyan-200" title="Yuborildi">
          ✓
        </span>
      );
    }
    if (status === "delivered") {
      return (
        <span className="text-[10px] opacity-90 font-bold text-cyan-200" title="Yetkazildi">
          ✓✓
        </span>
      );
    }
    if (status === "read") {
      return (
        <span className="text-[10px] text-cyan-200 font-black drop-shadow-sm" title="O‘qildi">
          ✓✓
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className={`group relative flex items-end gap-2.5 ${
        isMe ? "justify-end" : "justify-start"
      }`}
    >
      {/* Suhbatdosh avatari */}
      {!isMe && (
        <div
          className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarColor(
            msg.author
          )} shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md ring-1 ring-zinc-800`}
        >
          {msg.author?.[0]?.toUpperCase() || "A"}
        </div>
      )}

      {/* Xabar amallari menyusi tugmasi */}
      {!isDeleted && (
        <div
          className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center ${
            isMe ? "order-first" : "order-last"
          }`}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              title="Amallar"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className={`absolute bottom-full mb-1 z-40 w-36 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1 text-xs text-zinc-300 ${
                    isMe ? "right-0" : "left-0"
                  }`}
                >
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
                  >
                    <span>📋</span> {copied ? "Nusxalandi!" : "Nusxalash"}
                  </button>

                  {/* Faqat o'z matnli xabarini tahrirlash mumkin */}
                  {isMe && !isSticker && !isVoice && !isVideo && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setIsEditing(true);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
                    >
                      <span>✏️</span> Tahrirlash
                    </button>
                  )}

                  <div className="my-1 border-t border-zinc-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDeleteMessage?.(msg);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 cursor-pointer"
                  >
                    <span>🗑️</span> O‘chirish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Asosiy Xabar Pufakchasi (Message Bubble) */}
      <div
        className={`max-w-[85%] sm:max-w-md rounded-2xl p-3 shadow-sm space-y-1.5 transition-all ${
          isSticker
            ? "bg-transparent shadow-none"
            : isDeleted
            ? "bg-zinc-900/60 border border-zinc-800/60 text-zinc-500 italic rounded-xl"
            : isMe
            ? "bg-gradient-to-br from-cyan-600 via-cyan-600 to-teal-600 text-white font-medium rounded-br-none shadow-md shadow-cyan-950/40 border border-cyan-400/30"
            : "bg-zinc-900/90 border border-zinc-800 text-zinc-100 rounded-bl-none shadow-sm"
        }`}
      >
        {!isMe && !isSticker && !isDeleted && (
          <div className="text-[11px] font-bold text-cyan-400">
            {msg.author}
          </div>
        )}

        {/* O'chirilgan xabar holati */}
        {isDeleted ? (
          <div className="flex items-center gap-2 text-xs py-1">
            <span>🚫</span>
            <span>Ushbu xabar o‘chirildi</span>
          </div>
        ) : isEditing ? (
          // Tahrirlash rejimi
          <form onSubmit={handleSaveEdit} className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={2}
              className="w-full bg-zinc-950 text-zinc-100 border border-cyan-400/80 focus:ring-1 focus:ring-cyan-500 rounded-xl p-2 text-xs sm:text-sm focus:outline-none resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit(e);
                } else if (e.key === "Escape") {
                  handleCancelEdit();
                }
              }}
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-[11px] transition cursor-pointer shadow-sm"
              >
                Saqlash
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Stiker */}
            {isSticker && (
              <div className="text-6xl sm:text-7xl py-1 select-none animate-bounce">
                {msg.body}
              </div>
            )}

            {/* Ovozli xabar */}
            {isVoice && (
              <div className="space-y-1 py-1">
                <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                  <span>🎙️ Ovozli xabar</span>
                </div>
                {msg.mediaUrl ? (
                  <audio
                    src={msg.mediaUrl}
                    controls
                    preload="metadata"
                    className="w-56 sm:w-64 h-9 accent-cyan-400 rounded-lg outline-none"
                  />
                ) : (
                  <div className="text-xs italic opacity-75">
                    Audio saqlangan (ID: {msg.storageId?.slice(0, 10)})
                  </div>
                )}
              </div>
            )}

            {/* Dumaloq Video xabar (Telegram video note) */}
            {isVideo && (
              <div className="space-y-1.5 py-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                  <span>📹 Videoxabar</span>
                </div>
                {msg.mediaUrl ? (
                  <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-2 border-cyan-400/80 shadow-xl shadow-cyan-950/50 bg-black mx-auto">
                    <video
                      src={msg.mediaUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="text-xs italic opacity-75">
                    Videoxabar saqlangan (ID: {msg.storageId?.slice(0, 10)})
                  </div>
                )}
              </div>
            )}

            {/* Oddiy matn */}
            {!isSticker && !isVoice && !isVideo && (
              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
                {msg.body}
              </p>
            )}
          </>
        )}

        {/* Vaqt, Holat va Tahrirlanganlik belgisi */}
        {!isSticker && !isDeleted && (
          <div
            className={`text-[10px] flex items-center justify-end gap-1.5 ${
              isMe ? "text-cyan-100/90" : "text-zinc-400"
            }`}
          >
            {msg.isEdited && (
              <span
                className="italic opacity-80"
                title={msg.editedAt ? `Tahrirlangan: ${new Date(msg.editedAt).toLocaleTimeString()}` : "Tahrirlangan"}
              >
                (tahrirlangan)
              </span>
            )}
            <span>{formatTime(msg._creationTime || msg.createdAt)}</span>
            {renderStatus()}
          </div>
        )}
      </div>

      {/* O'zimning avatarim */}
      {isMe && !isSticker && (
        <div
          className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarColor(
            msg.author
          )} shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md ring-1 ring-cyan-500/30`}
        >
          {msg.author?.[0]?.toUpperCase() || "M"}
        </div>
      )}
    </div>
  );
}
