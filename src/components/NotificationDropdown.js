"use client";

export default function NotificationDropdown({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenItem,
}) {
  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-transparent" />
      <div className="absolute top-12 right-1 sm:right-6 z-50 w-[calc(100vw-1rem)] sm:w-96 max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80dvh] animate-fade-in">
        {/* Header */}
        <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <span className="text-xs font-extrabold text-white">Bildirishnomalar</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-cyan-500 text-zinc-950 text-[10px] font-extrabold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[10px] text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              Hammasini o‘qilgan qilish
            </button>
          )}
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-xs">
              <p className="text-2xl mb-1">🔕</p>
              <p>Hozircha yangi bildirishnomalar yo‘q</p>
            </div>
          ) : (
            notifications.map((n) => {
              const icon =
                n.type === "message"
                  ? "💬"
                  : n.type === "contact_request"
                  ? "👥"
                  : n.type === "contact_accepted"
                  ? "🤝"
                  : n.type === "group_invite"
                  ? "🏢"
                  : n.type === "meeting"
                  ? "📹"
                  : "ℹ️";

              return (
                <div
                  key={n._id}
                  onClick={() => {
                    if (!n.isRead && onMarkAsRead) onMarkAsRead(n._id);
                    if (onOpenItem) onOpenItem(n);
                  }}
                  className={`p-3 transition cursor-pointer flex items-start gap-3 hover:bg-zinc-900/80 ${
                    !n.isRead ? "bg-cyan-500/5" : "bg-transparent"
                  }`}
                >
                  <span className="text-base shrink-0 mt-0.5">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          !n.isRead ? "font-bold text-white" : "font-medium text-zinc-300"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">{n.body}</p>
                    <span className="text-[9px] text-zinc-500 mt-1 block">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
