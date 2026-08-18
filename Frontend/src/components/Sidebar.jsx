import { FlaskConical, LogOut, MessageSquare, Orbit, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function Sidebar({ user, chats, currentChatId, onOpenChat, onNewChat, onLogout, status }) {
  return (
    <aside className="relative flex min-h-0 flex-col border-r border-white/5 glass-panel z-20">
      <div className="border-b border-white/5 p-5">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 border border-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.02)]">
              <Orbit size={16} className="text-white/70" />
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/80">Constellation</p>
              <p className="truncate font-mono text-[8px] uppercase text-white/30 mt-0.5">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Terminate Session"
            className="grid h-8 w-8 place-items-center rounded-md text-white/30 hover:bg-white/5 hover:text-white transition"
          >
            <LogOut size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 text-[10px] font-semibold uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Plus size={14} />
          New Session
        </button>
        <Link
          to="/eval"
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-transparent text-[10px] font-semibold uppercase tracking-widest text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
        >
          <FlaskConical size={14} />
          Evaluation
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 relative">
        <h2 className="mb-4 ml-1 text-[9px] font-semibold uppercase tracking-widest text-white/40">Active Sessions</h2>
        {chats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/5 bg-black/20 p-4 font-mono text-[9px] uppercase text-white/30 text-center">
            [ NO SESSIONS FOUND ]
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {chats.map((chat) => (
              <button
                type="button"
                key={chat._id}
                onClick={() => onOpenChat(chat)}
                className={`w-full rounded-xl p-3 text-left transition-all ${
                  currentChatId === chat._id
                    ? "glass-panel-active text-white shadow-sm"
                    : "border border-transparent hover:bg-white/5 text-white/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare size={12} className={currentChatId === chat._id ? "text-white/80" : "text-white/30"} />
                  <span className="block min-w-0 truncate text-[10px] font-semibold tracking-wide">{chat.chat_name}</span>
                </span>
                <span className="mt-2 block font-mono text-[8px] opacity-50">
                  V: {chat.docs?.length || 0} // C: {chat.previous_messages?.filter((m) => m.role === "user").length || 0}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto pt-4 border-t border-white/5">
          <p className="font-mono text-[8px] uppercase tracking-widest text-white/40 flex items-center justify-between">
            <span>SYS_STATUS:</span>
            <span className={`px-2 py-1 rounded-md border ${status.includes("ERR") ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-white/5 bg-white/5 text-white/60"}`}>
              {status || "IDLE"}
            </span>
          </p>
        </div>
      </div>
    </aside>
  );
}
