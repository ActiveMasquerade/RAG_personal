import { MessageSquare, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChat,
  getChats,
  getDocuments,
  getKnowledgeGraph,
  streamQuery,
  updateChat,
  uploadDocument,
} from "../api.js";
import { ConstellationGraph } from "../components/ConstellationGraph.jsx";
import { Composer, MessageList } from "../components/ChatView.jsx";
import { DocumentPanel, DocumentPanelToggle } from "../components/DocumentPanel.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const IDLE_MESSAGE = { role: "assistant", content: "Select targets and input query." };

export function Workspace() {
  const { token, user, logout } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatDraftName, setChatDraftName] = useState("");
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(true);
  const [threshold, setThreshold] = useState(75);

  const [messages, setMessages] = useState([
    { role: "assistant", content: "SYSTEM ONLINE. Awaiting document selection and query parameters." },
  ]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    refreshWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshWorkspace() {
    if (!token) return;
    setStatus("SCANNING...");
    try {
      const [docsData, graphData, chatsData] = await Promise.all([
        getDocuments(token),
        getKnowledgeGraph(token),
        getChats(token),
      ]);
      setDocuments(docsData);
      setGraph(graphData);
      setChats(chatsData);
      setSelectedDocs((current) => current.filter((id) => docsData.some((doc) => doc._id === id)));
      setStatus("IDLE");
    } catch (error) {
      setStatus(`ERR: ${error.message.toUpperCase()}`);
    }
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
    setMessages(chat.previous_messages?.length ? chat.previous_messages : [IDLE_MESSAGE]);
  }

  function queryHistoryFrom(currentMessages) {
    return currentMessages
      .filter((message) => ["user", "assistant"].includes(message.role) && message.content)
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));
  }

  async function createChatFromDraft(event) {
    event.preventDefault();
    const name = chatDraftName.trim();
    if (!name || selectedDocs.length === 0) {
      setStatus("ERR: NAME REQUIRED / TARGETS MISSING");
      return;
    }
    setStatus("PROCESSING...");
    try {
      const chat = await createChat(token, { docs: selectedDocs, chatName: name });
      setCurrentChatId(chat._id);
      setChats((current) => [chat, ...current]);
      setMessages([{ role: "assistant", content: `SESSION '${name.toUpperCase()}' INITIALIZED.` }]);
      setQuery("");
      setStatus("IDLE");
    } catch (error) {
      setStatus(`ERR: ${error.message.toUpperCase()}`);
    }
  }

  async function persistChat(chatId, nextMessages) {
    const chat = await updateChat(token, chatId, {
      docs: selectedDocs,
      previousMessages: nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
        docs: message.docs || null,
      })),
    });
    setChats((current) => current.map((item) => (item._id === chat._id ? chat : item)));
  }

  async function uploadFile(file) {
    if (!file || !token) return;
    setIsUploading(true);
    setStatus(`UPLOADING: ${file.name}`);
    try {
      const data = await uploadDocument(token, file);
      if (data.error) throw new Error(data.error);
      setStatus(`SUCCESS: ${data.filename}`);
      await refreshWorkspace();
    } catch (error) {
      setStatus(`ERR: ${error.message.toUpperCase()}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function askQuestion(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isQuerying) return;
    if (!currentChatId) {
      setStatus("ERR: NO ACTIVE SESSION");
      return;
    }
    if (selectedDocs.length === 0) {
      setStatus("ERR: NO TARGETS SELECTED");
      return;
    }

    setQuery("");
    setIsQuerying(true);
    setStatus("ANALYZING...");

    const history = queryHistoryFrom(messages);
    const userMessage = { role: "user", content: trimmed, docs: selectedDocNames };
    const pendingMessages = [...messages, userMessage];

    setMessages([...pendingMessages, { role: "assistant", content: "", isStreaming: true }]);

    try {
      const assistantContent = await streamQuery(
        token,
        { docs: selectedDocs, query: trimmed, chatHistory: history, threshold },
        (content) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content, isStreaming: true };
            return next;
          });
        },
      );

      const finalMessages = [...pendingMessages, { role: "assistant", content: assistantContent }];
      setMessages(finalMessages);
      await persistChat(currentChatId, finalMessages);
      setStatus("IDLE");
    } catch (error) {
      setMessages((current) => {
        const safeMessages = [...current];
        safeMessages[safeMessages.length - 1] = { role: "assistant", content: `ERR: ${error.message.toUpperCase()}` };
        return safeMessages;
      });
      setStatus("ERR: QUERY FAILED");
    } finally {
      setIsQuerying(false);
    }
  }

  function toggleDoc(docId) {
    setSelectedDocs((current) => (current.includes(docId) ? current.filter((id) => id !== docId) : [...current, docId]));
  }

  const activeChat = chats.find((chat) => chat._id === currentChatId);

  return (
    <main className="relative grid h-screen grid-cols-1 overflow-hidden text-neutral-200 lg:grid-cols-[280px_1fr_auto]">
      <div className="telemetry-grid" />

      <Sidebar
        user={user}
        chats={chats}
        currentChatId={currentChatId}
        onOpenChat={openChat}
        onNewChat={newInquiry}
        onLogout={logout}
        status={status}
      />

      <section className="relative flex min-h-0 flex-col z-10">
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/5 glass-panel px-4 sm:px-6">
          <div className="min-w-0 flex items-center gap-4">
            <div className="w-1.5 h-1.5 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            <h1 className="truncate text-[10px] font-semibold uppercase tracking-widest text-white/80">
              {activeChat?.chat_name || "Unassigned Session"}
            </h1>
            <span className="rounded-full border border-white/5 bg-black/40 px-3 py-1 font-mono text-[8px] text-white/50">
              TGT: {selectedDocs.length}
            </span>
          </div>
          <DocumentPanelToggle onClick={() => setIsDocumentPanelOpen((current) => !current)} />
        </header>

        {!currentChatId ? (
          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
            <div className="mx-auto max-w-5xl space-y-8">
              <TopologySection graph={graph} selectedDocs={selectedDocs} onToggleDoc={toggleDoc} onRescan={refreshWorkspace} />

              <form onSubmit={createChatFromDraft} className="glass-panel rounded-2xl p-6 relative">
                <label className="block relative z-10">
                  <span className="mb-3 ml-1 block text-[9px] font-semibold uppercase tracking-widest text-white/40">Session Designation</span>
                  <input
                    value={chatDraftName}
                    onChange={(event) => setChatDraftName(event.target.value)}
                    className="h-12 w-full rounded-xl glass-input px-4 font-mono text-xs text-white focus:outline-none placeholder:text-white/20"
                    placeholder="E.G., THESIS_RESEARCH_01"
                  />
                </label>
                <div className="mt-5 flex flex-wrap gap-2 relative z-10">
                  {selectedDocNames.map((name) => (
                    <span key={name} className="rounded-lg border border-white/5 bg-black/50 px-3 py-1.5 font-mono text-[8px] uppercase text-white/50 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-white/30" />
                      {name}
                    </span>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!chatDraftName.trim() || selectedDocs.length === 0}
                  className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-6 text-[10px] font-bold uppercase tracking-widest text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.02)]"
                >
                  <MessageSquare size={14} />
                  Initialize Session
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
              <div className="mx-auto max-w-5xl space-y-8">
                <TopologySection graph={graph} selectedDocs={selectedDocs} onToggleDoc={toggleDoc} onRescan={refreshWorkspace} />
                <MessageList messages={messages} isQuerying={isQuerying} bottomRef={bottomRef} />
              </div>
            </div>

            <Composer
              query={query}
              setQuery={setQuery}
              onSubmit={askQuestion}
              isQuerying={isQuerying}
              selectedDocNames={selectedDocNames}
              threshold={threshold}
              setThreshold={setThreshold}
            />
          </>
        )}
      </section>

      <DocumentPanel
        isOpen={isDocumentPanelOpen}
        onClose={() => setIsDocumentPanelOpen(false)}
        documents={documents}
        selectedDocs={selectedDocs}
        onToggleDoc={toggleDoc}
        onUpload={uploadFile}
        isUploading={isUploading}
      />
    </main>
  );
}

function TopologySection({ graph, selectedDocs, onToggleDoc, onRescan }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3 px-1">
        <h2 className="text-[9px] font-semibold uppercase tracking-widest text-white/40 flex items-center gap-2">
          Topology Map
        </h2>
        <button
          type="button"
          onClick={onRescan}
          className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/70 transition"
        >
          <RefreshCw size={10} />
          Rescan
        </button>
      </div>
      <ConstellationGraph graph={graph} selectedDocs={selectedDocs} onToggleDoc={onToggleDoc} />
    </section>
  );
}
