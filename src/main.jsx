import React, { useEffect, useState } from 'react';
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

function getStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
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
  return response.json();
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
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function requestAnalysis({ resume, jd, target, company, businessUnit }) {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume, jd, target, company, business_unit: businessUnit }),
  });

  if (!response.ok) {
    let message = '分析失败，请稍后重试。';
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

async function requestResumeParse(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/parse-resume`, {
    method: 'POST',
    body: formData,
  });

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
  const response = await fetch(`${API_BASE_URL}/api/rewrite-resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume, target, jd, company, business_unit: businessUnit }),
  });

  if (!response.ok) {
    let message = '简历优化失败，请稍后重试。';
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

function Landing({ onStart, onOpenHistory, historyCount, user, latestReport, onViewLatest, onAuth, onLogout }) {
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
        <h1><span>Make Potential</span><span>Evident.</span></h1>
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

function InputPanel({ onAnalyze, onBack, onOpenHistory }) {
  const [resume, setResume] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumePreview, setResumePreview] = useState('');
  const [parseStatus, setParseStatus] = useState('idle');
  const [parseMessage, setParseMessage] = useState('支持 PDF / DOCX；扫描版 PDF 会自动尝试 AI OCR');
  const [jd, setJd] = useState('');
  const [target, setTarget] = useState('');
  const [company, setCompany] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewrite, setRewrite] = useState(null);
  const [error, setError] = useState('');

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
      const result = await requestAnalysis({ resume, jd, target, company, businessUnit });
      onAnalyze(result, { resume, jd, target, company, businessUnit, resumeFileName: resumeFile?.name });
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
      setParseMessage(`已解析 ${parsed.char_count || 0} 个字符，可以生成报告`);
    } catch (err) {
      setParseStatus('error');
      setParseMessage(err.message || '简历解析失败，请换一个文件重试。');
      setResumeFile(null);
      event.target.value = '';
    }
  };

  const resetResume = () => {
    setResume('');
    setResumeFile(null);
    setResumePreview('');
    setRewrite(null);
    setParseStatus('idle');
    setParseMessage('支持 PDF / DOCX，建议上传可复制文本的简历');
  };

  const canSubmit = !loading && !rewriteLoading && parseStatus === 'success' && resume.trim().length >= 80 && target.trim().length >= 2 && jd.trim().length >= 50;
  const canOptimize = !loading && !rewriteLoading && parseStatus === 'success' && resume.trim().length >= 80 && target.trim().length >= 2;
  const loadingSteps = ['读取简历证据', '解析目标 JD', '评估能力缺口', '生成申请策略'];

  return <section className="workspace input-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack} disabled={loading || rewriteLoading}>返回首页</button><button className="secondary" onClick={onOpenHistory} disabled={loading || rewriteLoading}>历史报告</button><button className="secondary" onClick={optimizeResume} disabled={!canOptimize}>{rewriteLoading ? '优化中…' : '优化简历'}</button><button className="secondary" onClick={submit} disabled={!canSubmit}>{loading ? '分析中…' : '生成报告'}</button></div></nav>
    <div className="page-head">
      <div><small>STEP 01 / INPUT</small><h2>导入简历，匹配目标岗位</h2><p>填写岗位信息并粘贴 JD，生成岗位匹配报告</p></div>
      <div className="page-actions"><button className="secondary" onClick={optimizeResume} disabled={!canOptimize}>{rewriteLoading ? '正在优化…' : '优化简历表达'}</button><button className="primary" onClick={submit} disabled={!canSubmit}>{loading ? '生成中…' : '生成匹配报告'}</button></div>
    </div>
    {loading && <div className="analysis-loading editorial-card" aria-live="polite">
      <div className="loading-orbit"><span></span><i></i><i></i><i></i></div>
      <div className="loading-copy"><b>正在生成匹配报告</b><p>正在核对 JD 要求、简历原文与申请动作</p></div>
      <div className="loading-steps">{loadingSteps.map((step, index) => <span key={step} style={{ animationDelay: `${index * 0.45}s` }}>{step}</span>)}</div>
    </div>}
    {rewriteLoading && <div className="analysis-loading editorial-card" aria-live="polite"><div className="loading-orbit"><span></span><i></i><i></i><i></i></div><div className="loading-copy"><b>正在优化简历表达</b><p>基于原文事实重组经历表达，不新增未经证实的信息</p></div><div className="loading-steps"><span>识别经历主线</span><span>重写项目表达</span><span>校验证据边界</span></div></div>}
    {error && <div className="error-banner editorial-card"><b>处理未完成</b><span>{error}</span></div>}

    <div className="input-grid">
      <div className="input-card editorial-card upload-card">
        <div className="card-title"><FileText size={18}/><b>简历文件</b><span>{parseStatus === 'success' ? '已解析' : 'PDF / DOCX'}</span></div>
        <label className={`resume-upload-zone ${parseStatus}`}>
          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} disabled={loading || rewriteLoading || parseStatus === 'parsing'} />
          <UploadCloud size={34}/>
          <b>{resumeFile ? resumeFile.name : '上传一份简历'}</b>
          <p>{parseMessage}</p>
        </label>
        {parseStatus === 'success' && <div className="resume-preview">
          <div><label>解析预览</label><button className="secondary" onClick={resetResume} disabled={loading || rewriteLoading}>重新上传</button></div>
          <p>{resumePreview}</p>
        </div>}
      </div>
      <div className="input-card editorial-card jd-card"><div className="card-title"><BriefcaseBusiness size={18}/><b>目标 JD</b><span>{[company, businessUnit, target].filter(Boolean).join(' · ') || '待填写'}</span></div><div className="context-fields"><input value={target} onChange={e => setTarget(e.target.value)} placeholder="岗位名称" /><input value={company} onChange={e => setCompany(e.target.value)} placeholder="公司（选填）" /><input value={businessUnit} onChange={e => setBusinessUnit(e.target.value)} placeholder="事业部 / 方向（选填）" /></div><textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="粘贴目标岗位 JD（生成匹配报告必填；仅优化简历可不填）" /></div>
    </div>

    <div className="hint-row">
      <div><UploadCloud size={18}/><span>支持文本型 PDF / DOCX</span></div>
      <div><Route size={18}/><span>公司和业务方向选填，用于补充岗位场景</span></div>
      <div><BadgeCheck size={18}/><span>仅依据简历与 JD 进行分析</span></div>
    </div>
    {rewrite && <div className="rewrite-output editorial-card"><div className="panel-head"><div><b>{rewrite.positioning}</b><p>{rewrite.strategy}</p></div><span>{rewrite.bullets?.length || 0} 条建议</span></div><div className="rewrite-list">{rewrite.bullets.map((item, index) => <div className="rewrite-row" key={index}><div><label>{item.section} · 原文</label><p>{item.before}</p></div><ChevronRight size={18}/><div className="after"><label>建议表达</label><p>{item.after}</p><small>{item.evidence_boundary}</small></div></div>)}</div><div className="rewrite-extra"><div><b>HR 开场白</b><p>{rewrite.hr_intro}</p></div><div><b>还需补充</b><p>{(rewrite.gaps || []).join(' / ') || '暂无'}</p></div></div></div>}
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
const matchLabelText = (level) => ({ 强: '强匹配', 中: '部分匹配', 弱: '弱匹配' }[level] || `${level || '中'}匹配`);
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

    <div className="decision-hero editorial-card">
      <div className="decision-copy">
        <small>APPLICATION DECISION / 申请判断</small>
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
            <div className="evidence-card-head clean-head"><span className="row-index">0{index + 1}</span><div><small>{item.priority}</small><h3>{trimUiEnd(item.jdQuote || item.req)}</h3></div><div className="evidence-badges"><span className={`level ${item.level === '强' ? 'strong' : item.level === '中' ? 'medium' : 'weak'}`}>{matchLabelText(item.level)}</span></div></div>
            <div className={`evidence-compare-grid ${String(item.resumeQuote || '').length < 120 ? 'short-evidence' : ''}`}>
              <section className="evidence-lane resume-lane"><label>简历证据</label><p>“{trimUiEnd(item.resumeQuote)}”</p></section>
              <section className="evidence-verdict"><div className="verdict-copy"><label>匹配判断</label><b>{trimUiEnd(item.proof)}</b><p>{cleanDiagnosis(item.diagnosis)}</p>{evidenceAction(item) && <div className="evidence-action"><label>具体调整建议</label><p>{evidenceAction(item)}</p></div>}</div></section>
            </div>
          </article>)}
        </div>

        <div className="panel compact editorial-card result-gaps"><div className="panel-head"><b>关键能力缺口</b></div>{result.gaps.map(g => <div className="gap" key={g.title}><span className={g.level === '高' ? 'high' : 'medium'}>{g.level}</span><div><b>{trimUiEnd(g.title)}</b><p>{trimUiEnd(g.desc)}</p></div></div>)}</div>

        <div className="panel editorial-card action-plan-v2">
          <div className="panel-head"><div><b>投递前行动清单</b></div><span>优先级 {result.priority}</span></div>
          <div className="action-list-v2">{result.actions.map((item, index) => <div key={item.title}><span>0{index + 1}</span><section><b>{trimUiEnd(item.title)}</b><p>{trimUiEnd(item.desc)}</p></section><em>{item.effort}</em></div>)}</div>
        </div>

        <div className="panel editorial-card rewrite-panel-v2"><div className="panel-head"><div><b>简历表达优化</b></div><span>{reportRewrites(result).length} 条高优先级</span></div>{reportRewrites(result).map((r, i) => <div className="rewrite-row" key={i}><div><label>当前表达</label><p>{trimUiEnd(r.before)}</p></div><ChevronRight size={18}/><div className="after"><label>建议表达</label><p>{trimUiEnd(r.after)}</p></div></div>)}</div>

        <div className="panel compact editorial-card question-panel result-questions"><div className="panel-head"><b>面试重点追问</b></div>{reportQuestions(result).map((question, index) => <div className="question" key={`${index}-${question}`}><span>Q{index + 1}</span><p>{trimUiEnd(question)}</p></div>)}</div>

        <div className="decision-card result-next-step"><small>下一步</small><h3>先补强证据，再提交申请</h3><p>报告已保存，可继续分析其他岗位，再进入多岗位对比看投递优先级</p><button className="primary" onClick={onCompare}>加入多岗位对比</button></div>
      </main>
    </div>
  </section>;
}

function HistoryPage({ records, onView, onDelete, onBack, onCompare }) {
  const [selected, setSelected] = useState(records.slice(0, 3).map(item => item.id));
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id].slice(-4));
  const selectedRecords = records.filter(item => selected.includes(item.id));
  const pendingDeleteRecord = records.find(item => item.id === confirmDeleteId);
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    onDelete(confirmDeleteId);
    setConfirmDeleteId('');
  };

  return <section className="workspace history-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回上一步</button><button className="primary" onClick={() => onCompare(selectedRecords)} disabled={selectedRecords.length < 2}>对比已选 {selectedRecords.length}</button></div></nav>
    <div className="page-head"><div><small>REPORT HISTORY / 历史报告</small><h2>保存每一次岗位判断</h2><p>历史报告会同步到当前账号，退出登录后本机不展示报告内容</p></div></div>
    {records.length === 0 ? <div className="empty-state editorial-card"><b>还没有历史报告</b><p>先完成一次简历 × JD 分析，报告会自动保存到这里</p></div> : <div className="history-grid">
      {records.map(record => <article className="history-card editorial-card" key={record.id}>
        <label className="compare-check"><input type="checkbox" checked={selected.includes(record.id)} onChange={() => toggle(record.id)} />加入对比</label>
        <div className="history-score"><span>{record.result.action}</span><b>{record.result.score}</b></div>
        <h3>{record.target}</h3>
        <p>{record.result.summary}</p>
        <div className="history-meta"><span>{formatDate(record.createdAt)}</span><span>{record.result.priority}</span>{record.company && <span>{record.company}</span>}{record.businessUnit && <span>{record.businessUnit}</span>}</div>
        <div className="history-snippet"><label>JD 摘要</label><p>{record.jdSnippet}</p></div>
        <div className="history-actions"><button className="secondary" onClick={() => onView(record)}>查看报告</button><button className="secondary danger" onClick={() => setConfirmDeleteId(record.id)}>删除</button></div>
      </article>)}
    </div>}
    {pendingDeleteRecord && <div className="modal-backdrop" role="presentation" onClick={() => setConfirmDeleteId('')}>
      <div className="confirm-modal editorial-card" role="dialog" aria-modal="true" aria-labelledby="delete-report-title" onClick={event => event.stopPropagation()}>
        <small>DELETE REPORT</small>
        <h3 id="delete-report-title">确认删除这份历史报告？</h3>
        <p>报告：{pendingDeleteRecord.target || '未命名岗位'}</p>
        <div className="modal-actions"><button className="secondary" onClick={() => setConfirmDeleteId('')}>取消</button><button className="primary danger-solid" onClick={confirmDelete}>确认删除</button></div>
      </div>
    </div>}
  </section>;
}

function ComparePage({ records, onBack, onView }) {
  const compared = records.slice(0, 4);
  return <section className="workspace compare-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回历史报告</button></div></nav>
    <div className="page-head"><div><small>ROLE COMPARISON / 多岗位对比</small><h2>先判断投哪个，再决定怎么准备。</h2><p>当前 v0 使用历史报告横向对比：匹配分、申请建议、主要优势与缺口。后续会支持同一简历批量分析多个 JD。</p></div></div>
    {compared.length < 2 ? <div className="empty-state editorial-card"><b>至少选择 2 份报告</b><p>回到历史报告，勾选 2–4 个岗位后再对比。</p></div> : <div className="compare-grid">
      {compared.map(record => <article className="compare-card editorial-card" key={record.id}>
        <div className="compare-score"><span>{record.target}</span><b>{record.result.score}</b><em>{record.result.action}</em></div>
        <div className="compare-section"><label>主要优势</label><p>{record.result.evidence?.[0]?.proof || record.result.summary}</p></div>
        <div className="compare-section"><label>最高风险</label><p>{record.result.gaps?.[0]?.title}：{record.result.gaps?.[0]?.desc}</p></div>
        <div className="compare-section"><label>优先行动</label><p>{record.result.actions?.[0]?.title}｜{record.result.actions?.[0]?.effort}</p></div>
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
  const [step, setStep] = useState('landing');
  const [previousStep, setPreviousStep] = useState('landing');
  const [result, setResult] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || '');
  const [user, setUser] = useState(getStoredUser);
  const [history, setHistory] = useState(getStoredHistory);
  const [compareRecords, setCompareRecords] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingStep, setPendingStep] = useState('');

  useEffect(() => {
    if (!token) {
      setUser(null);
      setHistory([]);
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
        setHistory(localRecords);
        persistHistory(localRecords, userInfo.id);
        try {
          const cloud = await fetchCloudReports(token);
          if (cancelled) return;
          const merged = mergeHistory(localRecords, cloud.reports || []);
          setHistory(merged);
          persistHistory(merged, userInfo.id);
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
    persistHistory(localRecords, auth.user.id);
    setToken(auth.token);
    setUser(auth.user);
    setHistory(localRecords);
    setShowAuth(false);
    const nextStep = pendingStep;
    if (nextStep) {
      go(nextStep);
      setPendingStep('');
    }
    Promise.allSettled(localRecords.map(record => saveCloudReport(auth.token, record)))
      .then(() => fetchCloudReports(auth.token))
      .then(cloud => {
        const merged = mergeHistory(localRecords, cloud.reports || []);
        setHistory(merged);
        persistHistory(merged, auth.user.id);
      })
      .catch(err => console.warn('sync history failed', err));
  };

  const confirmLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken('');
    setUser(null);
    setHistory([]);
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

  if (step === 'landing') return withAuth(<Landing onStart={() => requireLogin('input')} onOpenHistory={() => requireLogin('history')} historyCount={isLoggedIn ? history.length : 0} user={user} latestReport={isLoggedIn ? history[0] : null} onViewLatest={viewRecord} onAuth={() => setShowAuth(true)} onLogout={() => setShowLogoutConfirm(true)} />);
  if (step === 'input') return withAuth(<InputPanel onAnalyze={saveAndShowResult} onBack={backFromCurrent} onOpenHistory={() => requireLogin('history')} />);
  if (step === 'history') return withAuth(<HistoryPage records={history} onView={viewRecord} onDelete={deleteRecord} onBack={() => setStep('landing')} onCompare={openCompare} />);
  if (step === 'compare') return withAuth(<ComparePage records={compareRecords} onBack={() => setStep('history')} onView={viewRecord} />);
  return withAuth(<ResultPage result={result} onBack={() => setStep('input')} onHome={() => setStep('landing')} onOpenHistory={() => requireLogin('history')} onCompare={() => openCompare(history)} />);
}

createRoot(document.getElementById('root')).render(<App />);
