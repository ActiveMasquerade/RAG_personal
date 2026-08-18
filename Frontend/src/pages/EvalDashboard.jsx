import { ArrowLeft, CircleCheck, CircleX, FlaskConical, ListChecks, Play, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  generateEvalSet,
  getDocuments,
  getEvalQuestions,
  getEvalRun,
  getEvalRuns,
  runEvaluation,
} from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

function StatTile({ label, value }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-white/90">{value}</p>
    </div>
  );
}

function formatPct(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function RunHistorySparkline({ runs }) {
  if (runs.length < 2) return null;
  const ordered = [...runs].reverse();
  const width = 100;
  const height = 32;
  const points = ordered.map((run, index) => {
    const x = ordered.length === 1 ? 0 : (index / (ordered.length - 1)) * width;
    const y = height - run.hit_rate * height;
    return { x, y, run };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  return (
    <svg viewBox={`0 -4 ${width} ${height + 8}`} className="h-16 w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, index) => (
        <circle key={index} cx={p.x} cy={p.y} r="1.6" fill="#60A5FA" vectorEffect="non-scaling-stroke">
          <title>{`${new Date(p.run.created_at).toLocaleString()} — hit rate ${formatPct(p.run.hit_rate)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function EvalDashboard() {
  const { token, user } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [latestRun, setLatestRun] = useState(null);

  const [numQuestions, setNumQuestions] = useState(10);
  const [k, setK] = useState(5);
  const [scopeDocIds, setScopeDocIds] = useState([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshAll() {
    try {
      const [docsData, questionsData, runsData] = await Promise.all([
        getDocuments(token),
        getEvalQuestions(token),
        getEvalRuns(token),
      ]);
      setDocuments(docsData);
      setQuestions(questionsData);
      setRuns(runsData);
      if (runsData.length > 0) {
        const detail = await getEvalRun(token, runsData[0]._id);
        setLatestRun(detail);
      }
    } catch (error) {
      setStatus(`ERR: ${error.message.toUpperCase()}`);
    }
  }

  function toggleScopeDoc(docId) {
    setScopeDocIds((current) => (current.includes(docId) ? current.filter((id) => id !== docId) : [...current, docId]));
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setStatus("GENERATING GOLDEN SET...");
    try {
      await generateEvalSet(token, { numQuestions: Number(numQuestions), docIds: scopeDocIds });
      const questionsData = await getEvalQuestions(token);
      setQuestions(questionsData);
      setStatus("IDLE");
    } catch (error) {
      setStatus(`ERR: ${error.message.toUpperCase()}`);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRun() {
    setIsRunning(true);
    setStatus("RUNNING EVALUATION...");
    try {
      const run = await runEvaluation(token, { k: Number(k), docIds: scopeDocIds });
      setLatestRun(run);
      const runsData = await getEvalRuns(token);
      setRuns(runsData);
      setStatus("IDLE");
    } catch (error) {
      setStatus(`ERR: ${error.message.toUpperCase()}`);
    } finally {
      setIsRunning(false);
    }
  }

  const documentNameById = useMemo(() => {
    const map = new Map();
    for (const doc of documents) map.set(doc._id, doc.original_file_name);
    return map;
  }, [documents]);

  if (!token || !user) return null;

  return (
    <main className="relative min-h-screen overflow-hidden text-neutral-200">
      <div className="telemetry-grid" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 border border-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.02)]">
              <FlaskConical size={16} className="text-white/70" />
            </div>
            <div>
              <h1 className="text-[10px] font-semibold uppercase tracking-widest text-white/80">Evaluation Dashboard</h1>
              <p className="font-mono text-[8px] text-white/30 mt-0.5">Retrieval quality against an auto-generated golden set</p>
            </div>
          </div>
          <Link
            to="/"
            className="flex h-9 items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 text-[9px] font-semibold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft size={12} />
            Workspace
          </Link>
        </header>

        {documents.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center font-mono text-[10px] uppercase text-white/40">
            [ NO DOCUMENTS INGESTED — upload something in the workspace first ]
          </div>
        ) : (
          <div className="space-y-8">
            <section className="glass-panel rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={14} className="text-white/60" />
                <h2 className="text-[9px] font-semibold uppercase tracking-widest text-white/60">Scope (optional — leave empty to use all documents)</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc) => {
                  const active = scopeDocIds.includes(doc._id);
                  return (
                    <button
                      key={doc._id}
                      type="button"
                      onClick={() => toggleScopeDoc(doc._id)}
                      className={`rounded-lg border px-3 py-1.5 font-mono text-[9px] uppercase transition-colors ${
                        active ? "border-white/20 bg-white/10 text-white" : "border-white/5 bg-black/30 text-white/40 hover:text-white/70"
                      }`}
                    >
                      {doc.original_file_name}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="glass-panel rounded-2xl p-6">
                <h2 className="mb-4 text-[9px] font-semibold uppercase tracking-widest text-white/60">Golden Set</h2>
                <label className="mb-4 block">
                  <span className="mb-2 block text-[9px] font-semibold uppercase tracking-widest text-white/40">Questions to generate</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numQuestions}
                    onChange={(event) => setNumQuestions(event.target.value)}
                    className="h-10 w-full rounded-xl glass-input px-4 font-mono text-xs text-white outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <Sparkles size={13} />
                  {isGenerating ? "Generating..." : "Generate Golden Set"}
                </button>
                <p className="mt-3 font-mono text-[8px] uppercase text-white/30">{questions.length} question(s) stored</p>
              </section>

              <section className="glass-panel rounded-2xl p-6">
                <h2 className="mb-4 text-[9px] font-semibold uppercase tracking-widest text-white/60">Run Evaluation</h2>
                <label className="mb-4 block">
                  <span className="mb-2 block text-[9px] font-semibold uppercase tracking-widest text-white/40">k (top results considered)</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={k}
                    onChange={(event) => setK(event.target.value)}
                    className="h-10 w-full rounded-xl glass-input px-4 font-mono text-xs text-white outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isRunning || questions.length === 0}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <Play size={13} />
                  {isRunning ? "Running..." : "Run Evaluation"}
                </button>
                {questions.length === 0 && (
                  <p className="mt-3 font-mono text-[8px] uppercase text-white/30">Generate a golden set first.</p>
                )}
              </section>
            </div>

            {status && (
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">{status}</p>
            )}

            {latestRun && (
              <section className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatTile label="Hit Rate" value={formatPct(latestRun.hit_rate)} />
                  <StatTile label="MRR" value={latestRun.mrr.toFixed(2)} />
                  <StatTile label={`Precision@${latestRun.k}`} value={formatPct(latestRun.precision_at_k)} />
                  <StatTile label={`Recall@${latestRun.k}`} value={formatPct(latestRun.recall_at_k)} />
                </div>

                {runs.length > 1 && (
                  <div className="glass-panel rounded-2xl p-6">
                    <h2 className="mb-3 text-[9px] font-semibold uppercase tracking-widest text-white/40">Hit Rate Trend</h2>
                    <RunHistorySparkline runs={runs} />
                  </div>
                )}

                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-white/5 px-6 py-4">
                    <ListChecks size={14} className="text-white/50" />
                    <h2 className="text-[9px] font-semibold uppercase tracking-widest text-white/60">Latest Run — Per-Query Results</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-[8px] uppercase tracking-widest text-white/30">
                          <th className="px-6 py-3 font-semibold">Query</th>
                          <th className="px-4 py-3 font-semibold">Expected Doc</th>
                          <th className="px-4 py-3 font-semibold">Retrieved Docs</th>
                          <th className="px-4 py-3 font-semibold">RR</th>
                          <th className="px-4 py-3 font-semibold">Hit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestRun.results.map((result, index) => (
                          <tr key={index} className="border-b border-white/5 last:border-0">
                            <td className="max-w-xs truncate px-6 py-3 text-white/80">{result.query}</td>
                            <td className="px-4 py-3 font-mono text-[10px] text-white/50">
                              {documentNameById.get(result.expected_document_id) || result.expected_document_id}
                            </td>
                            <td className="px-4 py-3 font-mono text-[10px] text-white/40">
                              {result.retrieved_document_ids.length}
                            </td>
                            <td className="px-4 py-3 font-mono text-[10px] text-white/50">{result.reciprocal_rank.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              {result.hit ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <CircleCheck size={13} /> hit
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-400">
                                  <CircleX size={13} /> miss
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {runs.length > 0 && (
              <section className="glass-panel rounded-2xl overflow-hidden">
                <div className="border-b border-white/5 px-6 py-4">
                  <h2 className="text-[9px] font-semibold uppercase tracking-widest text-white/60">Run History</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-[8px] uppercase tracking-widest text-white/30">
                        <th className="px-6 py-3 font-semibold">When</th>
                        <th className="px-4 py-3 font-semibold">k</th>
                        <th className="px-4 py-3 font-semibold">Questions</th>
                        <th className="px-4 py-3 font-semibold">Hit Rate</th>
                        <th className="px-4 py-3 font-semibold">MRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr key={run._id} className="border-b border-white/5 last:border-0">
                          <td className="px-6 py-3 font-mono text-[10px] text-white/60">{new Date(run.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-white/50">{run.k}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-white/50">{run.num_questions}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-white/80">{formatPct(run.hit_rate)}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-white/80">{run.mrr.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
