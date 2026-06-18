import {
  ArrowUp,
  Bot,
  Check,
  FileText,
  FolderOpen,
  Loader2,
  LogOut,
  MessageSquare,
  Network,
  Orbit,
  Paperclip,
  Plus,
  RefreshCw,
  X,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const tokenKey = "constellation_auth_token";
const userKey = "constellation_auth_user";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJson(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function ConstellationGraph({ graph, selectedDocs, onToggleDoc }) {
  const nodes = graph.nodes || [];
  const links = graph.links || [];
  const backgroundStars = useMemo(
    () =>
      Array.from({ length: 80 }, (_, index) => ({
        id: index,
        x: (index * 37) % 100,
        y: (index * 61) % 100,
        size: 1 + (index % 3) * 0.6,
        opacity: 0.08 + (index % 5) * 0.025,
      })),
    [],
  );
  const positionedNodes = useMemo(() => {
    if (nodes.length === 0) return [];
    const centerX = 50;
    const centerY = 48;
    const radius = nodes.length < 4 ? 24 : 34;
    return nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
      const innerShift = index % 2 === 0 ? 0 : -8;
      return {
        ...node,
        x: centerX + Math.cos(angle) * (radius + innerShift),
        y: centerY + Math.sin(angle) * (radius + innerShift),
        driftDelay: `${-(index % 7) * 0.8}s`,
        driftDuration: `${7 + (index % 5)}s`,
      };
    });
  }, [nodes]);
  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
  const maxRelevance = Math.max(...links.map((link) => Number(link.relevance) || 0), 1);

  if (nodes.length === 0) {
    return (
      <div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-lg border border-[#263858] bg-[#0d1628] p-6">
        <div className="absolute inset-0 star-field opacity-80" />
        <div className="relative text-center">
          <Orbit className="mx-auto mb-3 text-[#f8c66d]" size={28} />
          <p className="text-sm font-semibold text-[#f4efe5]">No stars charted yet</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#aebbd2]">
            Upload documents to form your first knowledge constellation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[340px] overflow-hidden rounded-lg border border-[#263858] bg-[#0a1020]">
      <div className="absolute inset-0 star-field" />
      <div className="absolute inset-0">
        {backgroundStars.map((star) => (
          <span
            key={star.id}
            className="absolute rounded-full bg-[#c9d7ff]"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {links.map((link) => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);
          if (!source || !target) return null;
          const relevance = Math.max(0, Math.min(1, (Number(link.relevance) || 0) / maxRelevance));
          return (
            <line
              key={`${link.source}-${link.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="#66d9ff"
              strokeOpacity={0.06 + relevance * 0.46}
              strokeWidth={0.06 + relevance * 0.22}
            />
          );
        })}
      </svg>
      {positionedNodes.map((node) => {
        const active = selectedDocs.includes(node.id);
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onToggleDoc(node.id)}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3 py-2 text-left shadow-[0_0_28px_rgba(102,217,255,0.22)] transition ${
              active
                ? "border-[#f8c66d] bg-[#f8c66d] text-[#121827]"
                : "border-[#426080] bg-[#121d33]/90 text-[#f4efe5] hover:border-[#66d9ff]"
            }`}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              animation: `node-drift ${node.driftDuration} ease-in-out ${node.driftDelay} infinite alternate`,
            }}
          >
            <span className="block max-w-[130px] truncate text-xs font-semibold">{node.label}</span>
            <span className={active ? "text-[10px] text-[#493716]" : "text-[10px] text-[#9fb0c8]"}>
              {node.file_type} · {node.chunk_count || 0} chunks
            </span>
          </button>
        );
      })}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-[#2c4163] bg-[#0d1628]/85 px-3 py-2 text-xs text-[#aebbd2] backdrop-blur">
        <Network size={14} className="text-[#66d9ff]" />
        Relevance constellation
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || "");
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(userKey);
    return stored ? JSON.parse(stored) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", fullName: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatDraftName, setChatDraftName] = useState("");
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(true);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Chart your documents, select a constellation, then ask what your knowledge base knows.",
    },
  ]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const selectedDocNames = useMemo(() => {
    const ids = new Set(selectedDocs);
    return documents.filter((doc) => ids.has(doc._id)).map((doc) => doc.original_file_name);
  }, [documents, selectedDocs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isQuerying]);

  useEffect(() => {
    if (!token) return;
    refreshCurrentUser(token);
    refreshWorkspace(token);
  }, [token]);

  async function refreshCurrentUser(activeToken) {
    try {
      const data = await fetch(`${API_BASE}/me`, {
        headers: authHeaders(activeToken),
      }).then(readJson);
      setUser(data);
      localStorage.setItem(userKey, JSON.stringify(data));
    } catch {
      logout();
    }
  }

  async function refreshWorkspace(activeToken = token) {
    if (!activeToken) return;
    setStatus("Scanning constellation");
    try {
      const [docsData, graphData, chatsData] = await Promise.all([
        fetch(`${API_BASE}/all-docs`, { headers: authHeaders(activeToken) }).then(readJson),
        fetch(`${API_BASE}/knowledge-graph`, { headers: authHeaders(activeToken) }).then(readJson),
        fetch(`${API_BASE}/chats`, { headers: authHeaders(activeToken) }).then(readJson),
      ]);
      setDocuments(docsData);
      setGraph(graphData);
      setChats(chatsData);
      setSelectedDocs((current) => current.filter((id) => docsData.some((doc) => doc._id === id)));
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      let data;
      if (authMode === "register") {
        data = await fetch(`${API_BASE}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password,
            full_name: authForm.fullName || null,
          }),
        }).then(readJson);
      } else {
        const body = new URLSearchParams();
        body.set("username", authForm.email);
        body.set("password", authForm.password);
        data = await fetch(`${API_BASE}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        }).then(readJson);
      }
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem(tokenKey, data.access_token);
      localStorage.setItem(userKey, JSON.stringify(data.user));
      await refreshWorkspace(data.access_token);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setDocuments([]);
    setGraph({ nodes: [], links: [] });
    setSelectedDocs([]);
    setChats([]);
    setCurrentChatId(null);
    setChatDraftName("");
    setIsDocumentPanelOpen(true);
    setMessages([{ role: "assistant", content: "Sign in to reopen your knowledge constellation." }]);
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
  }

  function newInquiry() {
    setCurrentChatId(null);
    setChatDraftName("");
    setMessages([]);
    setQuery("");
  }

  function openChat(chat) {
    setCurrentChatId(chat._id);
    setChatDraftName(chat.chat_name || "");
    setSelectedDocs(chat.docs || []);
    setMessages(
      chat.previous_messages?.length
        ? chat.previous_messages
        : [{ role: "assistant", content: "Select stars and ask your next question." }],
    );
  }

  function queryHistoryFrom(currentMessages) {
    return currentMessages
      .filter((message) => ["user", "assistant"].includes(message.role) && message.content)
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  }

  async function createChatFromDraft(event) {
    event.preventDefault();
    const name = chatDraftName.trim();
    if (!name || selectedDocs.length === 0) {
      setStatus("Name the chat and select at least one document");
      return;
    }
    setStatus("");
    const chat = await fetch(`${API_BASE}/chats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: JSON.stringify({
        docs: selectedDocs,
        chat_name: name,
      }),
    }).then(readJson);
    setCurrentChatId(chat._id);
    setChats((current) => [chat, ...current]);
    setMessages([{ role: "assistant", content: "Ask a question about the selected documents." }]);
    setQuery("");
  }

  async function persistChat(chatId, nextMessages) {
    const chat = await fetch(`${API_BASE}/chats/${chatId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: JSON.stringify({
        docs: selectedDocs,
        previous_messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
          docs: message.docs || null,
        })),
      }),
    }).then(readJson);
    setChats((current) => current.map((item) => (item._id === chat._id ? chat : item)));
  }

  async function uploadFile(file) {
    if (!file || !token) return;
    setIsUploading(true);
    setStatus(`Launching ${file.name}`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: authHeaders(token),
        body: formData,
      }).then(readJson);
      if (data.error) throw new Error(data.error);
      setStatus(`${data.filename} entered orbit`);
      await refreshWorkspace();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function askQuestion(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isQuerying) return;
    if (!currentChatId) {
      setStatus("Create or open a chat before asking");
      return;
    }
    if (selectedDocs.length === 0) {
      setStatus("Select at least one star");
      return;
    }
    setQuery("");
    setIsQuerying(true);
    setStatus("");
    const history = queryHistoryFrom(messages);
    const userMessage = { role: "user", content: trimmed, docs: selectedDocNames };
    const pendingMessages = [...messages, userMessage];
    setMessages(pendingMessages);
    try {
      const data = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({ docs: selectedDocs, query: trimmed, chat_history: history }),
      }).then(readJson);
      const context = Array.isArray(data.context)
        ? data.context.map((chunk) => chunk.page_content || JSON.stringify(chunk, null, 2)).join("\n\n")
        : "";
      const assistantMessage = {
        role: "assistant",
        content: data.final_query || "No relevant signal was found in this constellation.",
        context,
      };
      const nextMessages = [...pendingMessages, assistantMessage];
      setMessages(nextMessages);
      await persistChat(currentChatId, nextMessages);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error.message }]);
    } finally {
      setIsQuerying(false);
    }
  }

  function toggleDoc(docId) {
    setSelectedDocs((current) =>
      current.includes(docId) ? current.filter((id) => id !== docId) : [...current, docId],
    );
  }

  if (!token || !user) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b16] text-[#f4efe5]">
        <div className="absolute inset-0 star-field" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(102,217,255,0.18),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(248,198,109,0.14),transparent_28%)]" />
        <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[1fr_420px]">
          <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-12">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#355174] bg-[#101a2e] text-[#66d9ff]">
                <Orbit size={21} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f8c66d]">Constellation Notes</p>
                <p className="text-xs text-[#9fb0c8]">Personal knowledge tracker</p>
              </div>
            </div>
            <div className="max-w-2xl py-16">
              <h1 className="text-4xl font-semibold leading-tight text-[#f4efe5] sm:text-5xl">
                Map your private knowledge into a living constellation.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#aebbd2]">
                Upload notes and documents, watch related material connect, and question only the
                sources you choose.
              </p>
            </div>
            
          </section>
          <section className="flex items-center px-5 py-8 sm:px-8">
            <form
              onSubmit={submitAuth}
              className="w-full rounded-lg border border-[#263858] bg-[#101a2e]/90 p-5 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur"
            >
              <div className="mb-5 flex rounded-lg bg-[#0a1020] p-1">
                {["login", "register"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthMode(mode)}
                    className={`h-10 flex-1 rounded-md text-sm font-medium capitalize transition ${
                      authMode === mode
                        ? "bg-[#f8c66d] text-[#121827]"
                        : "text-[#aebbd2] hover:bg-[#18253c]"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase text-[#9fb0c8]">Email</span>
                <input
                  className="h-11 w-full rounded-lg border border-[#304766] bg-[#090f1d] px-3 text-sm text-[#f4efe5]"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  required
                />
              </label>
              {authMode === "register" && (
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-[#9fb0c8]">Name</span>
                  <input
                    className="h-11 w-full rounded-lg border border-[#304766] bg-[#090f1d] px-3 text-sm text-[#f4efe5]"
                    value={authForm.fullName}
                    onChange={(event) => setAuthForm({ ...authForm, fullName: event.target.value })}
                  />
                </label>
              )}
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-semibold uppercase text-[#9fb0c8]">Password</span>
                <input
                  className="h-11 w-full rounded-lg border border-[#304766] bg-[#090f1d] px-3 text-sm text-[#f4efe5]"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  required
                  minLength={authMode === "register" ? 8 : undefined}
                />
              </label>
              {authError && <p className="mb-3 text-sm text-[#ff9c8d]">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f8c66d] px-4 text-sm font-semibold text-[#121827] transition hover:bg-[#ffd98e] disabled:opacity-60"
              >
                {authLoading && <Loader2 size={16} className="animate-spin" />}
                {authMode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const activeChat = chats.find((chat) => chat._id === currentChatId);

  return (
    <main className="grid h-screen grid-cols-1 overflow-hidden bg-[#070b16] text-[#f4efe5] lg:grid-cols-[280px_1fr_auto]">
      <aside className="flex min-h-0 flex-col border-r border-[#20324e] bg-[#0d1628]">
        <div className="border-b border-[#20324e] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#355174] bg-[#101f38] text-[#66d9ff]">
                <Orbit size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f8c66d]">Constellation Notes</p>
                <p className="text-xs text-[#9fb0c8]">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="grid h-9 w-9 place-items-center rounded-lg text-[#9fb0c8] hover:bg-[#16243b]"
            >
              <LogOut size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={newInquiry}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#355174] bg-[#101f38] text-sm font-semibold text-[#f4efe5] hover:border-[#66d9ff]"
          >
            <Plus size={17} />
            New chat
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#f4efe5]">Chats</h2>
          {chats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#355174] p-4 text-sm text-[#9fb0c8]">
              No chats yet.
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {chats.map((chat) => (
                <button
                  type="button"
                  key={chat._id}
                  onClick={() => openChat(chat)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    currentChatId === chat._id
                      ? "border-[#f8c66d] bg-[#1c2a3f] text-[#f4efe5]"
                      : "border-[#263858] bg-[#101a2e] text-[#aebbd2] hover:border-[#66d9ff]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare size={15} className="shrink-0 text-[#66d9ff]" />
                    <span className="block min-w-0 truncate font-medium">{chat.chat_name}</span>
                  </span>
                  <span className="mt-1 block text-xs text-[#7f8ca3]">
                    {chat.previous_messages?.filter((message) => message.role === "user").length || 0} prompts
                  </span>
                </button>
              ))}
            </div>
          )}
          {status && <p className="mt-3 text-xs text-[#f8c66d]">{status}</p>}
        </div>
      </aside>

      <section className="relative flex min-h-0 flex-col">
        <div className="absolute inset-0 star-field opacity-50" />
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#20324e] bg-[#0a1020]/80 px-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#f4efe5]">
              {activeChat?.chat_name || "Create chat"}
            </p>
            <p className="truncate text-xs text-[#9fb0c8]">
              {selectedDocs.length > 0 ? `${selectedDocs.length} stars selected` : "No star selected"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDocumentPanelOpen((current) => !current)}
            className="flex h-9 items-center gap-2 rounded-lg border border-[#263858] bg-[#101a2e] px-3 text-sm text-[#f4efe5] hover:border-[#66d9ff]"
          >
            <FolderOpen size={16} />
            Documents
          </button>
        </header>

        {!currentChatId ? (
          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-5xl space-y-5">
              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-semibold text-[#f4efe5]">New chat</h1>
                    <p className="mt-1 text-sm text-[#9fb0c8]">
                      {selectedDocs.length > 0 ? `${selectedDocs.length} documents selected` : "No documents selected"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshWorkspace()}
                    className="hidden h-9 items-center gap-2 rounded-lg border border-[#263858] bg-[#101a2e] px-3 text-sm text-[#f4efe5] hover:border-[#66d9ff] sm:flex"
                  >
                    <RefreshCw size={15} />
                    Rescan
                  </button>
                </div>
                <ConstellationGraph graph={graph} selectedDocs={selectedDocs} onToggleDoc={toggleDoc} />
              </section>

              <form
                onSubmit={createChatFromDraft}
                className="rounded-lg border border-[#263858] bg-[#101a2e] p-4"
              >
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase text-[#9fb0c8]">Chat name</span>
                  <input
                    value={chatDraftName}
                    onChange={(event) => setChatDraftName(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#304766] bg-[#090f1d] px-3 text-sm text-[#f4efe5]"
                    placeholder="Research notes"
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedDocNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-md border border-[#355174] bg-[#0a1020] px-2 py-1 text-xs text-[#aebbd2]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!chatDraftName.trim() || selectedDocs.length === 0}
                  className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-[#f8c66d] px-4 text-sm font-semibold text-[#121827] hover:bg-[#ffd98e] disabled:opacity-45"
                >
                  <MessageSquare size={16} />
                  Create chat
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto max-w-5xl space-y-5">
                <section>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-[#f4efe5]">Knowledge map</h1>
                      <p className="mt-1 text-sm text-[#9fb0c8]">
                        {selectedDocs.length > 0 ? `${selectedDocs.length} documents selected` : "No documents selected"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => refreshWorkspace()}
                      className="hidden h-9 items-center gap-2 rounded-lg border border-[#263858] bg-[#101a2e] px-3 text-sm text-[#f4efe5] hover:border-[#66d9ff] sm:flex"
                    >
                      <RefreshCw size={15} />
                      Rescan
                    </button>
                  </div>
                  <ConstellationGraph graph={graph} selectedDocs={selectedDocs} onToggleDoc={toggleDoc} />
                </section>

                <section className="space-y-5">
                  {messages.map((message, index) => (
                    <article
                      key={`${message.role}-${index}`}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#355174] bg-[#101f38] text-[#66d9ff]">
                          <Bot size={17} />
                        </div>
                      )}
                      <div
                        className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                          message.role === "user"
                            ? "bg-[#f8c66d] text-[#121827]"
                            : "border border-[#263858] bg-[#101a2e] text-[#f4efe5]"
                        }`}
                      >
                        {message.docs && (
                          <p className="mb-2 text-xs opacity-75">{message.docs.join(", ")}</p>
                        )}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.context && (
                          <details className="mt-3 rounded-md bg-[#0a1020] p-3 text-xs text-[#aebbd2]">
                            <summary className="cursor-pointer font-semibold text-[#66d9ff]">
                              Retrieved signal
                            </summary>
                            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-sans">
                              {message.context}
                            </pre>
                          </details>
                        )}
                      </div>
                      {message.role === "user" && (
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1c2a3f] text-[#f8c66d]">
                          <User size={17} />
                        </div>
                      )}
                    </article>
                  ))}
                  {isQuerying && (
                    <div className="flex items-center gap-3 text-sm text-[#9fb0c8]">
                      <Loader2 size={17} className="animate-spin" />
                      Reading selected stars
                    </div>
                  )}
                  <div ref={bottomRef} />
                </section>
              </div>
            </div>

            <form onSubmit={askQuestion} className="relative z-10 shrink-0 border-t border-[#20324e] bg-[#0a1020] p-4 sm:p-5">
              <div className="mx-auto max-w-5xl">
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedDocNames.slice(0, 3).map((name) => (
                    <span
                      key={name}
                      className="rounded-md border border-[#355174] bg-[#101a2e] px-2 py-1 text-xs text-[#aebbd2]"
                    >
                      {name}
                    </span>
                  ))}
                  {selectedDocNames.length > 3 && (
                    <span className="rounded-md bg-[#172640] px-2 py-1 text-xs text-[#aebbd2]">
                      +{selectedDocNames.length - 3}
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-2 rounded-lg border border-[#355174] bg-[#101a2e] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                  <textarea
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        askQuestion(event);
                      }
                    }}
                    placeholder="Ask the selected constellation"
                    rows={1}
                    className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#f4efe5] outline-none placeholder:text-[#7f8ca3]"
                  />
                  <button
                    type="submit"
                    disabled={isQuerying || !query.trim()}
                    title="Send message"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f8c66d] text-[#121827] hover:bg-[#ffd98e] disabled:opacity-45"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </section>

      <aside
        className={`min-h-0 border-l border-[#20324e] bg-[#0d1628] ${
          isDocumentPanelOpen ? "flex w-full flex-col lg:w-80" : "hidden"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#20324e] px-4">
          <div>
            <h2 className="text-sm font-semibold text-[#f4efe5]">Documents</h2>
            <p className="text-xs text-[#9fb0c8]">{documents.length} available</p>
          </div>
          <button
            type="button"
            onClick={() => setIsDocumentPanelOpen(false)}
            title="Close documents"
            className="grid h-8 w-8 place-items-center rounded-lg text-[#9fb0c8] hover:bg-[#16243b]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#f8c66d] text-sm font-semibold text-[#121827] hover:bg-[#ffd98e] disabled:opacity-60"
            >
              {isUploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
              Add document
            </button>
            <button
              type="button"
              onClick={() => refreshWorkspace()}
              title="Refresh constellation"
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#355174] text-[#9fb0c8] hover:bg-[#16243b]"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.md,.pdf"
            className="hidden"
            onChange={(event) => uploadFile(event.target.files?.[0])}
          />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {documents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#355174] p-4 text-sm text-[#9fb0c8]">
                No documents in orbit.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const active = selectedDocs.includes(doc._id);
                  return (
                    <button
                      type="button"
                      key={doc._id}
                      onClick={() => toggleDoc(doc._id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-[#f8c66d] bg-[#1c2a3f]"
                          : "border-[#263858] bg-[#101a2e] hover:border-[#66d9ff]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#172640] text-[#66d9ff]">
                          {active ? <Check size={15} /> : <FileText size={15} />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#f4efe5]">{doc.original_file_name}</p>
                          <p className="mt-1 text-xs uppercase text-[#9fb0c8]">{doc.file_type}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {status && <p className="mt-3 text-xs text-[#f8c66d]">{status}</p>}
        </div>
      </aside>
    </main>
  );
}

export default App;
