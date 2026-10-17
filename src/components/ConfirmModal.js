"use client";

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "O‘chirish",
  cancelLabel = "Bekor qilish",
  isDestructive = true,
  showForEveryoneOption = false,
  forEveryone = false,
  onToggleForEveryone,
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
              isDestructive
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
            }`}
          >
            {isDestructive ? "🗑️" : "⚠️"}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
              {description}
            </p>
          </div>
        </div>

        {/* Barcha uchun o'chirish opsiyasi */}
        {showForEveryoneOption && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
            <input
              type="checkbox"
              checked={forEveryone}
              onChange={(e) => onToggleForEveryone?.(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-500 focus:ring-0 accent-cyan-400 cursor-pointer"
            />
            <div className="text-xs text-zinc-300 font-medium select-none">
              Barcha foydalanuvchilar uchun ham o‘chirish
            </div>
          </label>
        )}

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                : "bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-zinc-950 shadow-cyan-500/30 font-extrabold"
            }`}
          >
            {isLoading && (
              <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
