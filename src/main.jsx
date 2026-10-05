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

const BACKEND_APP_URL = 'https://s541z02t.cn-east-fn.bytedance.net';

if (typeof window !== 'undefined' && window.location.hostname.includes('aime-site.bytedance.net')) {
  window.location.replace(`${BACKEND_APP_URL}${window.location.search || ''}`);
}

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

function analyze(resume, jd, target) {
  const resumeText = resume.toLowerCase();
  const hasAI = /ai|agent|llm|prompt|aiva|copilot|智能|大模型/.test(resumeText);
  const hasData = /sql|data|metric|dashboard|指标|数据/.test(resumeText);
  const hasCommercial = /commercial|sales|ttms|商业化|销售|market|客户/.test(resumeText);
  const hasResearch = /research|interview|用户访谈|用户研究|feedback|反馈|调研/.test(resumeText);

  const dimensions = [
    { name: '核心能力匹配', weight: 30, value: hasAI ? 84 : 58, note: 'AI 工作流与产品迭代经历能直接回应核心职责' },
    { name: '经历证据强度', weight: 25, value: hasAI && hasCommercial ? 78 : 62, note: '有真实项目证据，但个人决策与结果还需补强' },
    { name: '业务场景匹配', weight: 15, value: hasCommercial ? 88 : 60, note: '商业化产品与区域市场经验是差异化优势' },
    { name: '结果量化程度', weight: 10, value: 58, note: '缺少效率、采用率或业务影响等结果数据' },
    { name: '角色责任匹配', weight: 10, value: 68, note: '跨团队推进清楚，独立负责边界仍不够明确' },
    { name: '关键词与表达', weight: 10, value: hasData ? 70 : 60, note: '关键词基本覆盖，但需要把运营语言改为产品语言' },
  ].map(item => ({ ...item, points: Math.round(item.value * item.weight) / 100 }));
  const score = Math.round(dimensions.reduce((sum, item) => sum + item.points, 0));
  const action = score >= 82 ? '建议优先投递' : score >= 74 ? '建议准备后投递' : '建议谨慎投递';

  return {
    target,
    resumeName: 'AI 产品方向简历（当前输入）',
    jdName: `${target}（当前 JD）`,
    score,
    priority: score >= 82 ? 'A' : score >= 74 ? 'A-' : 'B',
    action,
    dimensions,
    summary: '岗位方向值得尝试。AI 产品理解、商业化场景和跨团队推进已有证据；投递前应优先补强个人产品判断、结果量化与数据分析深度。',
    evidence: [
      {
        req: '定义并迭代 AI 产品功能',
        priority: '核心要求',
        jdQuote: '基于用户需求和业务场景定义、迭代 AI 产品功能',
        proof: '参与 Aiva Agent 从 Q&A 向 Agent 能力演进，并优化 Prompt、知识库与多轮对话。',
        resumeQuote: '参与 Aiva Agent、Content Copilot、AI Workflow 等 AI 能力迭代',
        level: hasAI ? '强' : '弱',
        confidence: hasAI ? 88 : 42,
        diagnosis: '方向高度匹配；需要补充你具体定义了什么问题、如何判断方案优先级。',
      },
      {
        req: '分析反馈并推动产品落地',
        priority: '核心要求',
        jdQuote: '分析用户反馈和产品指标，识别机会点并推动落地',
        proof: '通过销售反馈、市场使用数据和区域 POC 信息沉淀 Product Feedback。',
        resumeQuote: '基于销售反馈和市场使用数据沉淀 Product Feedback，推动需求优先级评估',
        level: hasCommercial && hasResearch ? '强' : '中',
        confidence: hasCommercial ? 82 : 58,
        diagnosis: '具备真实业务闭环；如果能补出需求取舍和上线结果，证据会更完整。',
      },
      {
        req: '数据分析与指标能力',
        priority: '能力门槛',
        jdQuote: '具备数据分析能力，有 SQL 经验优先',
        proof: '有 Dashboard 异常排查和指标归因经历，但没有明确 SQL 使用证据。',
        resumeQuote: '结合指标归因、销售口径和脚本逻辑定位问题',
        level: hasData ? '中' : '弱',
        confidence: hasData ? 69 : 38,
        diagnosis: '指标意识成立，工具深度不足；这是最可能被追问的硬能力缺口。',
      },
      {
        req: '用户研究与需求洞察',
        priority: '加分要求',
        jdQuote: '有用户研究、客户沟通或商业化场景经验加分',
        proof: '销售反馈和区域 POC 沟通可作为需求输入，但尚未体现系统化研究方法。',
        resumeQuote: '协同销售、产品和区域 POC 处理需求反馈',
        level: hasResearch ? '中' : '弱',
        confidence: hasResearch ? 64 : 40,
        diagnosis: '有用户声音，没有样本设计、洞察归纳和验证过程。',
      },
    ],
    gaps: [
      { level: '高', title: '数据证据不够硬', desc: 'JD 明确偏好 SQL；需要准备“发现问题 → 定位指标 → 推动修正”的完整案例。' },
      { level: '中', title: '个人产品判断不突出', desc: '当前表达偏协同执行，需要说明你做了什么判断、舍弃了什么方案。' },
      { level: '中', title: '结果量化不足', desc: '补充采用率、效率提升、问题规模或覆盖市场等可信结果。' },
    ],
    actions: [
      { title: '重写两条核心经历', desc: '先改 Aiva Agent 与 TTMS，将产品判断、个人动作和结果放到句首。', effort: '约 45 分钟' },
      { title: '补一组数据案例', desc: '用 Dashboard 排查经历证明指标意识，并明确 SQL 能力的真实边界。', effort: '约 30 分钟' },
      { title: '准备三道高风险追问', desc: '围绕效果评估、个人判断和用户研究方法形成可核验回答。', effort: '约 30 分钟' },
    ],
    rewrites: [
      {
        before: '负责 TTMS 产品运营，协同销售和产品团队推进需求落地。',
        after: '负责 TikTok 商业化产品 TTMS 的区域运营闭环，基于销售反馈与市场使用数据识别高频需求，沉淀 Product Feedback 并推动需求优先级评估与迭代落地。',
      },
      {
        before: '参与 Aiva Agent 相关能力优化。',
        after: '参与 Aiva Agent 从 Q&A 到 Agent 能力的产品迭代，围绕知识库命中、Prompt 表达和多轮对话记忆优化 AI 工作流体验。',
      },
    ],
    questions: [
      '你如何定义 Aiva Agent 能力优化是否成功？使用了什么指标？',
      '哪一次需求排序真正体现了你的个人判断？为什么没有选择其他方案？',
      'Dashboard 异常排查中，你亲自完成了哪些分析，SQL 能力边界是什么？',
    ],
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function requestAnalysis({ resume, jd, target }) {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume, jd, target }),
  });

  if (!response.ok) {
    let message = '分析失败，请稍后重试。';
    try {
      const data = await response.json();
      message = data.detail || message;
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

function Landing({ onStart }) {
  return <section className="landing product-home refined-home">
    <nav className="nav product-nav">
      <Brand />
      <div className="nav-links"><span>简历导入</span><span>JD 解析</span><span>申请策略</span><button onClick={onStart}>开始分析</button></div>
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
          <button className="secondary" onClick={onStart}>查看示例分析</button>
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

function InputPanel({ onAnalyze }) {
  const [resume, setResume] = useState(sampleResume);
  const [jd, setJd] = useState(sampleJD);
  const [target, setTarget] = useState('AI 产品经理');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await requestAnalysis({ resume, jd, target });
      onAnalyze(result);
    } catch (err) {
      setError(err.message || '分析失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return <section className="workspace input-page">
    <nav className="nav in-app"><Brand /><button className="secondary" onClick={submit} disabled={loading}>{loading ? '生成中…' : '生成报告'}</button></nav>
    <div className="page-head">
      <div><small>STEP 01 / INPUT</small><h2>建立岗位与经历的对照关系。</h2><p>上传或粘贴目标 JD 与个人经历后，Eviden 会先识别岗位要求，再抽取可验证经历证据，形成匹配判断与申请策略。</p></div>
      <button className="primary" onClick={submit} disabled={loading}>{loading ? 'DeepSeek-V4-Pro 正在分析…' : '生成岗位匹配报告'} <BrainCircuit size={18}/></button>
    </div>
    {error && <div className="error-banner editorial-card"><b>分析没有成功</b><span>{error}</span></div>}

    <div className="input-grid">
      <div className="input-card editorial-card"><div className="card-title"><FileText size={18}/><b>你的经历 / 简历证据</b><span>已载入样例</span></div><textarea value={resume} onChange={e => setResume(e.target.value)} /></div>
      <div className="input-card editorial-card"><div className="card-title"><BriefcaseBusiness size={18}/><b>目标 JD</b><span>{target}</span></div><input value={target} onChange={e => setTarget(e.target.value)} /><textarea value={jd} onChange={e => setJd(e.target.value)} /></div>
    </div>

    <div className="hint-row">
      <div><UploadCloud size={18}/><span>下一步支持 PDF / DOCX 上传</span></div>
      <div><Route size={18}/><span>输出结构已预留真实 AI API</span></div>
      <div><BadgeCheck size={18}/><span>只基于证据判断，不编造经历</span></div>
    </div>
  </section>;
}

function ResultPage({ result, onBack }) {
  return <section className="workspace result-page result-v2">
    <nav className="nav in-app"><Brand /><button className="secondary" onClick={onBack}>重新分析</button></nav>

    <div className="report-context-bar">
      <div><span>当前简历</span><b>{result.resumeName}</b></div>
      <ArrowRight size={18}/>
      <div><span>目标岗位</span><b>{result.jdName}</b></div>
      <div className="report-status"><span>报告状态</span><b>已完成证据核验</b></div>
    </div>

    <div className="decision-hero editorial-card">
      <div className="decision-copy">
        <small>APPLICATION DECISION / 申请判断</small>
        <h2>{result.action}</h2>
        <p>{result.summary}</p>
        <div className="decision-tags"><span>优先级 {result.priority}</span><span>3 项投递前动作</span><span>4 组证据映射</span></div>
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
          <div className="panel-head"><div><b>投递前优先行动</b><p>按投入产出比排序，不需要一次补齐所有缺口</p></div><span>预计总计约 105 分钟</span></div>
          <div className="action-list-v2">{result.actions.map((item, index) => <div key={item.title}><span>0{index + 1}</span><section><b>{item.title}</b><p>{item.desc}</p></section><em>{item.effort}</em></div>)}</div>
        </div>

        <div className="panel editorial-card rewrite-panel-v2"><div className="panel-head"><div><b>简历改写建议</b><p>先改表达，不虚构尚未发生的结果</p></div><span>2 条高优先级</span></div>{result.rewrites.map((r, i) => <div className="rewrite-row" key={i}><div><label>当前表达</label><p>{r.before}</p></div><ChevronRight size={18}/><div className="after"><label>建议表达</label><p>{r.after}</p></div></div>)}</div>
      </main>

      <aside className="result-rail">
        <div className="decision-card rail-summary"><small>下一步</small><h3>先增强证据，<br/>再提交申请。</h3><p>这个岗位不是能力方向不匹配，而是现有简历还没有充分证明你的产品判断和结果影响。</p><button className="primary full">生成简历改写版</button></div>
        <div className="panel compact editorial-card"><div className="panel-head"><b>优先补齐的缺口</b></div>{result.gaps.map(g => <div className="gap" key={g.title}><span className={g.level === '高' ? 'high' : 'medium'}>{g.level}</span><div><b>{g.title}</b><p>{g.desc}</p></div></div>)}</div>
        <div className="panel compact editorial-card question-panel"><div className="panel-head"><b>面试追问压力测试</b></div>{result.questions.map((question, index) => <div className="question" key={question}><span>Q{index + 1}</span><p>{question}</p></div>)}</div>
      </aside>
    </div>
  </section>;
}

function App() {
  const [step, setStep] = useState('landing');
  const [result, setResult] = useState(null);
  if (step === 'landing') return <Landing onStart={() => setStep('input')} />;
  if (step === 'input') return <InputPanel onAnalyze={(r) => { setResult(r); setStep('result'); }} />;
  return <ResultPage result={result} onBack={() => setStep('input')} />;
}

createRoot(document.getElementById('root')).render(<App />);
