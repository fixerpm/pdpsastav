"use client";

import { useState } from "react";

export default function EditNicknameModal({
  isOpen,
  initialValue = "",
  title = "Chat nomini tahrirlash",
  description = "Faqat siz uchun ko‘rinadigan shaxsiy taxallus (nickname) belgilang.",
  placeholder = "Yangi nom...",
  onSave,
  onClose,
  isLoading = false,
}) {
  if (!isOpen) return null;

  return (
    <EditNicknameModalForm
      key={initialValue}
      initialValue={initialValue}
      title={title}
      description={description}
      placeholder={placeholder}
      onSave={onSave}
      onClose={onClose}
      isLoading={isLoading}
    />
  );
}

function EditNicknameModalForm({
  initialValue,
  title,
  description,
  placeholder,
  onSave,
  onClose,
  isLoading,
}) {
  const [value, setValue] = useState(initialValue || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(value.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            maxLength={60}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition shadow-inner"
          />

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition cursor-pointer disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-xs font-bold text-zinc-950 transition cursor-pointer shadow-lg shadow-cyan-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && (
                <span className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
              )}
              <span>Saqlash</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
