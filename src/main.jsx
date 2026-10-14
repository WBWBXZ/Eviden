import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronRight,
  FileText,
  Route,
  Send,
  Square,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import './styles.css';

const sampleResume = `胥哲｜产品运营 / AI 产品方向

字节跳动 TikTok 商业化产品运营
- 负责 TTMS 区域产品运营，基于销售反馈和市场使用数据沉淀 Product Feedback，推动需求优先级评估与产品迭代落地。
- 参与 Aiva Agent、Content Copilot、AI Workflow 等 AI 能力迭代，围绕准确率、可用性和业务场景设计优化方向。
- 排查 Dashboard 数据异常，结合指标归因、销售口径和脚本逻辑定位问题并同步业务方。

项目经历
- Aiva Agent：推动从 Q&A 向 Agent 能力演进，优化知识库、Prompt 和多轮对话记忆。
- TTMS：支持欧洲市场商业化产品运营，协同销售、产品和区域 POC 处理需求反馈。`;

const sampleJD = `AI 产品经理实习生

岗位职责：
- 基于用户需求和业务场景定义、迭代 AI 产品功能。
- 与研发、运营协作，持续优化 LLM / Agent 工作流体验。
- 分析用户反馈和产品指标，识别机会点并推动落地。
- 输出 PRD、产品方案和跨团队推进材料。

任职要求：
- 具备结构化思考和产品判断能力。
- 有 AI 产品、Agent、Prompt Engineering 或 LLM 应用经验优先。
- 具备数据分析能力，有 SQL 经验优先。
- 有用户研究、客户沟通或商业化场景经验加分。`;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const HISTORY_KEY = 'eviden.analysis.history.v1';
const HISTORY_OWNER_KEY = 'eviden.analysis.history.owner.v1';
const AUTH_TOKEN_KEY = 'eviden.auth.token.v1';
const AUTH_USER_KEY = 'eviden.auth.user.v1';
const DELETED_REPORTS_KEY = 'eviden.deleted.reports.v1';
const DEFAULT_RESUME_KEY_PREFIX = 'eviden.default-resume.v1';
const PENDING_ANALYSIS_KEY = 'eviden.pending-analysis.v1';
const SCREENING_HISTORY_KEY = 'eviden.screening.history.v1';
const SCREENING_HISTORY_OWNER_KEY = 'eviden.screening.history.owner.v1';
const REWRITE_HISTORY_KEY = 'eviden.rewrite.history.v1';
const REWRITE_HISTORY_OWNER_KEY = 'eviden.rewrite.history.owner.v1';
const COPILOT_MESSAGES_KEY_PREFIX = 'eviden.copilot.messages.v2';
const COPILOT_MEMORY_KEY_PREFIX = 'eviden.copilot.memory.v1';
const APPLICATIONS_KEY_PREFIX = 'eviden.applications.v1';
const APPLICATION_STATUSES = [
  { id: 'not_applied', label: '待投递' },
  { id: 'preparing', label: '准备中' },
  { id: 'applied', label: '已投递' },
  { id: 'interviewing', label: '面试中' },
  { id: 'offered', label: '已录用' },
  { id: 'rejected', label: '未通过' },
];

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function defaultResumeCacheKey(userId) {
  return `${DEFAULT_RESUME_KEY_PREFIX}.${encodeURIComponent(String(userId))}`;
}

function copilotStorageKey(prefix, userId) {
  return `${prefix}.${encodeURIComponent(String(userId || 'guest'))}`;
}

function applicationsStorageKey(userId) {
  return `${APPLICATIONS_KEY_PREFIX}.${encodeURIComponent(String(userId || 'guest'))}`;
}

function getStoredApplications(userId) {
  const stored = safeParse(localStorage.getItem(applicationsStorageKey(userId)), []);
  return Array.isArray(stored) ? stored.filter(item => item?.id && item?.target) : [];
}

function persistApplications(userId, records) {
  localStorage.setItem(applicationsStorageKey(userId), JSON.stringify(records.slice(0, 100)));
}

function applicationStatusLabel(status) {
  return APPLICATION_STATUSES.find(item => item.id === status)?.label || '待投递';
}

function normalizeDefaultResume(value) {
  if (!value || typeof value !== 'object' || !String(value.resume_text || '').trim()) return null;
  const resumeText = String(value.resume_text);
  return {
    filename: String(value.filename || '默认简历'),
    resume_text: resumeText,
    char_count: Number(value.char_count) || resumeText.length,
    preview: String(value.preview || shortText(resumeText, 240)),
    updated_at: value.updated_at || new Date().toISOString(),
  };
}

function defaultResumeUpdatedAtMs(resume) {
  const value = resume?.updated_at;
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCachedDefaultResume(userId) {
  if (!userId) return null;
  try {
    return normalizeDefaultResume(JSON.parse(localStorage.getItem(defaultResumeCacheKey(userId)) || 'null'));
  } catch {
    return null;
  }
}

function persistDefaultResume(userId, resume) {
  if (!userId) return;
  const key = defaultResumeCacheKey(userId);
  if (resume) localStorage.setItem(key, JSON.stringify(resume));
  else localStorage.removeItem(key);
}

function getStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item?.kind !== 'screening' && item?.result) : [];
  } catch {
    return [];
  }
}

function persistHistory(records, ownerId) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 30)));
  if (ownerId) localStorage.setItem(HISTORY_OWNER_KEY, String(ownerId));
}

function getHistoryForUser(userId) {
  const ownerId = localStorage.getItem(HISTORY_OWNER_KEY);
  if (ownerId && ownerId !== String(userId)) return [];
  return getStoredHistory();
}

function getScreeningHistoryForUser(userId) {
  const ownerId = localStorage.getItem(SCREENING_HISTORY_OWNER_KEY);
  if (ownerId && ownerId !== String(userId)) return [];
  const parsed = safeParse(localStorage.getItem(SCREENING_HISTORY_KEY), []);
  return Array.isArray(parsed) ? parsed.filter(item => item?.kind === 'screening' && Array.isArray(item?.results)) : [];
}

function persistScreeningHistory(records, ownerId) {
  localStorage.setItem(SCREENING_HISTORY_KEY, JSON.stringify(records.slice(0, 20)));
  if (ownerId) localStorage.setItem(SCREENING_HISTORY_OWNER_KEY, String(ownerId));
}

function getRewriteHistoryForUser(userId) {
  const ownerId = localStorage.getItem(REWRITE_HISTORY_OWNER_KEY);
  if (ownerId && ownerId !== String(userId)) return [];
  const parsed = safeParse(localStorage.getItem(REWRITE_HISTORY_KEY), []);
  return Array.isArray(parsed) ? parsed.filter(item => item?.kind === 'rewrite' && item?.result) : [];
}

function persistRewriteHistory(records, ownerId) {
  localStorage.setItem(REWRITE_HISTORY_KEY, JSON.stringify(records.slice(0, 20)));
  if (ownerId) localStorage.setItem(REWRITE_HISTORY_OWNER_KEY, String(ownerId));
}

function getDeletedReportIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(DELETED_REPORTS_KEY) || '[]');
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function markReportDeleted(id) {
  const ids = getDeletedReportIds();
  ids.add(id);
  localStorage.setItem(DELETED_REPORTS_KEY, JSON.stringify(Array.from(ids).slice(-100)));
}

function getStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
    return user && user.id && user.phone ? user : null;
  } catch {
    return null;
  }
}

async function apiJson(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    const error = new Error('服务连接暂时波动，正在自动重试');
    error.transient = true;
    error.cause = cause;
    throw error;
  }
  if (!response.ok) {
    let message = '请求暂时没有完成，请稍后重试';
    try {
      const data = await response.json();
      message = typeof data.detail === 'string' ? data.detail : message;
    } catch {
      // Keep default message.
    }
    const error = new Error(message);
    error.status = response.status;
    error.transient = response.status === 404 || response.status === 408 || response.status === 429 || response.status >= 500;
    throw error;
  }
  if (response.status === 204) return null;
  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : null;
}

const authLogin = (payload) => apiJson('/api/auth/login', { method: 'POST', body: payload });
const authRegister = (payload) => apiJson('/api/auth/register', { method: 'POST', body: payload });
const authMe = (token) => apiJson('/api/auth/me', { token });
const fetchCloudReports = async (token) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    return await apiJson('/api/reports', { token, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('云端报告同步超时');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};
const saveCloudReport = (token, record) => apiJson('/api/reports', { method: 'POST', token, body: { id: record.id, record } });
const deleteCloudReport = (token, id) => apiJson(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE', token });
const fetchDefaultResume = (token, signal) => apiJson('/api/default-resume', { token, signal });
const requestDefaultResumeMutation = async (token, method, body) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60000);
  try {
    return await apiJson('/api/default-resume', { method, token, body, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('云端默认简历同步超时');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};
const saveDefaultResume = (token, resume) => requestDefaultResumeMutation(token, 'PUT', {
  filename: resume.filename,
  resume_text: resume.resume_text,
});
const deleteDefaultResume = (token) => requestDefaultResumeMutation(token, 'DELETE');
const deleteCloudReportWithRetry = async (token, id) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await deleteCloudReport(token, id);
    } catch (error) {
      lastError = error;
      if (error.status === 401) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
};

function shortText(text, length = 82) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  return cleaned.length > length ? `${cleaned.slice(0, length)}…` : cleaned;
}

function cleanResumeBulletAfter(value) {
  const text = String(value || '').trim();
  const cleaned = text
    .replace(/[，；。]?\s*(?:体现|展现|彰显)(?:了)?[^，；。]{0,60}[。]?$/, '')
    .replace(/[，；。]?\s*(?:为(?:数据驱动优化|产品定位|后续迭代)提供(?:基础|参考|依据)|(?:显著)?(?:改善|提升)(?:核心)?体验|保障项目交付|确保核心功能可用|验证优化方案有效性)[。]?$/, '')
    .replace(/[，；。\s]+$/, '');
  return cleaned && text.endsWith('。') ? `${cleaned}。` : cleaned || text;
}

function rewriteSimilarity(before, after) {
  const normalize = value => String(value || '').replace(/[\s，。；：、（）()【】\[\]·｜|—–-]/g, '').toLowerCase();
  const left = normalize(before);
  const right = normalize(after);
  if (!left || !right) return 1;
  if (left === right) return 1;
  const bigrams = value => {
    const counts = new Map();
    for (let index = 0; index < value.length - 1; index += 1) {
      const part = value.slice(index, index + 2);
      counts.set(part, (counts.get(part) || 0) + 1);
    }
    return counts;
  };
  const leftParts = bigrams(left);
  const rightParts = bigrams(right);
  let overlap = 0;
  leftParts.forEach((count, part) => { overlap += Math.min(count, rightParts.get(part) || 0); });
  return (2 * overlap) / Math.max(1, left.length + right.length - 2);
}

function materialRewriteBullets(bullets) {
  const scored = (bullets || []).map((item, index) => ({
    index,
    item,
    similarity: item?.before && item?.after ? rewriteSimilarity(item.before, cleanResumeBulletAfter(item.after)) : 1,
  })).filter(entry => entry.similarity < 0.995);
  const selected = new Set(scored.filter(entry => entry.similarity < 0.88).map(entry => entry.index));
  const minimum = Math.min(5, scored.length);
  scored.slice().sort((left, right) => left.similarity - right.similarity).forEach(entry => {
    if (selected.size < minimum) selected.add(entry.index);
  });
  return scored.filter(entry => selected.has(entry.index)).map(entry => entry.item);
}

function makeHistoryRecord(result, input) {
  const resumeName = input.resumeFileName || result.resumeName || '当前上传简历';
  const company = input.company || '';
  const businessUnit = input.businessUnit || '';
  const contextParts = [company, businessUnit, input.target].filter(Boolean);
  const jdName = result.jdName || `${contextParts.join(' · ') || input.target}（当前 JD）`;
  const normalizedResult = { ...result, resumeName, jdName };
  return {
    id: `report-${Date.now()}`,
    createdAt: new Date().toISOString(),
    target: input.target,
    company,
    businessUnit,
    resumeName,
    jdName,
    resumeText: input.resume,
    jdText: input.jd,
    resumeSnippet: shortText(input.resume),
    jdSnippet: shortText(input.jd),
    result: normalizedResult,
  };
}

function formatDate(value) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const normalizedValue = Number.isFinite(numericValue) && numericValue > 0 && numericValue < 1e12
    ? numericValue * 1000
    : value;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function requestModelJson(path, body, fallbackMessage) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptStartedAt = Date.now();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 150000);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.ok) return response.json();

      let message = fallbackMessage;
      try {
        const data = await response.json();
        message = typeof data.detail === 'string' ? data.detail : message;
      } catch {
        // Keep the user-facing fallback when the backend does not return JSON.
      }
      const error = new Error(message);
      error.status = response.status;
      if (![502, 504].includes(response.status) || attempt === 1) throw error;
      lastError = error;
    } catch (error) {
      const requestRanLong = Date.now() - attemptStartedAt > 60000;
      if (error.status || attempt === 1 || requestRanLong) {
        if (!error.status) throw new Error('生成服务连接超时，请重新生成。');
        throw error;
      }
      lastError = error;
    } finally {
      window.clearTimeout(timer);
    }
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw lastError || new Error(fallbackMessage);
}

const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function analysisApi(path, options, maxAttempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await apiJson(path, options);
    } catch (error) {
      lastError = error;
      if (!error.transient || error.status === 401 || error.status === 403 || attempt === maxAttempts - 1) throw error;
      await wait(Math.min(1000 * (2 ** attempt), 8000));
    }
  }
  throw lastError;
}

async function pollAnalysisJob(jobId, token) {
  let consecutiveErrors = 0;
  for (;;) {
    try {
      const job = await analysisApi(`/api/analysis-jobs/${encodeURIComponent(jobId)}`, { token }, 3);
      consecutiveErrors = 0;
      if (job.status === 'completed' && job.result) return job.result;
      if (job.status === 'failed') {
        const failure = new Error('报告生成暂时中断，正在自动重新生成');
        failure.jobFailed = true;
        throw failure;
      }
    } catch (error) {
      if (error.jobFailed || error.status === 401 || error.status === 403) throw error;
      consecutiveErrors += 1;
      if (error.status === 404 && consecutiveErrors >= 3) {
        const missing = new Error('正在重新连接后台任务');
        missing.jobMissing = true;
        throw missing;
      }
      if (consecutiveErrors % 10 === 0) console.warn('analysis progress check is retrying', error);
    }
    await wait(Math.min(2000 + consecutiveErrors * 500, 10000));
  }
}

async function requestAnalysis(input, token, pendingTask = null) {
  const requestId = pendingTask?.requestId || createRequestId();
  const body = {
    resume: input.resume,
    jd: input.jd,
    target: input.target,
    company: input.company,
    business_unit: input.businessUnit,
    client_request_id: requestId,
  };
  const pending = { requestId, jobId: pendingTask?.jobId || '', input };
  localStorage.setItem(PENDING_ANALYSIS_KEY, JSON.stringify(pending));

  for (let run = 0; run < 2; run += 1) {
    const job = await analysisApi('/api/analysis-jobs', { method: 'POST', token, body }, 6);
    pending.jobId = job.job_id;
    localStorage.setItem(PENDING_ANALYSIS_KEY, JSON.stringify(pending));
    try {
      const result = await pollAnalysisJob(job.job_id, token);
      localStorage.removeItem(PENDING_ANALYSIS_KEY);
      return result;
    } catch (error) {
      if ((!error.jobFailed && !error.jobMissing) || run === 1) throw error;
      await wait(1200);
    }
  }
  throw new Error('报告仍在后台生成，请稍后回到此页查看');
}

function friendlyAnalysisError(error) {
  if (error?.status === 401 || error?.status === 403) return '登录状态已过期，请重新登录后继续生成';
  if (error?.jobFailed) return '生成服务刚刚中断了一次，任务已保留，点击生成报告即可继续';
  return '当前连接不稳定，任务已保留。网络恢复后重新进入此页会自动继续';
}

async function resumePendingAnalysis(token) {
  const pending = safeParse(localStorage.getItem(PENDING_ANALYSIS_KEY), null);
  if (!pending?.input) return null;
  const result = pending.jobId
    ? await pollAnalysisJob(pending.jobId, token).catch(error => {
      if (error.jobFailed || error.jobMissing || error.status === 404) return requestAnalysis(pending.input, token, pending);
      throw error;
    })
    : await requestAnalysis(pending.input, token, pending);
  localStorage.removeItem(PENDING_ANALYSIS_KEY);
  return { result, input: pending.input };
}

async function requestJobScreening({ resume, jobs }) {
  return requestModelJson('/api/screen-jobs', {
    resume,
    jds: jobs.map(job => ({ title: job.title, company: job.company, business_unit: job.businessUnit, jd: job.jd })),
  }, '岗位筛选暂时没有完成，请重新生成。');
}

async function requestResumeParse(file) {
  if (file.size > 8 * 1024 * 1024) throw new Error('文件过大，请上传 8MB 以内的简历。');
  const contentBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',', 2)[1] || '');
    reader.onerror = () => reject(new Error('简历文件读取失败，请重新选择文件。'));
    reader.readAsDataURL(file);
  });
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 90000);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/parse-resume-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, content_base64: contentBase64 }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('简历解析超时，请重新上传或换一个文件重试。');
    throw new Error('简历上传失败，请检查网络后重试。');
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    let message = '简历解析失败，请换一个文件重试。';
    try {
      const data = await response.json();
      message = typeof data.detail === 'string' ? data.detail : message;
    } catch {
      // Keep the generic message when the backend does not return JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

async function requestResumeRewrite({ resume, target, jd, company, businessUnit, token }) {
  const body = { resume, target, jd, company, business_unit: businessUnit, client_request_id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}` };
  let created;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      created = await apiJson('/api/rewrite-jobs', { method: 'POST', body, token });
      break;
    } catch (error) {
      if (error.status || attempt === 2) throw new Error(error.status ? error.message : '网络连接不稳定，请重新生成');
      await wait(800 * (attempt + 1));
    }
  }
  let consecutiveErrors = 0;
  const startedAt = Date.now();
  for (;;) {
    try {
      const job = await apiJson(`/api/rewrite-jobs/${encodeURIComponent(created.job_id)}`, { token });
      consecutiveErrors = 0;
      if (job.status === 'completed' && job.result) return job.result;
      if (job.status === 'failed') {
        const error = new Error(job.error || '简历优化失败，请稍后重试');
        error.terminal = true;
        throw error;
      }
    } catch (error) {
      if (error.terminal || (error.status && error.status !== 404 && error.status !== 502 && error.status !== 503 && error.status !== 504)) throw error;
      consecutiveErrors += 1;
      if (consecutiveErrors >= 10) throw new Error('网络连接不稳定，请重新生成');
    }
    if (Date.now() - startedAt > 150000) throw new Error('生成时间超出预期，请重新生成');
    await wait(1000);
  }
}

async function streamCopilotReply({ token, message, messages, page, contextLabel, context, signal, onDelta }) {
  const response = await fetch(`${API_BASE_URL}/api/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, messages, page, context_label: contextLabel, context }),
    signal,
  });
  if (!response.ok) {
    let detail = 'Evi 暂时无法回答，请稍后重试';
    try {
      const data = await response.json();
      detail = typeof data.detail === 'string' ? data.detail : detail;
    } catch {
      // Keep the product-facing fallback.
    }
    throw new Error(detail);
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!data.content) throw new Error('Evi 暂时没有生成有效回答');
    onDelta(data.content);
    return data;
  }
  if (!response.body) throw new Error('当前浏览器不支持流式回答');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const line = block.split('\n').find(item => item.startsWith('data:'));
      if (!line) continue;
      const event = JSON.parse(line.slice(5).trim());
      if (event.type === 'delta' && event.content) {
        content += event.content;
        onDelta(event.content);
      }
      if (event.type === 'error') throw new Error(event.message || 'Evi 暂时无法回答');
    }
  }
  return { content, evidence: [], actions: [], memory: {} };
}

function Brand() {
  return <div className="brand"><span className="brand-mark">E</span><div><b>Eviden</b><small>证据链求职决策工具</small></div></div>;
}

function CuteRobot({ compact = false }) {
  return <span className={`copilot-robot ${compact ? 'compact' : ''}`} aria-hidden="true">
    <i className="robot-antenna"></i>
    <span className="robot-head"><i className="robot-eye left"></i><i className="robot-eye right"></i><i className="robot-mouth"></i></span>
  </span>;
}

function cleanCopilotText(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

function normalizeCopilotMemory(value) {
  const source = value && typeof value === 'object' ? value : {};
  const normalize = key => Array.from(new Set((Array.isArray(source[key]) ? source[key] : []).map(item => String(item || '').trim()).filter(Boolean))).slice(0, 12);
  return { goals: normalize('goals'), preferences: normalize('preferences'), facts: normalize('facts') };
}

function mergeCopilotMemory(current, incoming) {
  const left = normalizeCopilotMemory(current);
  const right = normalizeCopilotMemory(incoming);
  return {
    goals: Array.from(new Set([...left.goals, ...right.goals])).slice(-12),
    preferences: Array.from(new Set([...left.preferences, ...right.preferences])).slice(-12),
    facts: Array.from(new Set([...left.facts, ...right.facts])).slice(-12),
  };
}

function EvidenCopilot({ token, userId, page, contextLabel, context, onNavigate }) {
  const messagesKey = copilotStorageKey(COPILOT_MESSAGES_KEY_PREFIX, userId);
  const memoryKey = copilotStorageKey(COPILOT_MEMORY_KEY_PREFIX, userId);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    const stored = safeParse(localStorage.getItem(messagesKey), []);
    return Array.isArray(stored) ? stored : [];
  });
  const [memory, setMemory] = useState(() => normalizeCopilotMemory(safeParse(localStorage.getItem(memoryKey), {})));
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const quickQuestions = page === 'rewrite' ? ['哪条建议最值得采用', '这次改写有没有夸大', '下一步怎么完善'] : page === 'result' ? ['为什么建议我投递', '我最大的缺口是什么', '下一步应该做什么'] : page === 'screening' || page === 'compare' ? ['哪个岗位更值得投', '对比我的主要缺口', '给我投递优先级'] : ['我现在最该做什么', '解释当前页面', '我的优势是什么'];

  useEffect(() => {
    localStorage.setItem(messagesKey, JSON.stringify(messages.slice(-40)));
  }, [messages, messagesKey]);

  useEffect(() => {
    localStorage.setItem(memoryKey, JSON.stringify(memory));
  }, [memory, memoryKey]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, open]);

  const clearConversation = () => {
    controllerRef.current?.abort();
    setMessages([]);
    localStorage.removeItem(messagesKey);
  };

  const sendMessage = async value => {
    const text = String(value || input).trim();
    if (!text || streaming) return;
    if (!token) {
      setMessages(current => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: '登录后就可以和我连续对话' }]);
      return;
    }
    const priorMessages = messages.filter(message => message.text && !message.error).slice(-12).map(message => ({ role: message.role, content: message.text }));
    const assistantId = `assistant-${Date.now()}`;
    setMessages(current => [...current, { id: `user-${Date.now()}`, role: 'user', text }, { id: assistantId, role: 'assistant', text: '' }]);
    setInput('');
    setStreaming(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const responseData = await streamCopilotReply({
        token,
        message: text,
        messages: priorMessages,
        page,
        contextLabel,
        context: { ...context, long_term_memory: memory },
        signal: controller.signal,
        onDelta: delta => setMessages(current => current.map(message => message.id === assistantId ? { ...message, text: `${message.text}${delta}` } : message)),
      });
      setMessages(current => current.map(message => message.id === assistantId ? {
        ...message,
        text: responseData.content || message.text,
        evidence: Array.isArray(responseData.evidence) ? responseData.evidence : [],
        actions: Array.isArray(responseData.actions) ? responseData.actions : [],
      } : message));
      if (responseData.memory) setMemory(current => mergeCopilotMemory(current, responseData.memory));
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessages(current => current.map(message => message.id === assistantId && !message.text ? { ...message, text: '已停止生成' } : message));
      } else {
        setMessages(current => current.map(message => message.id === assistantId ? { ...message, text: error.message || 'Evi 暂时无法回答', error: true } : message));
      }
    } finally {
      controllerRef.current = null;
      setStreaming(false);
    }
  };

  const runAction = action => {
    if (action.type === 'query') sendMessage(action.query || action.target);
    else if (action.type === 'navigate' && onNavigate) onNavigate(action.target);
  };
  const stopStreaming = () => controllerRef.current?.abort();

  return <>
    {open ? <aside className="copilot-drawer" aria-label="Evi AI 助手">
      <header className="copilot-head">
        <div className="copilot-identity"><CuteRobot compact /><div><b>Evi</b><span>{streaming ? '正在回答' : 'EVIDEN AI 助手'}</span></div></div>
        <div className="copilot-head-actions"><button onClick={clearConversation} aria-label="清空对话" title="清空对话"><Trash2 size={16} /></button><button className="copilot-close" onClick={() => setOpen(false)} aria-label="关闭 Evi"><X size={18} /></button></div>
      </header>
      <div className="copilot-context"><small>正在查看</small><b>{contextLabel}</b></div>
      <div className="copilot-messages">
        <div className="copilot-message assistant">
          <CuteRobot compact />
          <div className="copilot-bubble"><p>你好，我是 Evi。你可以直接问我当前页面、岗位或简历相关的问题</p></div>
        </div>
        {messages.map(message => <div className={`copilot-message ${message.role} ${message.error ? 'error' : ''}`} key={message.id}>
          {message.role === 'assistant' ? <CuteRobot compact /> : null}
          <div className="copilot-message-content">
            <div className="copilot-bubble"><p>{message.text ? cleanCopilotText(message.text) : <span className="copilot-thinking">正在思考</span>}</p></div>
            {(message.evidence || []).map(item => <article className="copilot-card evidence" key={`${message.id}-evidence-${item.title}-${item.content}`}><small>回答依据 · {item.source || '报告'}</small><b>{item.title}</b><p>{item.content}</p></article>)}
            {message.actions?.length > 0 ? <div className="copilot-card action"><small>建议行动</small><div>{message.actions.map(action => <button key={`${message.id}-action-${action.type}-${action.label}-${action.target || action.query}`} onClick={() => runAction(action)} disabled={streaming}>{action.label}<ArrowRight size={14} /></button>)}</div></div> : null}
          </div>
        </div>)}
        <div ref={messagesEndRef}></div>
      </div>
      <div className="copilot-quick"><small>你可以这样问</small><div>{quickQuestions.map(question => <button key={question} onClick={() => sendMessage(question)} disabled={streaming}>{question}</button>)}</div></div>
      <form className="copilot-composer" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
        <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="输入你的问题" rows="2" disabled={streaming} />
        {streaming ? <button type="button" onClick={stopStreaming} aria-label="停止生成"><Square size={15} fill="currentColor" /></button> : <button type="submit" disabled={!input.trim()} aria-label="发送"><Send size={17} /></button>}
      </form>
    </aside> : null}
    <button className={`copilot-launcher ${open ? 'open' : ''}`} onClick={() => setOpen(value => !value)} aria-label={open ? '收起 Evi' : '打开 Evi'}>
      <CuteRobot />
    </button>
  </>;
}

function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const payload = { phone, password };
      const result = mode === 'login' ? await authLogin(payload) : await authRegister(payload);
      onSuccess(result);
    } catch (err) {
      setError(err.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <div className="confirm-modal auth-modal editorial-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
      <small>{mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</small>
      <h3>{mode === 'login' ? '登录 Eviden' : '创建账号'}</h3>
      <div className="auth-fields"><input value={phone} onChange={event => setPhone(event.target.value)} placeholder="手机号" inputMode="numeric" /><input value={password} onChange={event => setPassword(event.target.value)} placeholder="密码（至少 6 位）" type="password" /></div>
      {error && <div className="auth-error">{error}</div>}
      <div className="modal-actions"><button className="secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '注册新账号' : '已有账号登录'}</button><button className="primary" onClick={submit} disabled={loading || phone.replace(/\D/g, '').length < 6 || password.length < 6}>{loading ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}</button></div>
    </div>
  </div>;
}

function Landing({ onStart, onScreenJobs, onOptimizeResume, onOpenHistory, onOpenApplications, historyCount, applicationCount, user, latestReport, onViewLatest, onAuth, onLogout }) {
  const latestResult = latestReport?.result;
  const isRealReport = Boolean(user && latestReport && latestResult);
  const matchedEvidence = latestResult?.evidence?.find(item => item.resumeQuote && item.resumeQuote !== '无直接证据');
  const preview = isRealReport ? {
    resume: latestReport.resumeName || latestResult.resumeName || '当前上传简历',
    target: latestReport.target || latestResult.jdName || '目标岗位',
    score: latestResult.score,
    decision: trimUiEnd(latestResult.action),
    summary: shortText(trimUiEnd(latestResult.summary), 66),
    evidence: shortText(trimUiEnd(matchedEvidence?.resumeQuote || matchedEvidence?.req || '查看报告中的完整证据'), 34),
    gap: shortText(trimUiEnd(latestResult.gaps?.[0]?.title || '暂无明显缺口'), 28),
    action: shortText(trimUiEnd(latestResult.actions?.[0]?.title || '查看完整行动建议'), 28),
  } : {
    resume: 'AI 产品方向简历.pdf',
    target: 'AI 产品经理实习生',
    score: 78,
    decision: '补充准备后投递',
    summary: '优势来自 AI 产品理解与商业化运营经验；风险在数据分析、用户研究和结果量化表达',
    evidence: 'AI Agent / Prompt / 工作流迭代',
    gap: 'SQL、用户研究、结果量化',
    action: '改写简历主线，准备追问案例',
  };

  return <section className="landing product-home refined-home">
    <nav className="nav product-nav">
      <Brand />
      <div className="nav-right">
        <div className="nav-links nav-actions-compact"><button onClick={onOpenApplications}>投递管理 {applicationCount ? `(${applicationCount})` : ''}</button><button onClick={onOpenHistory}>历史报告 {historyCount ? `(${historyCount})` : ''}</button><button onClick={onScreenJobs}>岗位筛选</button><button onClick={onOptimizeResume}>简历优化</button><button onClick={onStart}>开始分析</button></div>
        <div className="account-entry">{user ? <button onClick={onLogout}>退出登录</button> : <button onClick={onAuth}>登录</button>}</div>
      </div>
    </nav>

    <div className="product-hero refined-hero">
      <div className="product-copy refined-copy">
        <div className="product-eyebrow">AI JOB MATCH & APPLICATION STRATEGY</div>
        <h1><span>Make Potential</span><span>Evident</span></h1>
        <p>导入简历和目标 JD，获得匹配判断、关键缺口与投递建议</p>
        <div className="home-logic" aria-label="产品逻辑说明">
          <div><span>输入</span><b>导入简历</b><p>支持 PDF、DOCX 和扫描版 PDF</p></div>
          <div><span>解析</span><b>添加目标岗位</b><p>粘贴 JD，补充公司和业务方向</p></div>
          <div><span>输出</span><b>生成投递方案</b><p>查看匹配依据、关键缺口和准备建议</p></div>
        </div>
        <div className="hero-actions product-actions">
          <button className="primary" onClick={onStart}>开始分析 <ArrowRight size={18}/></button>
          <button className="secondary" onClick={onOpenHistory}>查看历史报告</button>
        </div>
      </div>

      <div className="product-mock refined-mock" aria-label={isRealReport ? '最近一次岗位匹配报告' : 'Eviden 报告示例'}>
        <div className="mock-window-bar">
          <div className="mock-window-dots" aria-hidden="true"><span></span><span></span><span></span></div>
          <b>{isRealReport ? '最近分析' : '报告示例'}</b>
          {isRealReport && <button className="mock-report-action" onClick={() => onViewLatest(latestReport)}>查看完整报告 <ArrowRight size={14}/></button>}
        </div>
        <div className="match-pair">
          <div><label>当前简历</label><strong>{preview.resume}</strong></div>
          <div><label>目标岗位</label><strong>{preview.target}</strong></div>
        </div>
        <div className="report-preview">
          <div className="preview-score"><label>岗位匹配结果</label><strong>{preview.score}</strong><span>综合匹配分</span></div>
          <div className="preview-summary"><label>投递建议</label><b>{preview.decision}</b><p>{preview.summary}</p></div>
        </div>
        <div className="preview-table">
          <div><span>已有证据</span><b>{preview.evidence}</b></div>
          <div><span>关键缺口</span><b>{preview.gap}</b></div>
          <div><span>优先行动</span><b>{preview.action}</b></div>
        </div>
      </div>
    </div>
  </section>;
}

function JobScreening({ token, user, onBack, onAnalyze, onStart, onSaveScreening, initialRecord }) {
  const cachedResume = getCachedDefaultResume(user?.id);
  const resume = cachedResume?.resume_text || '';
  const [jobs, setJobs] = useState(() => initialRecord?.jobs || [
    { title: '', company: '', businessUnit: '', jd: '' },
    { title: '', company: '', businessUnit: '', jd: '' },
    { title: '', company: '', businessUnit: '', jd: '' },
  ]);
  const [results, setResults] = useState(() => initialRecord?.results || []);
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(-1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const resultsRef = useRef(null);
  const updateJob = (index, field, value) => setJobs(current => current.map((job, i) => i === index ? { ...job, [field]: value } : job));
  const validJobs = jobs.filter(job => job.title.trim().length >= 2 && job.jd.trim().length >= 50);
  const screen = async () => {
    if (!resume) return setError('请先在单岗位分析中上传默认简历。');
    if (validJobs.length < 2) return setError('请至少完整填写 2 个岗位。');
    setLoading(true); setError(''); setResults([]);
    try {
      const data = await requestJobScreening({ resume, jobs: validJobs });
      const nextResults = (data.results || []).map(item => ({ ...item, priority: item.score >= 80 ? '高优先级' : item.score >= 65 ? '中优先级' : '低优先级' }));
      setResults(nextResults);
      setNotice(`岗位适配度对比完成，已生成 ${nextResults.length} 个岗位的推荐顺序`);
      window.setTimeout(() => setNotice(''), 3000);
      onSaveScreening?.({ jobs: validJobs, results: nextResults, resumeName: cachedResume?.filename || '默认简历' });
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
    catch (err) { setError(err.message || '岗位筛选失败，请稍后重试。'); }
    finally { setLoading(false); }
  };
  const deepAnalyze = async item => {
    const job = validJobs[item.jd_index];
    if (!job) return;
    const input = { resume, jd: job.jd, target: job.title, company: job.company, businessUnit: job.businessUnit, resumeFileName: cachedResume?.filename };
    setDeepLoading(item.jd_index); setError('');
    try { const report = await requestAnalysis(input, token); onAnalyze(report, input); }
    catch (err) { setError(friendlyAnalysisError(err)); }
    finally { setDeepLoading(-1); }
  };
  return <section className="workspace screening-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回首页</button><button className="secondary" onClick={onStart}>单岗位分析</button></div></nav>
    <div className="page-head"><div><small>JOB FIT COMPARISON / 岗位适配度对比</small><h2>岗位适配度对比</h2><p>导入多个 JD，查看岗位排序、主要优势与关键缺口</p></div><div className="page-actions"><button className="primary" onClick={screen} disabled={loading || validJobs.length < 2}>{loading ? '对比中…' : '开始对比'}</button></div></div>
    {resume && <div className="screening-resume editorial-card"><div><small>本次使用的简历</small><b>{cachedResume?.filename || '账号默认简历'}</b><span>{cachedResume?.char_count || resume.length} 个字符 · 与单岗位分析共用</span></div><button className="secondary" onClick={onStart}>更换简历</button></div>}
    {notice && <div className="screening-toast editorial-card"><div><b>对比完成</b><span>{notice}</span></div><div className="screening-toast-actions"><button className="primary" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}>查看结果</button><button className="toast-close" onClick={() => setNotice('')} aria-label="关闭提示">×</button></div></div>}
    {!resume && <div className="error-banner editorial-card"><b>还没有默认简历</b><span>先上传一份简历，再回来筛选岗位。</span><button className="secondary" onClick={onStart}>去上传简历</button></div>}
    {error && <div className="error-banner editorial-card"><b>暂未完成</b><span>{error}</span></div>}
    <div className="screening-inputs">{jobs.map((job, index) => <article className="editorial-card screening-input" key={index}><div className="card-title"><span>0{index + 1}</span><b>候选岗位</b>{jobs.length > 2 && <button onClick={() => setJobs(current => current.filter((_, i) => i !== index))}>移除</button>}</div><input value={job.title} onChange={e => updateJob(index, 'title', e.target.value)} placeholder="岗位名称"/><div className="two-fields"><input value={job.company} onChange={e => updateJob(index, 'company', e.target.value)} placeholder="公司（选填）"/><input value={job.businessUnit} onChange={e => updateJob(index, 'businessUnit', e.target.value)} placeholder="业务方向（选填）"/></div><textarea value={job.jd} onChange={e => updateJob(index, 'jd', e.target.value)} placeholder="粘贴完整 JD"/></article>)}</div>
    {jobs.length < 9 && <button className="secondary add-job" onClick={() => setJobs(current => [...current, { title: '', company: '', businessUnit: '', jd: '' }])}>＋ 添加岗位（最多 9 个）</button>}
    {loading && <div className="screening-progress editorial-card"><div className="loading-orbit"><span></span><i></i><i></i><i></i></div><div><b>正在比较岗位适配度</b><p>统一评分口径，完成后会自动定位到结果</p></div><div className="screening-progress-steps"><span>01 读取候选岗位</span><span>02 统一口径比较</span><span>03 生成推荐顺序</span></div></div>}
    {results.length > 0 && <div className="screening-results" ref={resultsRef}><div className="screening-results-head"><small>COMPARISON RESULT / 对比结果</small><div><h2>推荐投递顺序</h2><span>共 {results.length} 个岗位</span></div><p>综合简历证据与岗位要求，优先准备排名靠前的岗位</p></div>{results.map((item, index) => <article className="editorial-card screening-result" key={`${item.jd_index}-${item.title}`}><div className="screening-rank"><span>#{index + 1}</span><strong>{Math.max(0, item.score - 4)}–{Math.min(100, item.score + 4)}</strong><small>预估匹配区间</small></div><div className="screening-copy"><small>{item.priority}</small><h3>{item.title}{item.company ? ` · ${item.company}` : ''}</h3><p>{item.verdict}</p><div className="screening-points"><div><label>主要匹配点</label>{item.match_points.map(point => <span key={point}>✓ {point}</span>)}</div><div><label>关键缺口</label>{item.gaps.map(gap => <span key={gap}>— {gap}</span>)}</div></div></div><button className="primary" onClick={() => deepAnalyze(item)} disabled={deepLoading >= 0}>{deepLoading === item.jd_index ? '生成中…' : '深入分析'}</button></article>)}</div>}
  </section>;
}

function InputPanel({ onAnalyze, onBack, onOpenHistory, onOpenRewrite, token, user }) {
  const cachedResume = getCachedDefaultResume(user?.id);
  const [resume, setResume] = useState(() => cachedResume?.resume_text || '');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileName, setResumeFileName] = useState(() => cachedResume?.filename || '');
  const [resumePreview, setResumePreview] = useState(() => cachedResume?.preview || '');
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState(() => cachedResume?.updated_at || '');
  const [parseStatus, setParseStatus] = useState(() => cachedResume ? 'success' : 'idle');
  const [parseMessage, setParseMessage] = useState(() => cachedResume ? `已缓存 ${cachedResume.char_count} 个字符` : '支持 PDF / DOCX');
  const [resumeSyncMessage, setResumeSyncMessage] = useState(cachedResume ? '正在同步云端默认简历…' : '');
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const resumeMutationRef = useRef(0);
  const [jd, setJd] = useState('');
  const [target, setTarget] = useState('');
  const [company, setCompany] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !user?.id) return undefined;
    const controller = new AbortController();
    let syncTimedOut = false;
    const syncTimer = window.setTimeout(() => {
      syncTimedOut = true;
      controller.abort();
    }, 45000);
    const mutationAtStart = resumeMutationRef.current;
    const cachedAtStart = getCachedDefaultResume(user.id);
    const applyResume = (nextResume, message) => {
      persistDefaultResume(user.id, nextResume);
      setResume(nextResume?.resume_text || '');
      setResumeFile(null);
      setResumeFileName(nextResume?.filename || '');
      setResumePreview(nextResume?.preview || '');
      setResumeUpdatedAt(nextResume?.updated_at || '');
      setParseStatus(nextResume ? 'success' : 'idle');
      setParseMessage(nextResume ? `已同步 ${nextResume.char_count} 个字符` : '支持 PDF / DOCX');
      setResumeSyncMessage(message);
    };
    setResumeSyncMessage(cachedAtStart ? '正在同步云端默认简历…' : '正在查找云端默认简历…');
    fetchDefaultResume(token, controller.signal)
      .then(async data => {
        window.clearTimeout(syncTimer);
        if (resumeMutationRef.current !== mutationAtStart) return;
        const cloudResume = normalizeDefaultResume(data?.resume);
        const keepLocal = cachedAtStart && (!cloudResume || defaultResumeUpdatedAtMs(cachedAtStart) > defaultResumeUpdatedAtMs(cloudResume));
        if (keepLocal) {
          applyResume(cachedAtStart, '正在将本机默认简历同步到云端…');
          try {
            const saved = await saveDefaultResume(token, cachedAtStart);
            if (resumeMutationRef.current !== mutationAtStart) return;
            applyResume(normalizeDefaultResume(saved?.resume || saved) || cachedAtStart, '已与云端同步');
          } catch {
            if (resumeMutationRef.current === mutationAtStart) setResumeSyncMessage('云端同步暂时失败，已保留本机默认简历');
          }
          return;
        }
        applyResume(cloudResume, cloudResume ? '已与云端同步' : '当前账号还没有默认简历，请上传一份');
      })
      .catch(err => {
        window.clearTimeout(syncTimer);
        if (resumeMutationRef.current !== mutationAtStart) return;
        if (err.name === 'AbortError' && !syncTimedOut) return;
        setResumeSyncMessage(cachedAtStart
          ? '云端同步暂时失败，已保留本机默认简历'
          : '云端同步暂时失败，你仍可上传并使用简历');
      });
    return () => {
      window.clearTimeout(syncTimer);
      controller.abort();
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || !localStorage.getItem(PENDING_ANALYSIS_KEY)) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    resumePendingAnalysis(token)
      .then(pending => {
        if (!cancelled && pending) onAnalyze(pending.result, pending.input);
      })
      .catch(err => {
        if (!cancelled) setError(friendlyAnalysisError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const submit = async () => {
    if (loading || parseStatus === 'parsing') return;
    if (!resume.trim()) {
      setError('请先上传并解析一份 PDF / DOCX 简历。');
      return;
    }
    if (!target.trim()) {
      setError('请填写目标岗位。');
      return;
    }
    if (!jd.trim()) {
      setError('请粘贴目标岗位 JD。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const input = { resume, jd, target, company, businessUnit, resumeFileName: resumeFileName || resumeFile?.name };
      const result = await requestAnalysis(input, token);
      onAnalyze(result, input);
    } catch (err) {
      setError(friendlyAnalysisError(err));
    } finally {
      setLoading(false);
    }
  };

  const optimizeResume = () => {
    if (loading || parseStatus === 'parsing') return;
    if (!resume.trim()) {
      setError('请先上传并解析一份 PDF / DOCX 简历。');
      return;
    }
    if (!target.trim()) {
      setError('请填写目标岗位。');
      return;
    }
    setError('');
    onOpenRewrite({ target, jd, company, businessUnit });
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resumeMutationRef.current += 1;
    const previousResume = resume;
    setError('');
    setResumeFile(file);
    setParseStatus('parsing');
    setParseMessage('正在解析简历文件，扫描版 PDF 可能需要更久…');
    setResumeSyncMessage('解析成功后会替换当前默认简历');
    try {
      const parsed = await requestResumeParse(file);
      const nextResume = normalizeDefaultResume({
        filename: file.name,
        resume_text: parsed.text,
        char_count: parsed.char_count,
        preview: parsed.preview,
        updated_at: new Date().toISOString(),
      });
      if (!nextResume) throw new Error('没有从文件中解析出可用文本，请换一个文件重试。');
      setResume(nextResume.resume_text);
      setResumeFileName(nextResume.filename);
      setResumePreview(nextResume.preview);
      setResumeUpdatedAt(nextResume.updated_at);
      setParseStatus('success');
      setParseMessage(`已解析 ${nextResume.char_count} 个字符，可以生成报告`);
      setResumeSyncMessage('已替换本机默认简历，正在保存到云端…');
      persistDefaultResume(user?.id, nextResume);
      try {
        const saved = await saveDefaultResume(token, nextResume);
        const cloudResume = normalizeDefaultResume(saved?.resume || saved) || nextResume;
        persistDefaultResume(user?.id, cloudResume);
        setResumeUpdatedAt(cloudResume.updated_at);
        setResumePreview(cloudResume.preview);
        setResumeSyncMessage('已保存为当前账号的默认简历');
      } catch (syncError) {
        setResumeSyncMessage('云端保存暂时失败，已保留本机默认简历；下次更换时可重试');
      }
    } catch (err) {
      setParseStatus(previousResume ? 'success' : 'error');
      setParseMessage(previousResume ? '仍在使用原默认简历' : (err.message || '简历解析失败，请换一个文件重试。'));
      setResumeSyncMessage(previousResume ? `更换失败：${err.message || '请换一个文件重试'}` : '');
      setResumeFile(null);
    } finally {
      event.target.value = '';
    }
  };

  const removeResume = async () => {
    if (removeLoading || !resume) return;
    resumeMutationRef.current += 1;
    setRemoveLoading(true);
    setError('');
    try {
      await deleteDefaultResume(token);
      persistDefaultResume(user?.id, null);
      setResume('');
      setResumeFile(null);
      setResumeFileName('');
      setResumePreview('');
      setResumeUpdatedAt('');
      setParseStatus('idle');
      setParseMessage('支持 PDF / DOCX');
      setResumeSyncMessage('默认简历已移除，请上传一份简历后再分析');
      setRemoveConfirm(false);
    } catch (err) {
      setError(`默认简历移除失败：${err.message || '请稍后重试'}。当前简历仍保留。`);
    } finally {
      setRemoveLoading(false);
    }
  };

  const canSubmit = !loading && parseStatus === 'success' && resume.trim().length >= 80 && target.trim().length >= 2 && jd.trim().length >= 50;
  const canOptimize = !loading && parseStatus === 'success' && resume.trim().length >= 80 && target.trim().length >= 2;
  const loadingSteps = ['读取简历证据', '解析目标 JD', '评估能力缺口', '生成申请策略'];

  return <section className="workspace input-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回首页</button><button className="secondary" onClick={onOpenHistory}>历史报告</button><button className="secondary" onClick={optimizeResume} disabled={!canOptimize}>优化简历</button><button className="secondary" onClick={submit} disabled={!canSubmit}>{loading ? '分析中…' : '生成报告'}</button></div></nav>
    <div className="page-head">
      <div><small>STEP 01 / INPUT</small><h2>导入简历，匹配目标岗位</h2><p>填写岗位信息并粘贴 JD，生成岗位匹配报告</p></div>
      <div className="page-actions"><button className="secondary" onClick={optimizeResume} disabled={!canOptimize}>进入简历优化</button><button className="primary" onClick={submit} disabled={!canSubmit}>{loading ? '生成中…' : '生成匹配报告'}</button></div>
    </div>
    {loading && <div className="analysis-loading editorial-card" aria-live="polite">
      <div className="loading-orbit"><span></span><i></i><i></i><i></i></div>
      <div className="loading-copy"><b>报告正在后台生成</b><p>你可以离开当前页面，完成后重新打开也能继续查看</p></div>
      <div className="loading-steps">{loadingSteps.map((step, index) => <span key={step} style={{ animationDelay: `${index * 0.45}s` }}>{step}</span>)}</div>
    </div>}
    {error && <div className="error-banner editorial-card"><b>生成暂时中断</b><span>{error}</span></div>}

    <div className="input-grid">
      <div className="input-card editorial-card upload-card">
        <div className="card-title"><FileText size={18}/><b>默认简历</b><span>{resume ? '当前简历' : 'PDF / DOCX'}</span></div>
        {resume ? <div className="current-resume">
          <div className="current-resume-head">
            <div><small>当前简历</small><h3>{resumeFileName || '默认简历'}</h3><p>{resumeUpdatedAt ? `更新时间 ${formatDate(resumeUpdatedAt)}` : '已保存在当前账号'}</p></div>
            <FileText size={34}/>
          </div>
          <div className="current-resume-preview"><label>文本预览</label><p>{resumePreview || shortText(resume, 240)}</p></div>
          <div className="current-resume-status" aria-live="polite"><b>{parseStatus === 'parsing' ? parseMessage : '可直接分析或优化'}</b><span>{resumeSyncMessage || parseMessage}</span></div>
          <div className="current-resume-actions">
            <label className="secondary resume-change-action"><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} disabled={loading || removeLoading || parseStatus === 'parsing'} />{parseStatus === 'parsing' ? '正在更换…' : '更换简历'}</label>
            <button className="secondary danger" onClick={() => setRemoveConfirm(true)} disabled={loading || removeLoading || parseStatus === 'parsing'}>移除默认简历</button>
          </div>
          <p className="resume-replace-note">更换只影响后续分析；历史报告仍保留当时使用的简历快照</p>
        </div> : <label className={`resume-upload-zone ${parseStatus}`}>
          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} disabled={loading || removeLoading || parseStatus === 'parsing'} />
          <UploadCloud size={34}/>
          <b>{resumeFile ? resumeFile.name : '上传简历'}</b>
          <p>{parseStatus === 'parsing' || parseStatus === 'error' ? parseMessage : '支持 PDF / DOCX'}</p>
          {resumeSyncMessage && parseStatus !== 'parsing' && <small>{resumeSyncMessage}</small>}
        </label>}
      </div>
      <div className="input-card editorial-card jd-card"><div className="card-title"><BriefcaseBusiness size={18}/><b>目标 JD</b><span>{[company, businessUnit, target].filter(Boolean).join(' · ') || '待填写'}</span></div><div className="context-fields"><input value={target} onChange={e => setTarget(e.target.value)} placeholder="岗位名称" /><input value={company} onChange={e => setCompany(e.target.value)} placeholder="公司（选填）" /><input value={businessUnit} onChange={e => setBusinessUnit(e.target.value)} placeholder="事业部 / 方向（选填）" /></div><textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="粘贴目标岗位 JD（生成匹配报告必填；仅优化简历可不填）" /></div>
    </div>

    <div className="hint-row">
      <div><UploadCloud size={18}/><span>支持文本型 PDF / DOCX</span></div>
      <div><Route size={18}/><span>公司和业务方向选填，用于补充岗位场景</span></div>
      <div><BadgeCheck size={18}/><span>仅依据简历与 JD 进行分析</span></div>
    </div>
    {removeConfirm && <div className="modal-backdrop" role="presentation" onClick={() => !removeLoading && setRemoveConfirm(false)}><div className="confirm-modal editorial-card" role="dialog" aria-modal="true" aria-labelledby="remove-resume-title" onClick={event => event.stopPropagation()}><small>REMOVE DEFAULT RESUME</small><h3 id="remove-resume-title">移除当前默认简历？</h3><p>将从当前账号和本机缓存中移除“{resumeFileName || '默认简历'}”。历史报告及其中的简历快照不会受影响。</p><div className="modal-actions"><button className="secondary" onClick={() => setRemoveConfirm(false)} disabled={removeLoading}>取消</button><button className="primary danger-solid" onClick={removeResume} disabled={removeLoading}>{removeLoading ? '正在移除…' : '确认移除'}</button></div></div></div>}
  </section>;
}

function RewritePage({ onBack, onManageResume, onSaveRewrite, user, token, initialContext, initialRecord }) {
  const cachedResume = getCachedDefaultResume(user?.id);
  const resume = initialRecord?.resume || cachedResume?.resume_text || '';
  const [target, setTarget] = useState(initialRecord?.target || initialContext?.target || '');
  const [company, setCompany] = useState(initialRecord?.company || initialContext?.company || '');
  const [businessUnit, setBusinessUnit] = useState(initialRecord?.businessUnit || initialContext?.businessUnit || '');
  const [jd, setJd] = useState(initialRecord?.jd || initialContext?.jd || '');
  const initialSuggestions = materialRewriteBullets(initialRecord?.result?.bullets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rewrite, setRewrite] = useState(initialRecord?.result ? { ...initialRecord.result, bullets: initialSuggestions } : null);
  const [activeStep, setActiveStep] = useState(initialRecord?.result ? 2 : 1);
  const [adoptedIndices, setAdoptedIndices] = useState(initialSuggestions.map((_, index) => index));
  const [editedSuggestions, setEditedSuggestions] = useState(Object.fromEntries(initialSuggestions.map((item, index) => [index, cleanResumeBulletAfter(item.after)])));
  const [finalDraft, setFinalDraft] = useState(initialRecord?.finalDraft || '');
  const resultRef = useRef(null);

  const submit = async () => {
    if (loading || !resume.trim() || !target.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await requestResumeRewrite({ resume, target, jd, company, businessUnit, token });
      const suggestions = materialRewriteBullets(result.bullets);
      if (!suggestions.length) throw new Error('这次没有产生足够实质的改写建议，请补充目标 JD 后重试。');
      const checkedResult = { ...result, bullets: suggestions };
      setRewrite(checkedResult);
      setEditedSuggestions(Object.fromEntries(suggestions.map((item, index) => [index, cleanResumeBulletAfter(item.after)])));
      setAdoptedIndices(suggestions.map((_, index) => index));
      onSaveRewrite?.({ target, company, businessUnit, jd, resume, resumeName: cachedResume?.filename || initialRecord?.resumeName || '默认简历', result: checkedResult });
      setActiveStep(2);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (err) {
      setError(err.message || '简历优化失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && resume.trim().length >= 80 && target.trim().length >= 2;
  const adoptedSet = new Set(adoptedIndices);
  const copyText = value => navigator.clipboard?.writeText(value || '');
  const toggleAdoption = index => setAdoptedIndices(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index].sort((a, b) => a - b));
  const buildFinalDraft = () => {
    const bullets = rewrite?.bullets || [];
    return bullets.reduce((draft, item, index) => {
      if (!adoptedSet.has(index)) return draft;
      const replacement = editedSuggestions[index] || item.after;
      return item.before && draft.includes(item.before) ? draft.replace(item.before, replacement) : draft;
    }, resume);
  };
  const openFinalDraft = () => {
    setFinalDraft(buildFinalDraft());
    setActiveStep(3);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return <section className="workspace rewrite-page" ref={resultRef}>
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack} disabled={loading}>返回首页</button><button className="secondary" onClick={onManageResume} disabled={loading}>管理默认简历</button>{activeStep === 1 ? <button className="primary" onClick={submit} disabled={!canSubmit}>{loading ? '生成中…' : '生成改写建议'}</button> : <button className="secondary" onClick={() => setActiveStep(1)}>调整目标</button>}</div></nav>
    <div className="page-head rewrite-hero"><div><small>RESUME OPTIMIZER</small><h2>简历优化</h2><p>对照岗位要求改写简历，生成岗位定向版本</p></div></div>
    <div className="rewrite-steps" aria-label="简历优化进度"><button className={activeStep === 1 ? 'active' : ''} onClick={() => setActiveStep(1)}><span>01</span><b>明确目标</b></button><button className={activeStep === 2 ? 'active' : ''} disabled={!rewrite} onClick={() => rewrite && setActiveStep(2)}><span>02</span><b>确认改写</b></button><button className={activeStep === 3 ? 'active' : ''} disabled={!rewrite} onClick={openFinalDraft}><span>03</span><b>完成简历</b></button></div>
    {error && <div className="error-banner editorial-card"><b>暂未生成改写建议</b><span>{error}</span></div>}
    {loading && <div className="analysis-loading editorial-card" aria-live="polite"><div className="loading-orbit"><span></span><i></i><i></i><i></i></div><div className="loading-copy"><b>正在分析岗位与简历</b><p>匹配岗位要求、筛选高价值经历，并校验表达边界</p></div></div>}

    {activeStep === 1 && <div className="rewrite-setup">
      <div className="editorial-card rewrite-resume-card"><div className="card-title"><FileText size={18}/><b>默认简历</b><span>{resume ? `${cachedResume?.char_count || resume.length} 字符` : '未设置'}</span></div>{resume ? <><h3>{cachedResume?.filename || '当前默认简历'}</h3><p>{cachedResume?.preview || shortText(resume, 220)}</p><button className="text-action" onClick={onManageResume}>更换简历</button></> : <><h3>还没有默认简历</h3><p>先上传一份简历，后续分析和优化都会共用这份内容</p><button className="primary" onClick={onManageResume}>上传默认简历</button></>}</div>
      <div className="editorial-card rewrite-target-card">
        <div className="card-title"><BriefcaseBusiness size={18}/><b>目标岗位</b><span>岗位名称必填</span></div>
        <div className="rewrite-form-section"><div className="rewrite-form-title"><b>岗位信息</b><small>用于确定改写方向</small></div><label className="rewrite-field rewrite-field-wide"><span>岗位名称 <em>必填</em></span><input value={target} onChange={e => setTarget(e.target.value)} placeholder="例如：AI 产品经理" /></label><div className="rewrite-field-row"><label className="rewrite-field"><span>公司 <small>选填</small></span><input value={company} onChange={e => setCompany(e.target.value)} placeholder="例如：字节跳动" /></label><label className="rewrite-field"><span>业务方向 <small>选填</small></span><input value={businessUnit} onChange={e => setBusinessUnit(e.target.value)} placeholder="例如：AI 应用" /></label></div></div>
        <div className="rewrite-form-section rewrite-jd-section"><div className="rewrite-form-title"><b>岗位描述（JD）</b><small>选填 · 填写后建议会更精准</small></div><textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="粘贴岗位职责和任职要求" /></div>
        <div className="rewrite-submit-row"><button className="primary rewrite-submit" onClick={submit} disabled={!canSubmit}>{loading ? '生成中…' : '生成改写建议'}</button></div>
      </div>
    </div>}

    {activeStep === 2 && rewrite && <div className="rewrite-output"><div className="rewrite-summary editorial-card"><div><small>REWRITE DIRECTION / 改写方向</small><h2>{target}</h2><p>{rewrite.strategy}</p></div><span>{adoptedIndices.length} / {rewrite.bullets?.length || 0} 条已选择</span></div><div className="rewrite-toolbar"><div><b>确认改写内容</b><span>默认选择全部建议；你可以取消、编辑或复制任意一条</span></div><div><button className="secondary" onClick={() => setAdoptedIndices([])}>取消全选</button><button className="secondary" onClick={() => setAdoptedIndices((rewrite.bullets || []).map((_, index) => index))}>选择全部</button></div></div><div className="rewrite-list">{(rewrite.bullets || []).map((item, index) => <article className={`rewrite-row editorial-card ${adoptedSet.has(index) ? 'adopted' : ''}`} key={`${item.section}-${index}`}><header><span>{String(index + 1).padStart(2, '0')}</span><b>{item.section}</b><button className={adoptedSet.has(index) ? 'adopt-toggle active' : 'adopt-toggle'} onClick={() => toggleAdoption(index)}>{adoptedSet.has(index) ? '已选择' : '选择'}</button></header><div className="rewrite-before"><label>当前表述</label><p>{item.before}</p></div><div className="rewrite-arrow"><ChevronRight size={20}/></div><div className="rewrite-after"><div><label>改写建议</label><button className="text-action" onClick={() => copyText(editedSuggestions[index] || item.after)}>复制</button></div><textarea value={editedSuggestions[index] || ''} onChange={event => setEditedSuggestions(current => ({ ...current, [index]: event.target.value }))} /><small><b>改写理由：</b>{item.reason}</small><small><b>事实边界：</b>{item.evidence_boundary}</small></div></article>)}</div><div className="rewrite-extra"><div className="editorial-card"><div className="rewrite-extra-head"><b>给 HR 的开场白</b><button className="text-action" onClick={() => copyText(rewrite.hr_intro)}>复制</button></div><p>{rewrite.hr_intro}</p></div><div className="editorial-card"><b>待补充信息</b><ul>{(rewrite.gaps || []).length ? rewrite.gaps.map(gap => <li key={gap}>{gap}</li>) : <li>暂未发现明显信息缺口</li>}</ul></div></div><div className="rewrite-next"><div><b>已选择 {adoptedIndices.length} 条改写</b><span>继续后，系统会把已选内容合并到原简历</span></div><button className="primary" onClick={openFinalDraft}>合并投递版本 <ArrowRight size={18}/></button></div></div>}

    {activeStep === 3 && rewrite && <div className="rewrite-final"><div className="rewrite-final-head editorial-card"><div><small>FINAL RESUME / 投递版本</small><h2>{target} · 定向简历</h2><p>已合并 {adoptedIndices.length} 条改写；提交前仍可直接编辑</p></div><div><button className="secondary" onClick={() => setActiveStep(2)}>返回调整</button><button className="primary" onClick={() => copyText(finalDraft)}>复制投递版本</button></div></div><div className="rewrite-final-grid"><div className="editorial-card final-editor"><div className="card-title"><FileText size={18}/><b>简历全文</b><span>{finalDraft.length} 字符</span></div><textarea className="final-resume-editor" value={finalDraft} onChange={event => setFinalDraft(event.target.value)} /></div><aside><div className="editorial-card final-checklist"><b>投递前检查</b><ul><li>姓名、联系方式和时间是否准确</li><li>所有量化结果是否可以解释</li><li>个人动作与团队结果是否区分清楚</li><li>是否保留与目标岗位最相关的证据</li></ul></div>{(rewrite.cautions || []).length > 0 && <div className="editorial-card final-cautions"><b>需核实后再写</b><ul>{rewrite.cautions.map(item => <li key={item}>{item}</li>)}</ul></div>}</aside></div></div>}
  </section>;
}

const trimUiEnd = (value) => String(value || '').trim().replace(/[。.]$/g, '');
const matchLabelText = level => ({ 强: '直接证据', 中: '可迁移证据', 弱: '证据较弱', 直接证据: '直接证据', 可迁移证据: '可迁移证据', 无相关证据: '暂无相关证据' }[level] || level || '待核对');
const cleanDiagnosis = value => trimUiEnd(value)
  .replace(/引用包含概括或组合片段，?需以原文为准复核/g, '')
  .replace(/^[；;，,。\.\s]+/g, '')
  .replace(/[；;，,]\s*$/g, '')
  .trim();
const evidenceAction = item => trimUiEnd(item.suggestion || '');
const interviewerQuestion = gap => {
  const title = trimUiEnd(gap.title);
  if (/行业|背景|领域/.test(title)) return '请讲一个你快速理解陌生行业，并将洞察转化为产品决策的具体案例';
  if (/数据|量化|指标/.test(title)) return '请用数据说明一个你负责项目的目标、关键动作和最终结果';
  if (/协作|推进|沟通/.test(title)) return '请讲一个你推动跨团队协作并解决分歧的具体案例';
  return `请结合具体项目说明你如何补足「${title}」这项能力`;
};
const normalizeInterviewQuestion = question => {
  const text = trimUiEnd(question).replace(/[？?！!]+$/g, '');
  const relayed = text.match(/^如果面试官追问「(.+?)」，你会如何用具体案例说明$/);
  const normalized = relayed ? interviewerQuestion({ title: relayed[1] }) : text;
  return `${normalized}？`;
};
const reportQuestions = result => {
  const questions = (result.questions || []).map(normalizeInterviewQuestion);
  const supplements = (result.gaps || []).map(interviewerQuestion);
  for (const question of supplements) {
    if (questions.length >= 5) break;
    questions.push(question);
  }
  while (questions.length < 5) questions.push('这段经历中你本人负责的决策、动作和最终结果分别是什么');
  return questions.slice(0, 5).map(normalizeInterviewQuestion);
};
const reportRewrites = result => {
  const rewrites = [...(result.rewrites || [])];
  for (const item of result.evidence || []) {
    if (rewrites.length >= 3) break;
    if (!item.resumeQuote || item.resumeQuote === '无直接证据') continue;
    rewrites.push({ before: item.resumeQuote, after: `围绕「${trimUiEnd(item.req)}」补充个人动作、判断依据与量化结果` });
  }
  return rewrites.slice(0, 3);
};

const reportNextStep = result => {
  const action = result.actions?.[0];
  if (action) return { title: trimUiEnd(action.title), detail: shortText(trimUiEnd(action.desc), 76) };
  const gap = result.gaps?.[0];
  if (gap) return { title: `优先补强：${trimUiEnd(gap.title)}`, detail: trimUiEnd(gap.detail || gap.desc || '围绕这一缺口补充可验证的项目证据') };
  return { title: '整理投递材料', detail: '核对简历与岗位要求后，开始准备投递' };
};

function ResultPage({ result, onBack, backLabel = '返回上一步', onHome, onOpenHistory, onCompare, onAddApplication, applicationAdded = false, showHistoryButton = true }) {
  const nextStep = reportNextStep(result);
  return <section className="workspace result-page result-v2">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>{backLabel}</button>{showHistoryButton && <button className="secondary" onClick={onOpenHistory}>历史报告</button>}<button className="secondary" onClick={onCompare}>多岗位对比</button><button className="primary" onClick={onAddApplication} disabled={applicationAdded}>{applicationAdded ? '已加入投递' : '加入投递计划'}</button><button className="secondary" onClick={onHome}>首页</button></div></nav>

    <div className="report-context-bar">
      <div><span>当前简历</span><b>{result.resumeName}</b></div>
      <ArrowRight size={18}/>
      <div><span>目标岗位</span><b>{result.jdName}</b></div>
      <div className="report-status"><span>报告状态</span><b>已保存到历史报告</b></div>
    </div>

    <div className="workspace-tabs" aria-label="投递工作台"><a href="#match">匹配结论</a><a href="#resume-plan">简历优化</a><a href="#action-plan">行动清单</a><a href="#interview-plan">面试准备</a></div>

    <div className="decision-hero editorial-card" id="match">
      <div className="decision-copy">
        <small>APPLICATION DECISION / 投递判断</small>
        <h2>{trimUiEnd(result.action)}</h2>
        <p>{trimUiEnd(result.summary)}</p>
        <div className="decision-tags"><span>优先级 {result.priority}</span><span>{result.position_type || '通用岗位'}</span><span>证据链匹配</span></div>
      </div>
      <div className="decision-score"><span>综合匹配评分</span><b>{result.score}</b><em>/ 100</em><small>6 个维度加权判断</small></div>
    </div>

    <div className="result-grid result-grid-v2">
      <main className="result-main">
        <div className="panel editorial-card score-explain">
          <div className="panel-head"><div><b>匹配评分依据</b></div><span>维度权重</span></div>
          <div className="score-table">
            {result.dimensions.map(item => <div className="score-row" key={item.name}>
              <div className="score-name"><b>{item.name}</b><span>权重 {item.weight}%</span></div>
              <div className="score-track"><i><em style={{ width: `${item.value}%` }} /></i><p>{trimUiEnd(item.note)}</p>{(item.bonus_evidence?.length || item.deduction_reason || item.remedy) && <div className="score-rationale"><div><label>加分证据</label><p>{trimUiEnd(item.bonus_evidence?.join('；') || '暂无强证据')}</p></div><div><label>扣分原因</label><p>{trimUiEnd(item.deduction_reason || '暂无明显扣分')}</p></div><div><label>补救建议</label><p>{trimUiEnd(item.remedy || '保持当前表达')}</p></div></div>}</div>
              <div className="score-number"><b>{item.value}</b><span>贡献 {item.points}</span></div>
            </div>)}
          </div>
        </div>

        <div className="panel editorial-card evidence-map-v2">
          <div className="panel-head"><div><b>JD 要求与简历证据</b></div><span>逐条核对</span></div>
          {result.evidence.map((item, index) => <article className="evidence-card-v2 evidence-card-clean" key={item.req}>
            <div className="evidence-card-head clean-head"><span className="row-index">0{index + 1}</span><div><small>{item.priority}</small><h3>{trimUiEnd(item.jdQuote || item.req)}</h3></div><div className="evidence-badges"><span className={`level ${['强', '直接证据'].includes(item.level) ? 'strong' : ['中', '可迁移证据'].includes(item.level) ? 'medium' : 'weak'}`}>{matchLabelText(item.level)}</span></div></div>
            <div className={`evidence-compare-grid ${String(item.resumeQuote || '').length < 120 ? 'short-evidence' : ''}`}>
              <section className="evidence-lane resume-lane"><label>简历证据</label><p>“{trimUiEnd(item.resumeQuote)}”</p></section>
              <section className="evidence-verdict"><div className="verdict-copy"><label>匹配判断</label><b>{trimUiEnd(item.proof)}</b><p>{cleanDiagnosis(item.diagnosis)}</p>{evidenceAction(item) && <div className="evidence-action"><label>具体调整建议</label><p>{evidenceAction(item)}</p></div>}</div></section>
            </div>
          </article>)}
        </div>

        <div className="panel compact editorial-card result-gaps"><div className="panel-head"><b>优先补强项</b></div>{result.gaps.map(g => <div className="gap" key={g.title}><span className={g.level === '高' ? 'high' : 'medium'}>{g.level}</span><div><b>{trimUiEnd(g.title)}</b><p>{trimUiEnd(g.desc)}</p></div></div>)}</div>

        <div className="panel editorial-card action-plan-v2" id="action-plan">
          <div className="panel-head"><div><b>投递准备清单</b></div><span>当前优先级 {result.priority}</span></div>
          <div className="action-list-v2">{result.actions.map((item, index) => <div key={item.title}><span>0{index + 1}</span><section><b>{trimUiEnd(item.title)}</b><p>{trimUiEnd(item.desc)}</p></section><em>{item.effort}</em></div>)}</div>
        </div>

        <div className="panel editorial-card rewrite-panel-v2" id="resume-plan"><div className="panel-head"><div><b>针对岗位优化简历</b></div><span>{reportRewrites(result).length} 条高优先级</span></div>{reportRewrites(result).map((r, i) => <div className="rewrite-row" key={i}><div><label>当前表达</label><p>{trimUiEnd(r.before)}</p></div><ChevronRight size={18}/><div className="after"><label>建议表达</label><p>{trimUiEnd(r.after)}</p></div></div>)}</div>

        <div className="panel compact editorial-card question-panel result-questions" id="interview-plan"><div className="panel-head"><b>面试准备</b></div>{reportQuestions(result).map((question, index) => <div className="question" key={`${index}-${question}`}><span>Q{index + 1}</span><p>{trimUiEnd(question)}</p></div>)}</div>

        <div className="decision-card result-next-step"><small>NEXT STEP / 下一步</small><h3>{nextStep.title}</h3><p>{nextStep.detail}</p><button className="primary" onClick={() => document.getElementById('action-plan')?.scrollIntoView({ behavior: 'smooth' })}>查看准备清单</button></div>
      </main>
    </div>
  </section>;
}

function screeningHistoryTitle(record) {
  const count = record.results?.length || 0;
  const highPriorityCount = (record.results || []).filter(item => item.priority === '高优先级').length;
  return highPriorityCount ? `${count} 个岗位 · ${highPriorityCount} 个高优先级` : `${count} 个岗位 · 暂无高优先级`;
}

function HistoryPage({ records = [], screeningRecords = [], rewriteRecords = [], onView, onViewScreening, onViewRewrite, onDelete, onDeleteScreening, onDeleteRewrite, onBack, onCompare }) {
  const [tab, setTab] = useState('reports');
  const [selected, setSelected] = useState(records.slice(0, 3).map(item => item.id));
  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id].slice(-4));
  const selectedRecords = records.filter(item => selected.includes(item.id));
  return <section className="workspace history-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回首页</button>{tab === 'reports' && <button className="primary" onClick={() => onCompare(selectedRecords)} disabled={selectedRecords.length < 2}>对比岗位（{selectedRecords.length}）</button>}</div></nav>
    <div className="page-head"><div><small>MY RECORDS / 历史记录</small><h2>历史记录</h2><p>查看完整报告、岗位筛选与简历优化记录</p></div></div>
    <div className="history-tabs"><button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>完整报告 <span>{records.length}</span></button><button className={tab === 'screenings' ? 'active' : ''} onClick={() => setTab('screenings')}>岗位筛选 <span>{screeningRecords.length}</span></button><button className={tab === 'rewrites' ? 'active' : ''} onClick={() => setTab('rewrites')}>简历优化 <span>{rewriteRecords.length}</span></button></div>
    {tab === 'reports' && (records.length === 0 ? <div className="empty-state editorial-card"><b>还没有完整报告</b><p>完成一次简历 × JD 分析后，报告会自动保存到这里</p></div> : <div className="history-grid">{records.map(record => <article className="history-card editorial-card" key={record.id}><label className="compare-check"><input type="checkbox" checked={selected.includes(record.id)} onChange={() => toggle(record.id)} />{selected.includes(record.id) ? '已选对比' : '选择对比'}</label><div className="history-score"><span>{record.result.action}</span><b>{record.result.score}</b></div><h3>{record.target}</h3><p>{record.result.summary}</p><div className="history-meta"><span>{formatDate(record.createdAt)}</span><span>{record.result.priority}</span>{record.company && <span>{record.company}</span>}</div><div className="history-actions"><button className="secondary" onClick={() => onView(record)}>查看完整报告</button><button className="secondary danger" onClick={() => onDelete(record.id)}>删除</button></div></article>)}</div>)}
    {tab === 'screenings' && (screeningRecords.length === 0 ? <div className="empty-state editorial-card"><b>还没有岗位筛选记录</b><p>完成一次岗位适配度对比后，结果会保存在这里</p></div> : <div className="history-grid screening-history-grid">{screeningRecords.map(record => <article className="history-card editorial-card" key={record.id}><div className="history-score"><span>岗位适配度对比</span><b>{record.results.length}</b></div><h3>{screeningHistoryTitle(record)}</h3><p>{record.results.slice(0, 3).map(item => item.title).join('、')}{record.results.length > 3 ? ` 等 ${record.results.length} 个岗位` : ''}</p><div className="history-meta"><span>{formatDate(record.createdAt)}</span><span>{record.resumeName}</span></div><div className="history-actions"><button className="secondary" onClick={() => onViewScreening(record)}>继续查看</button><button className="secondary danger" onClick={() => onDeleteScreening(record.id)}>删除</button></div></article>)}</div>)}
    {tab === 'rewrites' && (rewriteRecords.length === 0 ? <div className="empty-state editorial-card"><b>还没有简历优化记录</b><p>生成一次改写建议后，结果会自动保存在这里</p></div> : <div className="history-grid rewrite-history-grid">{rewriteRecords.map(record => <article className="history-card editorial-card" key={record.id}><div className="history-score"><span>简历优化</span><b>{materialRewriteBullets(record.result?.bullets).length}</b></div><h3>{record.target}</h3><p>{record.result?.strategy || '查看本次简历改写建议'}</p><div className="history-meta"><span>{formatDate(record.createdAt)}</span><span>{record.resumeName}</span>{record.company && <span>{record.company}</span>}</div><div className="history-actions"><button className="secondary" onClick={() => onViewRewrite(record)}>查看改写建议</button><button className="secondary danger" onClick={() => onDeleteRewrite(record.id)}>删除</button></div></article>)}</div>)}
  </section>;
}

function ComparePage({ records, onBack, onView }) {
  const compared = records.slice(0, 4);
  return <section className="workspace compare-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回我的报告</button></div></nav>
    <div className="page-head"><div><small>ROLE COMPARISON / 多岗位对比</small><h2>选择，更有依据</h2><p>横向对比岗位匹配度、主要优势与关键缺口，明确投递优先级</p></div></div>
    {compared.length < 2 ? <div className="empty-state editorial-card"><b>还需要选择岗位</b><p>从「我的报告」中选择 2–4 个岗位进行对比</p></div> : <div className="compare-grid">
      {compared.map(record => <article className="compare-card editorial-card" key={record.id}>
        <div className="compare-score"><span>{record.target}</span><b>{record.result.score}</b><em>{record.result.action}</em></div>
        <div className="compare-section"><label>主要优势</label><p>{record.result.evidence?.[0]?.proof || record.result.summary}</p></div>
        <div className="compare-section"><label>关键缺口</label><p>{record.result.gaps?.[0]?.title}：{record.result.gaps?.[0]?.desc}</p></div>
        <div className="compare-section"><label>准备重点</label><p>{record.result.actions?.[0]?.title}｜{record.result.actions?.[0]?.effort}</p></div>
        <button className="secondary full" onClick={() => onView(record)}>查看完整报告</button>
      </article>)}
    </div>}
  </section>;
}

function ApplicationsPage({ applications, onChange, onBack, onViewReport }) {
  const [selectedId, setSelectedId] = useState(applications[0]?.id || '');
  const [activity, setActivity] = useState('');
  const selected = applications.find(item => item.id === selectedId) || null;
  const update = (id, patch, activityText = '') => {
    onChange(applications.map(item => item.id !== id ? item : {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
      activities: activityText ? [{ id: `activity-${Date.now()}`, time: new Date().toISOString(), type: 'update', content: activityText }, ...(item.activities || [])] : item.activities,
    }));
  };
  const setStatus = (record, status) => update(record.id, { status }, `状态更新为「${applicationStatusLabel(status)}」`);
  const addActivity = event => {
    event.preventDefault();
    if (!selected || !activity.trim()) return;
    update(selected.id, {}, activity.trim());
    setActivity('');
  };
  const remove = record => {
    onChange(applications.filter(item => item.id !== record.id));
    setSelectedId('');
  };
  const started = applications.filter(item => !['not_applied', 'preparing'].includes(item.status)).length;
  const interviews = applications.filter(item => ['interviewing', 'offered'].includes(item.status)).length;
  const offers = applications.filter(item => item.status === 'offered').length;
  const dueSoon = applications.filter(item => item.dueDate && new Date(item.dueDate).getTime() >= Date.now() && new Date(item.dueDate).getTime() - Date.now() < 7 * 86400000).length;

  return <section className="workspace applications-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回首页</button></div></nav>
    <div className="page-head applications-head"><div><small>APPLICATION PIPELINE / 投递管理</small><h2>投递工作台</h2><p>集中管理岗位进度、下一步行动与每次跟进</p></div><div className="application-summary"><span><b>{applications.length}</b>全部岗位</span><span><b>{dueSoon}</b>7 天内待办</span></div></div>

    <div className="application-kpis">
      <article className="editorial-card"><span>已加入</span><b>{applications.length}</b><small>岗位总数</small></article>
      <article className="editorial-card"><span>已投递</span><b>{started}</b><small>{applications.length ? `${Math.round(started / applications.length * 100)}% 投递率` : '等待加入岗位'}</small></article>
      <article className="editorial-card"><span>进入面试</span><b>{interviews}</b><small>{started ? `${Math.round(interviews / started * 100)}% 面试转化` : '尚无转化'}</small></article>
      <article className="editorial-card"><span>获得录用</span><b>{offers}</b><small>{interviews ? `${Math.round(offers / interviews * 100)}% 录用转化` : '继续推进'}</small></article>
    </div>

    <div className="application-funnel editorial-card">
      <div><small>CONVERSION FUNNEL</small><b>投递转化漏斗</b></div>
      <div className="funnel-track"><span style={{ '--funnel-width': '100%' }}>加入计划 {applications.length}</span><span style={{ '--funnel-width': `${applications.length ? Math.max(24, started / applications.length * 100) : 24}%` }}>已投递 {started}</span><span style={{ '--funnel-width': `${applications.length ? Math.max(18, interviews / applications.length * 100) : 18}%` }}>面试 {interviews}</span><span style={{ '--funnel-width': `${applications.length ? Math.max(12, offers / applications.length * 100) : 12}%` }}>录用 {offers}</span></div>
    </div>

    {applications.length === 0 ? <div className="empty-state editorial-card application-empty"><BriefcaseBusiness size={30}/><b>还没有加入投递计划的岗位</b><p>打开一份岗位报告，点击「加入投递计划」即可开始管理</p></div> : <div className="application-board">
      {APPLICATION_STATUSES.map(status => {
        const records = applications.filter(item => item.status === status.id);
        return <section className={`application-column status-${status.id}`} key={status.id}><header><b>{status.label}</b><span>{records.length}</span></header><div className="application-column-list">{records.map(record => <button className={`application-card editorial-card ${selectedId === record.id ? 'active' : ''}`} key={record.id} onClick={() => setSelectedId(record.id)}><small>{record.company || '公司待补充'}</small><b>{record.target}</b><p>{record.nextAction || '设置下一步行动'}</p><div><span>{record.score != null ? `匹配 ${record.score}` : '来自岗位报告'}</span><time>{record.dueDate || '暂无截止日'}</time></div></button>)}</div></section>;
      })}
    </div>}

    {selected && <div className="application-detail-backdrop" role="presentation" onClick={() => setSelectedId('')}><aside className="application-detail editorial-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
      <header><div><small>{selected.company || '公司待补充'} · {applicationStatusLabel(selected.status)}</small><h3>{selected.target}</h3></div><button onClick={() => setSelectedId('')} aria-label="关闭"><X size={20}/></button></header>
      <div className="application-detail-fields"><label>当前状态<select value={selected.status} onChange={event => setStatus(selected, event.target.value)}>{APPLICATION_STATUSES.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label><label>跟进截止日<input type="date" value={selected.dueDate || ''} onChange={event => update(selected.id, { dueDate: event.target.value })}/></label><label className="wide">下一步行动<input value={selected.nextAction || ''} onChange={event => update(selected.id, { nextAction: event.target.value })} placeholder="例如：周五前完成定向简历并投递"/></label></div>
      <div className="application-report-link"><div><span>岗位报告</span><b>{selected.score != null ? `匹配评分 ${selected.score}` : '已关联报告'}</b></div>{selected.reportId && <button className="secondary" onClick={() => onViewReport(selected.reportId)}>查看报告</button>}</div>
      <div className="application-activity"><div className="panel-head"><b>跟进记录</b><span>{(selected.activities || []).length} 条</span></div><form onSubmit={addActivity}><input value={activity} onChange={event => setActivity(event.target.value)} placeholder="记录沟通、投递、面试或结果"/><button className="primary" disabled={!activity.trim()}>添加记录</button></form><div className="activity-list">{(selected.activities || []).map(item => <article key={item.id}><i></i><div><b>{item.content}</b><time>{formatDate(item.time)}</time></div></article>)}</div></div>
      <button className="secondary danger application-delete" onClick={() => remove(selected)}>移出投递计划</button>
    </aside></div>}
  </section>;
}

function mergeHistory(localRecords, cloudReports) {
  const deletedIds = getDeletedReportIds();
  const byId = new Map();
  localRecords.forEach(record => {
    if (!deletedIds.has(record.id)) byId.set(record.id, record);
  });
  cloudReports.forEach(item => {
    if (item.record?.id && !deletedIds.has(item.record.id)) byId.set(item.record.id, item.record);
  });
  return Array.from(byId.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 30);
}

function compactReportForCopilot(record) {
  if (!record) return null;
  const report = record.result || record;
  const text = (value, limit = 320) => String(value || '').slice(0, limit);
  const compactList = (values, limit = 3) => (values || []).slice(0, limit).map(item => typeof item === 'string' ? text(item) : {
    title: text(item.title || item.gap || item.action || item.requirement, 120),
    description: text(item.description || item.detail || item.reason || item.suggestion || item.content, 320),
  });
  return {
    id: record.id || report.id || '',
    created_at: record.createdAt || record.created_at || '',
    target: text(record.target || report.target, 120),
    company: text(record.company || report.company, 120),
    resume_name: text(record.resumeName || report.resumeName, 160),
    jd_name: text(record.jdName || report.jdName, 160),
    score: report.score ?? null,
    action: text(report.action, 120),
    summary: text(report.summary, 320),
    confidence: text(report.confidence_label, 40),
    evidence: (report.evidence || []).slice(0, 2).map(item => ({
      requirement: text(item.req, 180),
      level: text(item.level, 40),
      proof: text(item.proof || item.resumeQuote, 260),
    })),
    gaps: compactList(report.gaps, 2),
    actions: compactList(report.actions, 2),
    rewrites: (report.rewrites || []).slice(0, 1).map(item => ({ before: text(item.before, 180), after: text(item.after, 240), reason: text(item.reason, 140) })),
    questions: (report.questions || []).slice(0, 2).map(item => text(typeof item === 'string' ? item : item.question, 180)),
  };
}

function compactRewriteForCopilot(record) {
  if (!record) return null;
  const rewrite = record.result || record;
  return {
    id: record.id || rewrite.id || '',
    target: record.target || rewrite.target || '',
    positioning: rewrite.positioning || '',
    strategy: rewrite.strategy || '',
    bullets: (rewrite.bullets || []).slice(0, 8),
    gaps: (rewrite.gaps || []).slice(0, 6),
    hr_intro: rewrite.hr_intro || '',
    cautions: (rewrite.cautions || []).slice(0, 6),
  };
}

function compactResumeForCopilot(resume) {
  if (!resume) return null;
  return {
    filename: resume.filename || '',
    char_count: resume.char_count || resume.charCount || 0,
    preview: resume.preview || String(resume.resume_text || resume.resumeText || '').slice(0, 1200),
  };
}

function compactScreeningForCopilot(record) {
  if (!record) return null;
  return {
    id: record.id || '',
    resume_name: record.resumeName || '',
    jobs: (record.jobs || []).slice(0, 6).map(job => ({ id: job.id || '', title: job.title || job.name || '', company: job.company || '', jd_preview: String(job.jd || job.jdText || '').slice(0, 600) })),
    results: (record.results || []).slice(0, 6).map(result => ({ target: result.target || result.title || '', score: result.score ?? null, action: result.action || '', summary: result.summary || '', gaps: (result.gaps || []).slice(0, 3) })),
  };
}

function buildCapabilityProfile(history, screeningHistory, rewriteHistory) {
  const reports = (history || []).slice(0, 8);
  const targets = Array.from(new Set(reports.map(record => record.target || record.result?.target).filter(Boolean))).slice(0, 6);
  const strengths = [];
  const gaps = [];
  const actions = [];
  reports.forEach(record => {
    const report = record.result || record;
    (report.evidence || []).slice(0, 2).forEach(item => strengths.push(item.proof || item.resumeQuote || item.req));
    (report.gaps || []).slice(0, 2).forEach(item => gaps.push(typeof item === 'string' ? item : item.title || item.gap || item.description));
    (report.actions || []).slice(0, 2).forEach(item => actions.push(typeof item === 'string' ? item : item.title || item.action || item.description));
  });
  const unique = values => Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean))).slice(0, 3).map(value => value.slice(0, 180));
  return {
    headline: targets.length ? `聚焦 ${targets[0]} · 已沉淀 ${reports.length} 份岗位分析` : '等待通过岗位分析建立能力档案',
    target_roles: targets,
    strengths: unique(strengths),
    recurring_gaps: unique(gaps),
    recommended_actions: unique(actions),
    report_count: reports.length,
    screening_count: (screeningHistory || []).length,
    rewrite_count: (rewriteHistory || []).length,
  };
}

function App() {
  const [step, setStep] = useState(() => localStorage.getItem(PENDING_ANALYSIS_KEY) ? 'input' : 'landing');
  const [previousStep, setPreviousStep] = useState('landing');
  const [result, setResult] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || '');
  const [user, setUser] = useState(getStoredUser);
  const [history, setHistory] = useState(getStoredHistory);
  const [screeningHistory, setScreeningHistory] = useState(() => getScreeningHistoryForUser(getStoredUser()?.id));
  const [rewriteHistory, setRewriteHistory] = useState(() => getRewriteHistoryForUser(getStoredUser()?.id));
  const [applications, setApplications] = useState(() => getStoredApplications(getStoredUser()?.id));
  const [selectedScreening, setSelectedScreening] = useState(null);
  const [selectedRewrite, setSelectedRewrite] = useState(null);
  const [rewriteContext, setRewriteContext] = useState(null);
  const [compareRecords, setCompareRecords] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingStep, setPendingStep] = useState('');

  useEffect(() => {
    if (!token) {
      setUser(null);
      setHistory([]);
      setScreeningHistory([]);
      setRewriteHistory([]);
      setApplications([]);
      return;
    }
    let cancelled = false;
    const restore = async () => {
      try {
        const userInfo = await authMe(token);
        if (cancelled) return;
        setUser(userInfo);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userInfo));
        const localRecords = getHistoryForUser(userInfo.id);
        const localScreenings = getScreeningHistoryForUser(userInfo.id);
        const localRewrites = getRewriteHistoryForUser(userInfo.id);
        const localApplications = getStoredApplications(userInfo.id);
        setHistory(localRecords);
        setScreeningHistory(localScreenings);
        setRewriteHistory(localRewrites);
        setApplications(localApplications);
        persistHistory(localRecords, userInfo.id);
        persistScreeningHistory(localScreenings, userInfo.id);
        persistRewriteHistory(localRewrites, userInfo.id);
        try {
          const cloud = await fetchCloudReports(token);
          if (cancelled) return;
          const cloudRecords = (cloud.reports || []).filter(item => item.record?.kind !== 'screening' && item.record?.kind !== 'rewrite' && item.record?.result?.score != null);
          const cloudScreenings = (cloud.reports || []).filter(item => item.record?.kind === 'screening');
          const cloudRewrites = (cloud.reports || []).filter(item => item.record?.kind === 'rewrite');
          const merged = mergeHistory(localRecords, cloudRecords);
          const mergedScreenings = mergeHistory(localScreenings, cloudScreenings);
          const mergedRewrites = mergeHistory(localRewrites, cloudRewrites);
          setHistory(merged);
          setScreeningHistory(mergedScreenings);
          setRewriteHistory(mergedRewrites);
          persistHistory(merged, userInfo.id);
          persistScreeningHistory(mergedScreenings, userInfo.id);
          persistRewriteHistory(mergedRewrites, userInfo.id);
        } catch (syncError) {
          if (syncError.status === 401) throw syncError;
          console.warn('restore cloud reports failed temporarily', syncError);
        }
      } catch (err) {
        if (err.status === 401) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          setToken('');
          setUser(null);
        } else {
          console.warn('restore session failed temporarily', err);
        }
      }
    };
    restore();
    return () => { cancelled = true; };
  }, [token]);

  const isLoggedIn = Boolean(token && user);

  const go = next => {
    setPreviousStep(step);
    setStep(next);
  };

  const requireLogin = next => {
    if (!isLoggedIn) {
      setPendingStep(next);
      setShowAuth(true);
      return;
    }
    go(next);
  };

  const handleAuthSuccess = auth => {
    localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(auth.user));
    const localRecords = getHistoryForUser(auth.user.id);
    const localScreenings = getScreeningHistoryForUser(auth.user.id);
    const localRewrites = getRewriteHistoryForUser(auth.user.id);
    const localApplications = getStoredApplications(auth.user.id);
    persistHistory(localRecords, auth.user.id);
    persistScreeningHistory(localScreenings, auth.user.id);
    persistRewriteHistory(localRewrites, auth.user.id);
    setToken(auth.token);
    setUser(auth.user);
    setHistory(localRecords);
    setScreeningHistory(localScreenings);
    setRewriteHistory(localRewrites);
    setApplications(localApplications);
    setShowAuth(false);
    const nextStep = pendingStep;
    if (nextStep) {
      go(nextStep);
      setPendingStep('');
    }
    Promise.allSettled([...localRecords, ...localScreenings, ...localRewrites].map(record => saveCloudReport(auth.token, record)))
      .then(() => fetchCloudReports(auth.token))
      .then(cloud => {
        const cloudRecords = (cloud.reports || []).filter(item => item.record?.kind !== 'screening' && item.record?.kind !== 'rewrite' && item.record?.result?.score != null);
        const cloudScreenings = (cloud.reports || []).filter(item => item.record?.kind === 'screening');
        const cloudRewrites = (cloud.reports || []).filter(item => item.record?.kind === 'rewrite');
        const merged = mergeHistory(localRecords, cloudRecords);
        const mergedScreenings = mergeHistory(localScreenings, cloudScreenings);
        const mergedRewrites = mergeHistory(localRewrites, cloudRewrites);
        setHistory(merged);
        setScreeningHistory(mergedScreenings);
        setRewriteHistory(mergedRewrites);
        persistHistory(merged, auth.user.id);
        persistScreeningHistory(mergedScreenings, auth.user.id);
        persistRewriteHistory(mergedRewrites, auth.user.id);
      })
      .catch(err => console.warn('sync history failed', err));
  };

  const confirmLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(PENDING_ANALYSIS_KEY);
    setToken('');
    setUser(null);
    setHistory([]);
    setScreeningHistory([]);
    setRewriteHistory([]);
    setApplications([]);
    setSelectedScreening(null);
    setSelectedRewrite(null);
    setCompareRecords([]);
    setResult(null);
    setShowLogoutConfirm(false);
    setPendingStep('');
    setPreviousStep('landing');
    setStep('landing');
  };

  const saveAndShowResult = async (analysisResult, input) => {
    if (!token) {
      setShowAuth(true);
      return;
    }
    const record = makeHistoryRecord(analysisResult, input);
    const nextHistory = [record, ...history.filter(item => item.id !== record.id)].slice(0, 30);
    setHistory(nextHistory);
    persistHistory(nextHistory, user?.id);
    saveCloudReport(token, record).catch(err => console.warn('save cloud report failed', err));
    setResult(record.result);
    setPreviousStep('input');
    setStep('result');
  };

  const saveScreeningRecord = payload => {
    const record = { id: `screening-${Date.now()}`, kind: 'screening', createdAt: new Date().toISOString(), ...payload };
    const next = [record, ...screeningHistory].slice(0, 20);
    setScreeningHistory(next);
    persistScreeningHistory(next, user?.id);
    if (token) saveCloudReport(token, record).catch(err => console.warn('save screening record failed', err));
  };

  const viewScreeningRecord = record => {
    setSelectedScreening(record);
    setStep('screening');
  };

  const deleteScreeningRecord = id => {
    const next = screeningHistory.filter(item => item.id !== id);
    setScreeningHistory(next);
    persistScreeningHistory(next, user?.id);
    if (token) deleteCloudReportWithRetry(token, id).catch(err => console.warn('delete screening record failed', err));
  };

  const saveRewriteRecord = payload => {
    const record = { id: `rewrite-${Date.now()}`, kind: 'rewrite', createdAt: new Date().toISOString(), ...payload };
    const next = [record, ...rewriteHistory].slice(0, 20);
    setRewriteHistory(next);
    persistRewriteHistory(next, user?.id);
    if (token) saveCloudReport(token, record).catch(err => console.warn('save rewrite record failed', err));
  };

  const viewRewriteRecord = record => {
    setSelectedRewrite(record);
    setRewriteContext(null);
    setPreviousStep('history');
    setStep('rewrite');
  };

  const deleteRewriteRecord = id => {
    const next = rewriteHistory.filter(item => item.id !== id);
    setRewriteHistory(next);
    persistRewriteHistory(next, user?.id);
    if (token) deleteCloudReportWithRetry(token, id).catch(err => console.warn('delete rewrite record failed', err));
  };

  const deleteRecord = id => {
    markReportDeleted(id);
    const nextHistory = history.filter(item => item.id !== id);
    setHistory(nextHistory);
    persistHistory(nextHistory, user?.id);
    if (token) deleteCloudReportWithRetry(token, id).catch(err => console.warn('delete cloud report failed after retries', err));
  };

  const viewRecord = record => {
    setResult(record.result);
    setPreviousStep(step);
    setStep('result');
  };

  const openCompare = records => {
    const source = Array.isArray(records) && records.length ? records : history.slice(0, 4);
    setCompareRecords(source);
    setPreviousStep(step);
    setStep('compare');
  };

  const updateApplications = records => {
    setApplications(records);
    persistApplications(user?.id, records);
  };

  const reportForResult = result ? history.find(record => record.result === result || (record.target === (result.target || result.jdName) && record.result?.score === result.score) || record.result?.jdName === result.jdName) : null;
  const currentApplication = reportForResult ? applications.find(item => item.reportId === reportForResult.id) : null;

  const addCurrentReportToApplications = () => {
    if (!reportForResult || currentApplication) {
      setStep('applications');
      return;
    }
    const now = new Date().toISOString();
    const record = {
      id: `application-${Date.now()}`,
      reportId: reportForResult.id,
      rewriteId: '',
      target: reportForResult.target || result?.target || result?.jdName || '目标岗位',
      company: reportForResult.company || '',
      businessUnit: reportForResult.businessUnit || '',
      status: 'not_applied',
      score: reportForResult.result?.score,
      nextAction: reportNextStep(reportForResult.result).title,
      dueDate: '',
      createdAt: now,
      updatedAt: now,
      activities: [{ id: `activity-${Date.now()}`, time: now, type: 'created', content: '从岗位报告加入投递计划' }],
    };
    updateApplications([record, ...applications]);
    setPreviousStep('result');
    setStep('applications');
  };

  const viewApplicationReport = reportId => {
    const record = history.find(item => item.id === reportId);
    if (record) viewRecord(record);
  };

  const backFromCurrent = () => setStep(previousStep || 'landing');
  const closeAuth = () => {
    setShowAuth(false);
    setPendingStep('');
  };
  const copilotPage = ['landing', 'screening', 'rewrite', 'input', 'history', 'compare', 'applications'].includes(step) ? step : 'result';
  const copilotContext = step === 'landing' ? '求职工作台' : step === 'screening' ? '岗位筛选' : step === 'rewrite' ? `简历优化${rewriteContext?.target ? ` · ${rewriteContext.target}` : ''}` : step === 'input' ? '岗位分析' : step === 'history' ? '历史记录' : step === 'compare' ? '岗位对比' : step === 'applications' ? '投递管理' : result?.jdName || result?.target || '当前分析报告';
  const capabilityProfile = buildCapabilityProfile(history, screeningHistory, rewriteHistory);
  const pageCopilotData = step === 'landing'
    ? { latest_report: compactReportForCopilot(history[0]), recent_targets: capabilityProfile.target_roles.slice(0, 4) }
    : step === 'screening'
      ? { current_screening: compactScreeningForCopilot(selectedScreening || screeningHistory[0]), recent_screenings: screeningHistory.slice(0, 3).map(compactScreeningForCopilot) }
      : step === 'rewrite'
        ? { current_rewrite: compactRewriteForCopilot(selectedRewrite || rewriteContext), recent_rewrites: rewriteHistory.slice(0, 3).map(compactRewriteForCopilot), default_resume: compactResumeForCopilot(getCachedDefaultResume(user?.id)) }
        : step === 'input'
          ? { default_resume: compactResumeForCopilot(getCachedDefaultResume(user?.id)), recent_reports: history.slice(0, 3).map(compactReportForCopilot) }
          : step === 'history'
            ? { reports: history.slice(0, 6).map(compactReportForCopilot), screenings: screeningHistory.slice(0, 4).map(compactScreeningForCopilot), rewrites: rewriteHistory.slice(0, 4).map(compactRewriteForCopilot) }
            : step === 'applications'
              ? { applications: applications.slice(0, 20).map(item => ({ target: item.target, company: item.company, status: applicationStatusLabel(item.status), next_action: item.nextAction, due_date: item.dueDate, updated_at: item.updatedAt, activities: (item.activities || []).slice(0, 4) })) }
              : step === 'compare'
                ? { reports: compareRecords.slice(0, 4).map(compactReportForCopilot) }
                : { report: compactReportForCopilot(result) };
  const copilotData = { ...pageCopilotData, capability_profile: capabilityProfile };
  const handleCopilotNavigate = target => {
    if (target === 'result') {
      if (result) go('result');
      else if (history[0]) viewRecord(history[0]);
      return;
    }
    if (target === 'compare') {
      openCompare(history);
      return;
    }
    if (target === 'rewrite') {
      setSelectedRewrite(null);
      setRewriteContext(result ? { target: result.target || result.jdName || '', analysis: result } : null);
    }
    go(target || 'landing');
  };
  const withAuth = page => <>{page}<EvidenCopilot key={user?.id || 'guest'} token={token} userId={user?.id} page={copilotPage} contextLabel={copilotContext} context={copilotData} onNavigate={handleCopilotNavigate} />{showAuth && <AuthModal onClose={closeAuth} onSuccess={handleAuthSuccess} />}{showLogoutConfirm && <div className="modal-backdrop" role="presentation" onClick={() => setShowLogoutConfirm(false)}><div className="confirm-modal editorial-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><small>SIGN OUT</small><h3>确认退出登录？</h3><p>退出后将返回首页</p><div className="modal-actions"><button className="secondary" onClick={() => setShowLogoutConfirm(false)}>取消</button><button className="primary danger-solid" onClick={confirmLogout}>确认退出</button></div></div></div>}</>;

  if (step === 'landing') return withAuth(<Landing onStart={() => requireLogin('input')} onScreenJobs={() => requireLogin('screening')} onOptimizeResume={() => { setRewriteContext(null); setSelectedRewrite(null); requireLogin('rewrite'); }} onOpenHistory={() => requireLogin('history')} onOpenApplications={() => requireLogin('applications')} historyCount={isLoggedIn ? history.length : 0} applicationCount={isLoggedIn ? applications.length : 0} user={user} latestReport={isLoggedIn ? history[0] : null} onViewLatest={viewRecord} onAuth={() => setShowAuth(true)} onLogout={() => setShowLogoutConfirm(true)} />);
  if (step === 'screening') return withAuth(<JobScreening key={selectedScreening?.id || 'new-screening'} token={token} user={user} onBack={() => setStep('landing')} onStart={() => setStep('input')} onAnalyze={saveAndShowResult} onSaveScreening={saveScreeningRecord} initialRecord={selectedScreening} />);
  if (step === 'rewrite') return withAuth(<RewritePage key={selectedRewrite?.id || `${rewriteContext?.target || 'default'}-${user?.id || 'guest'}`} token={token} user={user} initialContext={rewriteContext} initialRecord={selectedRewrite} onSaveRewrite={saveRewriteRecord} onBack={backFromCurrent} onManageResume={() => setStep('input')} />);
  if (step === 'input') return withAuth(<InputPanel token={token} user={user} onAnalyze={saveAndShowResult} onBack={backFromCurrent} onOpenHistory={() => requireLogin('history')} onOpenRewrite={context => { setSelectedRewrite(null); setRewriteContext(context); go('rewrite'); }} />);
  if (step === 'history') return withAuth(<HistoryPage records={history} screeningRecords={screeningHistory} rewriteRecords={rewriteHistory} onView={viewRecord} onViewScreening={viewScreeningRecord} onViewRewrite={viewRewriteRecord} onDelete={deleteRecord} onDeleteScreening={deleteScreeningRecord} onDeleteRewrite={deleteRewriteRecord} onBack={() => setStep('landing')} onCompare={openCompare} />);
  if (step === 'compare') return withAuth(<ComparePage records={compareRecords} onBack={() => setStep('history')} onView={viewRecord} />);
  if (step === 'applications') return withAuth(<ApplicationsPage applications={applications} onChange={updateApplications} onBack={() => setStep('landing')} onViewReport={viewApplicationReport} />);
  return withAuth(<ResultPage result={result} onBack={backFromCurrent} backLabel={previousStep === 'history' ? '返回历史报告' : previousStep === 'compare' ? '返回岗位对比' : previousStep === 'applications' ? '返回投递管理' : '返回上一步'} showHistoryButton={previousStep !== 'history'} onHome={() => setStep('landing')} onOpenHistory={() => requireLogin('history')} onCompare={() => openCompare(history)} onAddApplication={addCurrentReportToApplications} applicationAdded={Boolean(currentApplication)} />);
}

createRoot(document.getElementById('root')).render(<App />);
