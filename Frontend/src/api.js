export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const TOKEN_KEY = "constellation_auth_token";
export const USER_KEY = "constellation_auth_user";

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function readJson(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function get(path, token) {
  return fetch(`${API_BASE}${path}`, { headers: authHeaders(token) }).then(readJson);
}

function postJson(path, token, body) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  }).then(readJson);
}

function patchJson(path, token, body) {
  return fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  }).then(readJson);
}

function del(path, token) {
  return fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }).then(readJson);
}

export function register({ email, password, fullName }) {
  return postJson("/register", null, { email, password, full_name: fullName || null });
}

export function login({ email, password }) {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  return fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).then(readJson);
}

export function getMe(token) {
  return get("/me", token);
}

export function getDocuments(token) {
  return get("/all-docs", token);
}

export function getKnowledgeGraph(token) {
  return get("/knowledge-graph", token);
}

export function getChats(token) {
  return get("/chats", token);
}

export function createChat(token, { docs, chatName }) {
  return postJson("/chats", token, { docs, chat_name: chatName });
}

export function updateChat(token, chatId, { docs, previousMessages }) {
  return patchJson(`/chats/${chatId}`, token, {
    docs,
    previous_messages: previousMessages,
  });
}

export function deleteChat(token, chatId) {
  return del(`/chats/${chatId}`, token);
}

export async function uploadDocument(token, file) {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  }).then(readJson);
}

export async function streamQuery(token, { docs, query, chatHistory, threshold }, onChunk) {
  const response = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({
      docs,
      query,
      chat_history: chatHistory,
      threshold: Number(threshold),
    }),
  });

  if (!response.ok) throw new Error("Stream connection failed");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    content += chunk;
    onChunk(content);
  }

  return content;
}

export function generateEvalSet(token, { numQuestions, docIds }) {
  return postJson("/eval/generate", token, {
    num_questions: numQuestions,
    doc_ids: docIds || null,
  });
}

export function getEvalQuestions(token) {
  return get("/eval/questions", token);
}

export function runEvaluation(token, { k, docIds }) {
  return postJson("/eval/run", token, { k, doc_ids: docIds || null });
}

export function getEvalRuns(token) {
  return get("/eval/runs", token);
}

export function getEvalRun(token, runId) {
  return get(`/eval/runs/${runId}`, token);
}
