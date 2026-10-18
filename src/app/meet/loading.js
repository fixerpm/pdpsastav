export default function MeetLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-400 text-xs">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <p className="font-semibold text-zinc-300">PDP Uchrashuv xonasi yuklanmoqda...</p>
      </div>
    </div>
  );
}
