import React, { useState } from 'react';
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

function getStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistHistory(records) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 30)));
}

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

function Brand() {
  return <div className="brand"><span className="brand-mark">E</span><div><b>Eviden</b><small>证据链求职决策工具</small></div></div>;
}

function Landing({ onStart, onOpenHistory, historyCount }) {
  return <section className="landing product-home refined-home">
    <nav className="nav product-nav">
      <Brand />
      <div className="nav-links"><span>简历导入</span><span>JD 解析</span><span>申请策略</span><button onClick={onOpenHistory}>历史报告 {historyCount ? `(${historyCount})` : ''}</button><button onClick={onStart}>开始分析</button></div>
    </nav>

    <div className="product-hero refined-hero">
      <div className="product-copy refined-copy">
        <div className="product-eyebrow">AI Application Strategy Workspace</div>
        <h1><span>从 JD 到申请策略，</span><span>一次生成。</span></h1>
        <p>输入简历和目标 JD，Eviden 会生成匹配评分、证据地图、简历改写建议与面试准备方向。</p>
        <div className="home-logic" aria-label="产品逻辑说明">
          <div><span>输入</span><b>导入当前简历</b><p>页面会显示本次使用的简历文件</p></div>
          <div><span>解析</span><b>粘贴目标 JD</b><p>系统从 JD 中识别岗位要求</p></div>
          <div><span>输出</span><b>生成申请策略</b><p>匹配分、证据、缺口、改写建议</p></div>
        </div>
        <div className="hero-actions product-actions">
          <button className="primary" onClick={onStart}>生成申请策略 <ArrowRight size={18}/></button>
          <button className="secondary" onClick={onOpenHistory}>查看历史报告</button>
        </div>
      </div>

      <div className="product-mock refined-mock" aria-label="Eviden 样例报告预览">
        <div className="mock-window-bar"><span></span><span></span><span></span></div>
        <div className="match-pair">
          <div><label>当前简历</label><strong>AI 产品方向简历.pdf</strong></div>
          <div><label>目标岗位</label><strong>AI 产品经理实习生</strong></div>
        </div>
        <div className="report-preview">
          <div className="preview-score"><label>当前简历 × 目标岗位</label><strong>78</strong><span>匹配评分</span></div>
          <div className="preview-summary"><label>申请建议</label><b>准备后投递</b><p>优势来自 AI 产品理解与商业化运营经验；风险在数据分析、用户研究和结果量化表达。</p></div>
        </div>
        <div className="preview-table">
          <div><span>匹配证据</span><b>AI Agent / Prompt / 工作流迭代</b></div>
          <div><span>风险缺口</span><b>SQL、用户研究、结果量化</b></div>
          <div><span>申请动作</span><b>改写简历主线，准备追问案例</b></div>
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
  const [parseMessage, setParseMessage] = useState('支持 PDF / DOCX 简历，上传后会先解析成可核验文本。');
  const [jd, setJd] = useState(sampleJD);
  const [target, setTarget] = useState('AI 产品经理');
  const [company, setCompany] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (loading || parseStatus === 'parsing') return;
    if (!resume.trim()) {
      setError('请先上传并解析一份 PDF / DOCX 简历。');
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

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setResume('');
    setResumePreview('');
    setResumeFile(file);
    setParseStatus('parsing');
    setParseMessage('正在解析简历文件…');
    try {
      const parsed = await requestResumeParse(file);
      setResume(parsed.text || '');
      setResumePreview(parsed.preview || '');
      setParseStatus('success');
      setParseMessage(`已解析 ${parsed.char_count || 0} 个字符，可以生成报告。`);
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
    setParseStatus('idle');
    setParseMessage('支持 PDF / DOCX 简历，上传后会先解析成可核验文本。');
  };

  const canSubmit = !loading && parseStatus === 'success' && resume.trim().length >= 80 && jd.trim().length >= 50;
  const loadingSteps = ['读取简历证据', '解析目标 JD', '评估能力缺口', '生成申请策略'];

  return <section className="workspace input-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack} disabled={loading}>返回首页</button><button className="secondary" onClick={onOpenHistory} disabled={loading}>历史报告</button><button className="secondary" onClick={submit} disabled={!canSubmit}>{loading ? '分析中…' : '生成报告'}</button></div></nav>
    <div className="page-head">
      <div><small>STEP 01 / INPUT</small><h2>上传简历文件，并补充目标场景。</h2><p>填写公司与事业部后，Eviden 会用更明确的业务语境解读 JD，再把 PDF / DOCX 简历证据与岗位要求逐项对照。</p></div>
      <button className="primary" onClick={submit} disabled={!canSubmit}>{loading ? '正在生成申请策略…' : '生成岗位匹配报告'} <BrainCircuit size={18}/></button>
    </div>
    {loading && <div className="analysis-loading editorial-card" aria-live="polite">
      <div className="loading-orbit"><span></span><i></i><i></i><i></i></div>
      <div className="loading-copy"><b>正在生成你的证据链匹配报告</b><p>通常需要 20–40 秒。Eviden 正在核对 JD 要求、简历原文和申请建议。</p></div>
      <div className="loading-steps">{loadingSteps.map((step, index) => <span key={step} style={{ animationDelay: `${index * 0.45}s` }}>{step}</span>)}</div>
    </div>}
    {error && <div className="error-banner editorial-card"><b>分析没有成功</b><span>{error}</span></div>}

    <div className="input-grid">
      <div className="input-card editorial-card upload-card">
        <div className="card-title"><FileText size={18}/><b>简历文件</b><span>{parseStatus === 'success' ? '已解析' : 'PDF / DOCX'}</span></div>
        <label className={`resume-upload-zone ${parseStatus}`}>
          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} disabled={loading || parseStatus === 'parsing'} />
          <UploadCloud size={34}/>
          <b>{resumeFile ? resumeFile.name : '上传一份简历'}</b>
          <p>{parseMessage}</p>
        </label>
        {parseStatus === 'success' && <div className="resume-preview">
          <div><label>解析预览</label><button className="secondary" onClick={resetResume} disabled={loading}>重新上传</button></div>
          <p>{resumePreview}</p>
        </div>}
      </div>
      <div className="input-card editorial-card jd-card"><div className="card-title"><BriefcaseBusiness size={18}/><b>目标 JD</b><span>{[company, businessUnit, target].filter(Boolean).join(' · ') || target}</span></div><div className="context-fields"><input value={target} onChange={e => setTarget(e.target.value)} placeholder="岗位名称，例如 AI 产品经理实习生" /><input value={company} onChange={e => setCompany(e.target.value)} placeholder="公司，例如 快手 / 阿里 / 字节" /><input value={businessUnit} onChange={e => setBusinessUnit(e.target.value)} placeholder="事业部 / 方向，例如 主站 / 商业化 / 国际化" /></div><textarea value={jd} onChange={e => setJd(e.target.value)} /></div>
    </div>

    <div className="hint-row">
      <div><UploadCloud size={18}/><span>简历支持 PDF / DOCX 上传解析</span></div>
      <div><Route size={18}/><span>公司 / 事业部会进入历史记录与匹配语境</span></div>
      <div><BadgeCheck size={18}/><span>只基于证据判断，不编造经历</span></div>
    </div>
  </section>;
}

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
        <h2>{result.action}</h2>
        <p>{result.summary}</p>
        <div className="decision-tags"><span>优先级 {result.priority}</span><span>{result.actions?.length || 0} 项投递前动作</span><span>{result.evidence?.length || 0} 组证据映射</span></div>
      </div>
      <div className="decision-score"><span>综合匹配评分</span><b>{result.score}</b><em>/ 100</em><small>由 6 个维度加权计算</small></div>
    </div>

    <div className="result-grid result-grid-v2">
      <main className="result-main">
        <div className="panel editorial-card score-explain">
          <div className="panel-head"><div><b>为什么是 {result.score} 分</b><p>评分来自简历证据，不使用 JD 中的关键词为简历加分</p></div><span>维度分 × 权重 = 贡献分</span></div>
          <div className="score-table">
            {result.dimensions.map(item => <div className="score-row" key={item.name}>
              <div className="score-name"><b>{item.name}</b><span>权重 {item.weight}%</span></div>
              <div className="score-track"><i><em style={{ width: `${item.value}%` }} /></i><p>{item.note}</p></div>
              <div className="score-number"><b>{item.value}</b><span>贡献 {item.points}</span></div>
            </div>)}
          </div>
        </div>

        <div className="panel editorial-card evidence-map-v2">
          <div className="panel-head"><div><b>JD 要求 × 简历证据地图</b><p>每一项判断都能回到对应原文</p></div><span>要求 → 证据 → 诊断</span></div>
          {result.evidence.map((item, index) => <article className="evidence-card-v2" key={item.req}>
            <div className="evidence-card-head"><span className="row-index">0{index + 1}</span><div><small>{item.priority}</small><h3>{item.req}</h3></div><span className={`level ${item.level === '强' ? 'strong' : item.level === '中' ? 'medium' : 'weak'}`}>{item.level}证据</span></div>
            <div className="evidence-quotes">
              <div><label>JD 原文</label><p>“{item.jdQuote}”</p></div>
              <ArrowRight size={18}/>
              <div><label>简历原文</label><p>“{item.resumeQuote}”</p></div>
            </div>
            <div className="evidence-diagnosis"><div><label>匹配判断</label><p>{item.proof}</p></div><div><label>诊断</label><p>{item.diagnosis}</p></div><strong>{item.confidence}%<small>证据置信度</small></strong></div>
          </article>)}
        </div>

        <div className="panel editorial-card action-plan-v2">
          <div className="panel-head"><div><b>投递前优先行动</b><p>按投入产出比排序，不需要一次补齐所有缺口</p></div><span>优先级 {result.priority}</span></div>
          <div className="action-list-v2">{result.actions.map((item, index) => <div key={item.title}><span>0{index + 1}</span><section><b>{item.title}</b><p>{item.desc}</p></section><em>{item.effort}</em></div>)}</div>
        </div>

        <div className="panel editorial-card rewrite-panel-v2"><div className="panel-head"><div><b>简历改写建议</b><p>先改表达，不虚构尚未发生的结果</p></div><span>{result.rewrites?.length || 0} 条高优先级</span></div>{result.rewrites.map((r, i) => <div className="rewrite-row" key={i}><div><label>当前表达</label><p>{r.before}</p></div><ChevronRight size={18}/><div className="after"><label>建议表达</label><p>{r.after}</p></div></div>)}</div>
      </main>

      <aside className="result-rail">
        <div className="decision-card rail-summary"><small>下一步</small><h3>先增强证据，<br/>再提交申请。</h3><p>这份报告已经保存。你可以继续分析其他岗位，再进入多岗位对比看投递优先级。</p><button className="primary full" onClick={onCompare}>加入多岗位对比</button></div>
        <div className="panel compact editorial-card"><div className="panel-head"><b>优先补齐的缺口</b></div>{result.gaps.map(g => <div className="gap" key={g.title}><span className={g.level === '高' ? 'high' : 'medium'}>{g.level}</span><div><b>{g.title}</b><p>{g.desc}</p></div></div>)}</div>
        <div className="panel compact editorial-card question-panel"><div className="panel-head"><b>面试追问压力测试</b></div>{result.questions.map((question, index) => <div className="question" key={question}><span>Q{index + 1}</span><p>{question}</p></div>)}</div>
      </aside>
    </div>
  </section>;
}

function HistoryPage({ records, onView, onDelete, onBack, onCompare }) {
  const [selected, setSelected] = useState(records.slice(0, 3).map(item => item.id));
  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id].slice(-4));
  const selectedRecords = records.filter(item => selected.includes(item.id));

  return <section className="workspace history-page">
    <nav className="nav in-app"><Brand /><div className="nav-actions"><button className="secondary" onClick={onBack}>返回上一步</button><button className="primary" onClick={() => onCompare(selectedRecords)} disabled={selectedRecords.length < 2}>对比已选 {selectedRecords.length}</button></div></nav>
    <div className="page-head"><div><small>REPORT HISTORY / 历史报告</small><h2>保存每一次岗位判断。</h2><p>历史报告先保存在当前浏览器，方便你回看和做多岗位对比；后续接登录后会同步到账号。</p></div></div>
    {records.length === 0 ? <div className="empty-state editorial-card"><b>还没有历史报告</b><p>先完成一次简历 × JD 分析，报告会自动保存到这里。</p></div> : <div className="history-grid">
      {records.map(record => <article className="history-card editorial-card" key={record.id}>
        <label className="compare-check"><input type="checkbox" checked={selected.includes(record.id)} onChange={() => toggle(record.id)} />加入对比</label>
        <div className="history-score"><span>{record.result.action}</span><b>{record.result.score}</b></div>
        <h3>{record.target}</h3>
        <p>{record.result.summary}</p>
        <div className="history-meta"><span>{formatDate(record.createdAt)}</span><span>{record.result.priority}</span>{record.company && <span>{record.company}</span>}{record.businessUnit && <span>{record.businessUnit}</span>}</div>
        <div className="history-snippet"><label>JD 摘要</label><p>{record.jdSnippet}</p></div>
        <div className="history-actions"><button className="secondary" onClick={() => onView(record)}>查看报告</button><button className="secondary danger" onClick={() => onDelete(record.id)}>删除</button></div>
      </article>)}
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

function App() {
  const [step, setStep] = useState('landing');
  const [previousStep, setPreviousStep] = useState('landing');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(getStoredHistory);
  const [compareRecords, setCompareRecords] = useState([]);

  const go = next => {
    setPreviousStep(step);
    setStep(next);
  };

  const saveAndShowResult = (analysisResult, input) => {
    const record = makeHistoryRecord(analysisResult, input);
    const nextHistory = [record, ...history.filter(item => item.id !== record.id)].slice(0, 30);
    setHistory(nextHistory);
    persistHistory(nextHistory);
    setResult(record.result);
    setPreviousStep('input');
    setStep('result');
  };

  const deleteRecord = id => {
    const nextHistory = history.filter(item => item.id !== id);
    setHistory(nextHistory);
    persistHistory(nextHistory);
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

  if (step === 'landing') return <Landing onStart={() => go('input')} onOpenHistory={() => go('history')} historyCount={history.length} />;
  if (step === 'input') return <InputPanel onAnalyze={saveAndShowResult} onBack={backFromCurrent} onOpenHistory={() => go('history')} />;
  if (step === 'history') return <HistoryPage records={history} onView={viewRecord} onDelete={deleteRecord} onBack={backFromCurrent} onCompare={openCompare} />;
  if (step === 'compare') return <ComparePage records={compareRecords} onBack={() => setStep('history')} onView={viewRecord} />;
  return <ResultPage result={result} onBack={() => setStep('input')} onHome={() => setStep('landing')} onOpenHistory={() => go('history')} onCompare={() => openCompare(history)} />;
}

createRoot(document.getElementById('root')).render(<App />);
