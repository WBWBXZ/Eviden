import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  ChevronRight,
  FileText,
  Route,
  UploadCloud,
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

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function defaultResumeCacheKey(userId) {
  return `${DEFAULT_RESUME_KEY_PREFIX}.${encodeURIComponent(String(userId))}`;
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!response.ok) {
    let message = '请求失败，请稍后重试';
    try {
      const data = await response.json();
      message = typeof data.detail === 'string' ? data.detail : message;
    } catch {
      // Keep default message.
    }
    const error = new Error(message);
    error.status = response.status;
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

async function pollAnalysisJob(jobId, token) {
  let consecutiveErrors = 0;
  for (;;) {
    try {
      const job = await apiJson(`/api/analysis-jobs/${encodeURIComponent(jobId)}`, { token });
      consecutiveErrors = 0;
      if (job.status === 'completed' && job.result) return job.result;
      if (job.status === 'failed') {
        const failure = new Error(job.error || '报告生成失败，请重新生成。');
        failure.jobFailed = true;
        throw failure;
      }
    } catch (error) {
      if (error.status || error.jobFailed) throw error;
      consecutiveErrors += 1;
      if (consecutiveErrors >= 10) throw new Error('暂时无法查询生成进度，任务仍会在后台继续。请稍后刷新页面查看。');
    }
    await wait(2000);
  }
}

async function requestAnalysis(input, token) {
  const body = {
    resume: input.resume,
    jd: input.jd,
    target: input.target,
    company: input.company,
    business_unit: input.businessUnit,
  };
  const job = await apiJson('/api/analysis-jobs', { method: 'POST', token, body });
  localStorage.setItem(PENDING_ANALYSIS_KEY, JSON.stringify({ jobId: job.job_id, input }));
  try {
    const result = await pollAnalysisJob(job.job_id, token);
    localStorage.removeItem(PENDING_ANALYSIS_KEY);
    return result;
  } catch (error) {
    if (error.status || !String(error.message || '').includes('后台继续')) localStorage.removeItem(PENDING_ANALYSIS_KEY);
    throw error;
  }
}

async function resumePendingAnalysis(token) {
  const pending = safeParse(localStorage.getItem(PENDING_ANALYSIS_KEY), null);
  if (!pending?.jobId || !pending?.input) return null;
  const result = await pollAnalysisJob(pending.jobId, token);
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

async function requestResumeRewrite({ resume, target, jd, company, businessUnit }) {
  return requestModelJson('/api/rewrite-resume', {
    resume,
    target,
    jd,
    company,
    business_unit: businessUnit,
  }, '简历优化失败，请稍后重试。');
}

function Brand() {
  return <div className="brand"><span className="brand-mark">E</span><div><b>Eviden</b><small>证据链求职决策工具</small></div></div>;
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

function Landing({ onStart, onScreenJobs, onOpenHistory, historyCount, user, latestReport, onViewLatest, onAuth, onLogout }) {
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
        <div className="nav-links nav-actions-compact"><button onClick={onOpenHistory}>历史报告 {historyCount ? `(${historyCount})` : ''}</button><button onClick={onStart}>开始分析</button></div>
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
    catch (err) { setError(err.message || '完整报告生成失败，请稍后重试。'); }
    finally { setDeepLoading(-1); }
  };
  return <section className="workspace screening-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回首页</button><button className="secondary" onClick={onStart}>单岗位分析</button></div></nav>
    <div className="page-head"><div><small>JOB FIT COMPARISON / 岗位适配度对比</small><h2>岗位适配度对比</h2><p>导入多个 JD，查看岗位排序、主要优势与关键缺口</p></div><div className="page-actions"><button className="primary" onClick={screen} disabled={loading || validJobs.length < 2}>{loading ? '对比中…' : '开始对比'}</button></div></div>
    {resume && <div className="screening-resume editorial-card"><div><small>本次使用的简历</small><b>{cachedResume?.filename || '账号默认简历'}</b><span>{cachedResume?.char_count || resume.length} 个字符 · 与单岗位分析共用</span></div><button className="secondary" onClick={onStart}>更换简历</button></div>}
    {notice && <div className="screening-toast editorial-card"><div><b>对比完成</b><span>{notice}</span></div><button className="primary" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}>查看结果</button></div>}
    {!resume && <div className="error-banner editorial-card"><b>还没有默认简历</b><span>先上传一份简历，再回来筛选岗位。</span><button className="secondary" onClick={onStart}>去上传简历</button></div>}
    {error && <div className="error-banner editorial-card"><b>暂未完成</b><span>{error}</span></div>}
    <div className="screening-inputs">{jobs.map((job, index) => <article className="editorial-card screening-input" key={index}><div className="card-title"><span>0{index + 1}</span><b>候选岗位</b>{jobs.length > 2 && <button onClick={() => setJobs(current => current.filter((_, i) => i !== index))}>移除</button>}</div><input value={job.title} onChange={e => updateJob(index, 'title', e.target.value)} placeholder="岗位名称"/><div className="two-fields"><input value={job.company} onChange={e => updateJob(index, 'company', e.target.value)} placeholder="公司（选填）"/><input value={job.businessUnit} onChange={e => updateJob(index, 'businessUnit', e.target.value)} placeholder="业务方向（选填）"/></div><textarea value={job.jd} onChange={e => updateJob(index, 'jd', e.target.value)} placeholder="粘贴完整 JD"/></article>)}</div>
    {jobs.length < 9 && <button className="secondary add-job" onClick={() => setJobs(current => [...current, { title: '', company: '', businessUnit: '', jd: '' }])}>＋ 添加岗位（最多 9 个）</button>}
    {loading && <div className="screening-progress editorial-card"><div className="loading-orbit"><span></span><i></i><i></i><i></i></div><div><b>正在比较岗位适配度</b><p>统一评分口径，完成后会自动定位到结果</p></div><div className="screening-progress-steps"><span>01 读取候选岗位</span><span>02 统一口径比较</span><span>03 生成推荐顺序</span></div></div>}
    {results.length > 0 && <div className="screening-results" ref={resultsRef}><div className="panel-head"><div><b>岗位优先级</b><p>从更值得投入准备的岗位开始</p></div><span>{results.length} 个岗位</span></div>{results.map((item, index) => <article className="editorial-card screening-result" key={`${item.jd_index}-${item.title}`}><div className="screening-rank"><span>#{index + 1}</span><strong>{Math.max(0, item.score - 10)}–{Math.min(100, item.score + 4)}</strong><small>预估匹配区间</small></div><div className="screening-copy"><small>{item.priority}</small><h3>{item.title}{item.company ? ` · ${item.company}` : ''}</h3><p>{item.verdict}</p><div className="screening-points"><div><label>主要匹配点</label>{item.match_points.map(point => <span key={point}>✓ {point}</span>)}</div><div><label>关键缺口</label>{item.gaps.map(gap => <span key={gap}>— {gap}</span>)}</div></div></div><button className="primary" onClick={() => deepAnalyze(item)} disabled={deepLoading >= 0}>{deepLoading === item.jd_index ? '生成中…' : '深入分析'}</button></article>)}</div>}
  </section>;
}

function InputPanel({ onAnalyze, onBack, onOpenHistory, onOpenScreening, token, user }) {
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
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewrite, setRewrite] = useState(null);
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
        if (!cancelled) setError(err.message || '暂时无法恢复后台生成任务，请稍后刷新页面。');
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
      setError(err.message || '分析失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const optimizeResume = async () => {
    if (rewriteLoading || loading || parseStatus === 'parsing') return;
    if (!resume.trim()) {
      setError('请先上传并解析一份 PDF / DOCX 简历。');
      return;
    }
    if (!target.trim()) {
      setError('请填写目标岗位。');
      return;
    }
    setRewriteLoading(true);
    setError('');
    try {
      const result = await requestResumeRewrite({ resume, target, jd, company, businessUnit });
      setRewrite(result);
    } catch (err) {
      setError(err.message || '简历优化失败，请稍后重试。');
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resumeMutationRef.current += 1;
    const previousResume = resume;
    setError('');
    setRewrite(null);
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
      setRewrite(null);
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

  const canSubmit = !loading && !rewriteLoading && parseStatus === 'success' && resume.trim().length >= 80 && target.trim().length >= 2 && jd.trim().length >= 50;
  const canOptimize = !loading && !rewriteLoading && parseStatus === 'success' && resume.trim().length >= 80 && target.trim().length >= 2;
  const loadingSteps = ['读取简历证据', '解析目标 JD', '评估能力缺口', '生成申请策略'];

  return <section className="workspace input-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回首页</button><button className="secondary" onClick={onOpenHistory}>历史报告</button><button className="secondary" onClick={onOpenScreening}>岗位适配度对比</button><button className="secondary" onClick={optimizeResume} disabled={!canOptimize}>{rewriteLoading ? '优化中…' : '优化简历'}</button><button className="secondary" onClick={submit} disabled={!canSubmit}>{loading ? '分析中…' : '生成报告'}</button></div></nav>
    <div className="page-head">
      <div><small>STEP 01 / INPUT</small><h2>导入简历，匹配目标岗位</h2><p>填写岗位信息并粘贴 JD，生成岗位匹配报告</p></div>
      <div className="page-actions"><button className="secondary" onClick={optimizeResume} disabled={!canOptimize}>{rewriteLoading ? '正在优化…' : '优化简历表达'}</button><button className="primary" onClick={submit} disabled={!canSubmit}>{loading ? '生成中…' : '生成匹配报告'}</button></div>
    </div>
    {loading && <div className="analysis-loading editorial-card" aria-live="polite">
      <div className="loading-orbit"><span></span><i></i><i></i><i></i></div>
      <div className="loading-copy"><b>报告正在后台生成</b><p>你可以离开当前页面，完成后重新打开也能继续查看</p></div>
      <div className="loading-steps">{loadingSteps.map((step, index) => <span key={step} style={{ animationDelay: `${index * 0.45}s` }}>{step}</span>)}</div>
    </div>}
    {rewriteLoading && <div className="analysis-loading editorial-card" aria-live="polite"><div className="loading-orbit"><span></span><i></i><i></i><i></i></div><div className="loading-copy"><b>正在优化简历表达</b><p>基于原文事实重组经历表达，不新增未经证实的信息</p></div><div className="loading-steps"><span>识别经历主线</span><span>重写项目表达</span><span>校验证据边界</span></div></div>}
    {error && <div className="error-banner editorial-card"><b>处理未完成</b><span>{error}</span></div>}

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
            <label className="secondary resume-change-action"><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} disabled={loading || rewriteLoading || removeLoading || parseStatus === 'parsing'} />{parseStatus === 'parsing' ? '正在更换…' : '更换简历'}</label>
            <button className="secondary danger" onClick={() => setRemoveConfirm(true)} disabled={loading || rewriteLoading || removeLoading || parseStatus === 'parsing'}>移除默认简历</button>
          </div>
          <p className="resume-replace-note">更换只影响后续分析；历史报告仍保留当时使用的简历快照</p>
        </div> : <label className={`resume-upload-zone ${parseStatus}`}>
          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} disabled={loading || rewriteLoading || removeLoading || parseStatus === 'parsing'} />
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
    {rewrite && <div className="rewrite-output editorial-card"><div className="panel-head"><div><b>{rewrite.positioning}</b><p>{rewrite.strategy}</p></div><span>{rewrite.bullets?.length || 0} 条建议</span></div><div className="rewrite-list">{rewrite.bullets.map((item, index) => <div className="rewrite-row" key={index}><div><label>{item.section} · 原文</label><p>{item.before}</p></div><ChevronRight size={18}/><div className="after"><label>建议表达</label><p>{item.after}</p><small>{item.evidence_boundary}</small></div></div>)}</div><div className="rewrite-extra"><div><b>HR 开场白</b><p>{rewrite.hr_intro}</p></div><div><b>还需补充</b><p>{(rewrite.gaps || []).join(' / ') || '暂无'}</p></div></div></div>}
    {removeConfirm && <div className="modal-backdrop" role="presentation" onClick={() => !removeLoading && setRemoveConfirm(false)}><div className="confirm-modal editorial-card" role="dialog" aria-modal="true" aria-labelledby="remove-resume-title" onClick={event => event.stopPropagation()}><small>REMOVE DEFAULT RESUME</small><h3 id="remove-resume-title">移除当前默认简历？</h3><p>将从当前账号和本机缓存中移除“{resumeFileName || '默认简历'}”。历史报告及其中的简历快照不会受影响。</p><div className="modal-actions"><button className="secondary" onClick={() => setRemoveConfirm(false)} disabled={removeLoading}>取消</button><button className="primary danger-solid" onClick={removeResume} disabled={removeLoading}>{removeLoading ? '正在移除…' : '确认移除'}</button></div></div></div>}
  </section>;
}

function RewritePage({ onBack }) {
  const [resume, setResume] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumePreview, setResumePreview] = useState('');
  const [parseStatus, setParseStatus] = useState('idle');
  const [parseMessage, setParseMessage] = useState('上传 PDF / DOCX 简历，生成可复制的改写建议。');
  const [target, setTarget] = useState('AI 产品经理');
  const [company, setCompany] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rewrite, setRewrite] = useState(null);

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setRewrite(null);
    setResume('');
    setResumePreview('');
    setResumeFile(file);
    setParseStatus('parsing');
    setParseMessage('正在解析简历文件，扫描版 PDF 可能需要更久…');
    try {
      const parsed = await requestResumeParse(file);
      setResume(parsed.text || '');
      setResumePreview(parsed.preview || '');
      setParseStatus('success');
      setParseMessage(`已解析 ${parsed.char_count || 0} 个字符，可以开始优化。`);
    } catch (err) {
      setParseStatus('error');
      setParseMessage(err.message || '简历解析失败，请换一个文件重试。');
      setResumeFile(null);
      event.target.value = '';
    }
  };

  const submit = async () => {
    if (loading || parseStatus !== 'success') return;
    setLoading(true);
    setError('');
    try {
      const result = await requestResumeRewrite({ resume, target, jd, company, businessUnit });
      setRewrite(result);
    } catch (err) {
      setError(err.message || '简历优化失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && parseStatus === 'success' && resume.trim().length >= 80 && target.trim().length >= 2;

  return <section className="workspace input-page rewrite-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack} disabled={loading}>返回上一步</button><button className="secondary" onClick={submit} disabled={!canSubmit}>{loading ? '优化中…' : '生成改写建议'}</button></div></nav>
    <div className="page-head"><div><small>RESUME OPTIMIZER</small><h2>把简历改成可投递版本。</h2><p>上传简历，填写目标岗位；JD 可选。Eviden 会基于原文证据改写表达，不新增未经证实的信息。</p></div><button className="primary" onClick={submit} disabled={!canSubmit}>{loading ? '正在优化简历…' : '生成简历优化方案'} <BrainCircuit size={18}/></button></div>
    {error && <div className="error-banner editorial-card"><b>优化没有成功</b><span>{error}</span></div>}
    <div className="input-grid">
      <div className="input-card editorial-card upload-card"><div className="card-title"><FileText size={18}/><b>简历文件</b><span>{parseStatus === 'success' ? '已解析' : 'PDF / DOCX'}</span></div><label className={`resume-upload-zone ${parseStatus}`}><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} disabled={loading || rewriteLoading || parseStatus === 'parsing'} /><UploadCloud size={34}/><b>{resumeFile ? resumeFile.name : '上传一份简历'}</b><p>{parseMessage}</p></label>{parseStatus === 'success' && <div className="resume-preview"><div><label>解析预览</label></div><p>{resumePreview}</p></div>}</div>
      <div className="input-card editorial-card jd-card"><div className="card-title"><BriefcaseBusiness size={18}/><b>优化目标</b><span>{[company, businessUnit, target].filter(Boolean).join(' · ') || '待填写'}</span></div><div className="context-fields"><input value={target} onChange={e => setTarget(e.target.value)} placeholder="岗位名称" /><input value={company} onChange={e => setCompany(e.target.value)} placeholder="公司（选填）" /><input value={businessUnit} onChange={e => setBusinessUnit(e.target.value)} placeholder="事业部 / 方向（选填）" /></div><textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="粘贴 JD（选填，但粘贴后会更贴合岗位）" /></div>
    </div>
    {rewrite && <div className="rewrite-output editorial-card"><div className="panel-head"><div><b>{rewrite.positioning}</b><p>{rewrite.strategy}</p></div><span>{rewrite.bullets?.length || 0} 条建议</span></div><div className="rewrite-list">{rewrite.bullets.map((item, index) => <div className="rewrite-row" key={index}><div><label>{item.section} · 原文</label><p>{item.before}</p></div><ChevronRight size={18}/><div className="after"><label>建议表达</label><p>{item.after}</p><small>{item.evidence_boundary}</small></div></div>)}</div><div className="rewrite-extra"><div><b>HR 开场白</b><p>{rewrite.hr_intro}</p></div><div><b>还需补充</b><p>{(rewrite.gaps || []).join(' / ') || '暂无'}</p></div></div></div>}
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

function ResultPage({ result, onBack, onHome, onOpenHistory, onCompare }) {
  return <section className="workspace result-page result-v2">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回上一步</button><button className="secondary" onClick={onOpenHistory}>历史报告</button><button className="secondary" onClick={onCompare}>多岗位对比</button><button className="secondary" onClick={onHome}>首页</button></div></nav>

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

        <div className="decision-card result-next-step"><small>NEXT STEP / 下一步</small><h3>按优先级完成准备，再决定投递节奏</h3><p>你可以继续筛选其他岗位，确认最值得投入准备的机会</p><button className="primary" onClick={onCompare}>对比其他岗位</button></div>
      </main>
    </div>
  </section>;
}

function HistoryPage({ records = [], screeningRecords = [], onView, onViewScreening, onDelete, onDeleteScreening, onBack, onCompare, onOpenScreening }) {
  const [tab, setTab] = useState('reports');
  const [selected, setSelected] = useState(records.slice(0, 3).map(item => item.id));
  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id].slice(-4));
  const selectedRecords = records.filter(item => selected.includes(item.id));
  return <section className="workspace history-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回首页</button><button className="secondary" onClick={onOpenScreening}>岗位适配度对比</button>{tab === 'reports' && <button className="primary" onClick={() => onCompare(selectedRecords)} disabled={selectedRecords.length < 2}>对比岗位（{selectedRecords.length}）</button>}</div></nav>
    <div className="page-head"><div><small>MY REPORTS / 我的报告</small><h2>我的报告</h2><p>查看完整岗位报告与岗位适配度对比记录</p></div></div>
    <div className="history-tabs"><button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>完整报告 <span>{records.length}</span></button><button className={tab === 'screenings' ? 'active' : ''} onClick={() => setTab('screenings')}>岗位筛选 <span>{screeningRecords.length}</span></button></div>
    {tab === 'reports' && (records.length === 0 ? <div className="empty-state editorial-card"><b>还没有完整报告</b><p>完成一次简历 × JD 分析后，报告会自动保存到这里</p></div> : <div className="history-grid">{records.map(record => <article className="history-card editorial-card" key={record.id}><label className="compare-check"><input type="checkbox" checked={selected.includes(record.id)} onChange={() => toggle(record.id)} />{selected.includes(record.id) ? '已选对比' : '选择对比'}</label><div className="history-score"><span>{record.result.action}</span><b>{record.result.score}</b></div><h3>{record.target}</h3><p>{record.result.summary}</p><div className="history-meta"><span>{formatDate(record.createdAt)}</span><span>{record.result.priority}</span>{record.company && <span>{record.company}</span>}</div><div className="history-actions"><button className="secondary" onClick={() => onView(record)}>查看完整报告</button><button className="secondary danger" onClick={() => onDelete(record.id)}>删除</button></div></article>)}</div>)}
    {tab === 'screenings' && (screeningRecords.length === 0 ? <div className="empty-state editorial-card"><b>还没有岗位筛选记录</b><p>完成一次岗位适配度对比后，结果会保存在这里</p></div> : <div className="history-grid screening-history-grid">{screeningRecords.map(record => <article className="history-card editorial-card" key={record.id}><div className="history-score"><span>岗位适配度对比</span><b>{record.results.length}</b></div><h3>{record.results[0]?.title || '岗位筛选'}</h3><p>{record.results.slice(0, 3).map(item => item.title).join('、')}{record.results.length > 3 ? ` 等 ${record.results.length} 个岗位` : ''}</p><div className="history-meta"><span>{formatDate(record.createdAt)}</span><span>{record.resumeName}</span></div><div className="history-actions"><button className="secondary" onClick={() => onViewScreening(record)}>继续查看</button><button className="secondary danger" onClick={() => onDeleteScreening(record.id)}>删除</button></div></article>)}</div>)}
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

function App() {
  const [step, setStep] = useState(() => localStorage.getItem(PENDING_ANALYSIS_KEY) ? 'input' : 'landing');
  const [previousStep, setPreviousStep] = useState('landing');
  const [result, setResult] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || '');
  const [user, setUser] = useState(getStoredUser);
  const [history, setHistory] = useState(getStoredHistory);
  const [screeningHistory, setScreeningHistory] = useState(() => getScreeningHistoryForUser(getStoredUser()?.id));
  const [selectedScreening, setSelectedScreening] = useState(null);
  const [compareRecords, setCompareRecords] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingStep, setPendingStep] = useState('');

  useEffect(() => {
    if (!token) {
      setUser(null);
      setHistory([]);
      setScreeningHistory([]);
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
        setHistory(localRecords);
        setScreeningHistory(localScreenings);
        persistHistory(localRecords, userInfo.id);
        persistScreeningHistory(localScreenings, userInfo.id);
        try {
          const cloud = await fetchCloudReports(token);
          if (cancelled) return;
          const cloudRecords = (cloud.reports || []).filter(item => item.record?.kind !== 'screening');
          const cloudScreenings = (cloud.reports || []).filter(item => item.record?.kind === 'screening');
          const merged = mergeHistory(localRecords, cloudRecords);
          const mergedScreenings = mergeHistory(localScreenings, cloudScreenings);
          setHistory(merged);
          setScreeningHistory(mergedScreenings);
          persistHistory(merged, userInfo.id);
          persistScreeningHistory(mergedScreenings, userInfo.id);
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
    persistHistory(localRecords, auth.user.id);
    persistScreeningHistory(localScreenings, auth.user.id);
    setToken(auth.token);
    setUser(auth.user);
    setHistory(localRecords);
    setScreeningHistory(localScreenings);
    setShowAuth(false);
    const nextStep = pendingStep;
    if (nextStep) {
      go(nextStep);
      setPendingStep('');
    }
    Promise.allSettled([...localRecords, ...localScreenings].map(record => saveCloudReport(auth.token, record)))
      .then(() => fetchCloudReports(auth.token))
      .then(cloud => {
        const cloudRecords = (cloud.reports || []).filter(item => item.record?.kind !== 'screening');
        const cloudScreenings = (cloud.reports || []).filter(item => item.record?.kind === 'screening');
        const merged = mergeHistory(localRecords, cloudRecords);
        const mergedScreenings = mergeHistory(localScreenings, cloudScreenings);
        setHistory(merged);
        setScreeningHistory(mergedScreenings);
        persistHistory(merged, auth.user.id);
        persistScreeningHistory(mergedScreenings, auth.user.id);
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
    setSelectedScreening(null);
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

  const backFromCurrent = () => setStep(previousStep || 'landing');
  const closeAuth = () => {
    setShowAuth(false);
    setPendingStep('');
  };
  const withAuth = page => <>{page}{showAuth && <AuthModal onClose={closeAuth} onSuccess={handleAuthSuccess} />}{showLogoutConfirm && <div className="modal-backdrop" role="presentation" onClick={() => setShowLogoutConfirm(false)}><div className="confirm-modal editorial-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><small>SIGN OUT</small><h3>确认退出登录？</h3><p>退出后将返回首页</p><div className="modal-actions"><button className="secondary" onClick={() => setShowLogoutConfirm(false)}>取消</button><button className="primary danger-solid" onClick={confirmLogout}>确认退出</button></div></div></div>}</>;

  if (step === 'landing') return withAuth(<Landing onStart={() => requireLogin('input')} onScreenJobs={() => requireLogin('screening')} onOpenHistory={() => requireLogin('history')} historyCount={isLoggedIn ? history.length : 0} user={user} latestReport={isLoggedIn ? history[0] : null} onViewLatest={viewRecord} onAuth={() => setShowAuth(true)} onLogout={() => setShowLogoutConfirm(true)} />);
  if (step === 'screening') return withAuth(<JobScreening key={selectedScreening?.id || 'new-screening'} token={token} user={user} onBack={() => setStep('landing')} onStart={() => setStep('input')} onAnalyze={saveAndShowResult} onSaveScreening={saveScreeningRecord} initialRecord={selectedScreening} />);
  if (step === 'input') return withAuth(<InputPanel token={token} user={user} onAnalyze={saveAndShowResult} onBack={backFromCurrent} onOpenHistory={() => requireLogin('history')} onOpenScreening={() => { setSelectedScreening(null); setStep('screening'); }} />);
  if (step === 'history') return withAuth(<HistoryPage records={history} screeningRecords={screeningHistory} onView={viewRecord} onViewScreening={viewScreeningRecord} onDelete={deleteRecord} onDeleteScreening={deleteScreeningRecord} onOpenScreening={() => { setSelectedScreening(null); setStep('screening'); }} onBack={() => setStep('landing')} onCompare={openCompare} />);
  if (step === 'compare') return withAuth(<ComparePage records={compareRecords} onBack={() => setStep('history')} onView={viewRecord} />);
  return withAuth(<ResultPage result={result} onBack={() => setStep('input')} onHome={() => setStep('landing')} onOpenHistory={() => requireLogin('history')} onCompare={() => openCompare(history)} />);
}

createRoot(document.getElementById('root')).render(<App />);
