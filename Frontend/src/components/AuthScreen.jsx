import { Loader2, Orbit } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await register(form.email, form.password, form.fullName || null);
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-neutral-200">
      <div className="telemetry-grid" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[1fr_420px] z-10">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-12">
          <div className="flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 border border-white/10 text-white backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <Orbit size={20} className="text-white/80" />
            </div>
            <div className="rounded-full px-4 py-1.5 glass-panel">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Constellation</p>
            </div>
          </div>
          <div className="max-w-2xl py-16">
            <h1 className="text-4xl font-semibold tracking-tight text-white/90 sm:text-5xl border-l-[2px] border-white/20 pl-6 py-2">
              Establish <br /> Data Telemetry.
            </h1>
            <div className="mt-8 grid grid-cols-2 gap-4 max-w-sm opacity-80">
              <div className="glass-panel rounded-xl p-4">
                <span className="block font-mono text-[8px] text-white/40 mb-1 uppercase tracking-widest">SEQ 01</span>
                <span className="block text-xs font-medium text-white/80">Initialize Space</span>
              </div>
              <div className="glass-panel rounded-xl p-4">
                <span className="block font-mono text-[8px] text-white/40 mb-1 uppercase tracking-widest">SEQ 02</span>
                <span className="block text-xs font-medium text-white/80">Map Vectors</span>
              </div>
            </div>
          </div>
        </section>
        <section className="flex items-center px-5 py-8 sm:px-8">
          <form onSubmit={submit} className="w-full glass-panel rounded-3xl p-8 relative">
            <div className="mb-8 flex rounded-xl bg-black/40 p-1 border border-white/5 backdrop-blur-sm">
              {["login", "register"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`h-10 flex-1 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all ${
                    mode === m ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-[9px] font-semibold uppercase tracking-widest text-white/40 ml-1">Identity (Email)</span>
                <input
                  className="h-11 w-full rounded-xl glass-input px-4 font-mono text-xs text-white placeholder-white/20 outline-none"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                  placeholder="USER@SYSTEM.NET"
                />
              </label>
              {mode === "register" && (
                <label className="block">
                  <span className="mb-2 block text-[9px] font-semibold uppercase tracking-widest text-white/40 ml-1">Designation (Name)</span>
                  <input
                    className="h-11 w-full rounded-xl glass-input px-4 font-mono text-xs text-white placeholder-white/20 outline-none"
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                    placeholder="ALIAS"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-[9px] font-semibold uppercase tracking-widest text-white/40 ml-1">Security Key (Password)</span>
                <input
                  className="h-11 w-full rounded-xl glass-input px-4 font-mono text-xs text-white placeholder-white/20 outline-none"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                  placeholder="••••••••"
                  minLength={mode === "register" ? 8 : undefined}
                />
              </label>
            </div>
            {error && (
              <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 backdrop-blur-md">
                <p className="font-mono text-[10px] text-red-300">ERR: {error.toUpperCase()}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 text-[10px] font-bold uppercase tracking-widest text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50 backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.02)]"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{mode === "register" ? "Initialize User" : "Authenticate"}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
