import { ArrowUp, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

const markdownComponents = {
  p: ({ node, ...props }) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
  a: ({ node, ...props }) => <a className="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-white/20 transition-colors" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1.5 text-white/70" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-white/70" {...props} />,
  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
  h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-white/90 mt-6 mb-3 uppercase tracking-wide" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-base font-semibold text-white/90 mt-5 mb-2 uppercase tracking-wide" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-sm font-semibold text-white/80 mt-4 mb-2 uppercase tracking-wide" {...props} />,
  code: ({ className, children, ...props }) => {
    const isBlock = /language-(\w+)/.test(className || "") || String(children).includes("\n");
    return isBlock ? (
      <code className={`font-mono text-[10px] text-white/70 ${className || ""}`} {...props}>{children}</code>
    ) : (
      <code className="bg-white/10 text-white/90 px-1.5 py-0.5 rounded-md font-mono text-[10px]" {...props}>{children}</code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre className="bg-black/50 border border-white/5 rounded-xl p-4 my-4 overflow-x-auto" {...props}>
      {children}
    </pre>
  ),
  strong: ({ node, ...props }) => <strong className="font-semibold text-white/90" {...props} />,
  blockquote: ({ node, ...props }) => <blockquote className="border-l-[3px] border-white/20 pl-4 py-1 my-4 text-white/50 italic bg-white/[0.02] rounded-r-lg" {...props} />,
};

function Message({ message }) {
  return (
    <article className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
        message.role === "user" ? "bg-white/90 text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]" : "border border-white/10 bg-white/5 text-white/80 backdrop-blur-md"
      }`}>
        {message.role === "user" ? <User size={12} /> : <Bot size={12} />}
      </div>

      <div className={`min-w-0 max-w-[85%] ${message.role === "user" ? "text-right" : "text-left"}`}>
        <div className="mb-1.5 flex items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-white/30 justify-end flex-row-reverse">
          {message.role === "assistant" && <span>[ SYS_NODE ]</span>}
          {message.role === "user" && <span>[ USR_INPUT ]</span>}
        </div>
        <div
          className={`inline-block rounded-2xl px-5 py-4 text-xs leading-relaxed glass-panel ${
            message.role === "user" ? "bg-white/5 text-white/90" : "bg-black/40 text-white/80"
          }`}
        >
          {message.docs && (
            <div className="mb-4 border-b border-white/5 pb-3 flex items-center gap-2 flex-wrap justify-end">
              <span className="font-mono text-[7px] uppercase text-white/30">TARGETS:</span>
              {message.docs.map((d) => (
                <span key={d} className="rounded px-2 py-1 bg-black/50 border border-white/5 font-mono text-[8px] text-white/40">{d}</span>
              ))}
            </div>
          )}
          <div className="whitespace-pre-wrap font-sans">
            {message.role === "user" ? (
              message.content
            ) : (
              <>
                <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
                {message.isStreaming && <span className="inline-block w-1.5 h-3 ml-1 bg-white/80 align-middle animate-pulse" />}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MessageList({ messages, isQuerying, bottomRef }) {
  return (
    <section className="space-y-6 pb-4">
      {messages.map((message, index) => (
        <Message key={`${message.role}-${index}`} message={message} />
      ))}
      {isQuerying && !messages[messages.length - 1]?.isStreaming && (
        <div className="flex items-center gap-3 rounded-full font-mono text-[9px] uppercase tracking-widest text-white/50 glass-panel px-4 py-2 w-max">
          <div className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse shadow-[0_0_8px_#fff]" />
          Parsing Data Vectors...
        </div>
      )}
      <div ref={bottomRef} />
    </section>
  );
}

export function Composer({
  query,
  setQuery,
  onSubmit,
  isQuerying,
  selectedDocNames,
  threshold,
  setThreshold,
}) {
  return (
    <form onSubmit={onSubmit} className="relative z-20 shrink-0 border-t border-white/5 glass-panel p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/30 mr-2">CTX:</span>
            {selectedDocNames.slice(0, 3).map((name) => (
              <span key={name} className="rounded-md border border-white/5 bg-white/5 px-2 py-1 font-mono text-[8px] uppercase text-white/50">
                {name}
              </span>
            ))}
            {selectedDocNames.length > 3 && (
              <span className="rounded-md border border-white/5 bg-transparent px-2 py-1 font-mono text-[8px] text-white/30">
                +{selectedDocNames.length - 3} MORE
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-48 rounded-lg glass-input px-3 py-2">
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/40 shrink-0">Threshold: {threshold}%</span>
            <input
              type="range"
              min="1"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="telemetry-slider"
            />
          </div>
        </div>

        <div className="flex items-end gap-3 rounded-2xl glass-input p-2">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit(event);
              }
            }}
            placeholder="INPUT QUERY..."
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 font-mono text-xs text-white/90 outline-none placeholder:text-white/20"
          />
          <button
            type="submit"
            disabled={isQuerying || !query.trim()}
            className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/20 disabled:opacity-20 transition-all shadow-[0_0_15px_rgba(255,255,255,0.02)]"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
