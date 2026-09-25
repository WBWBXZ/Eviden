import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  FileText,
  Gauge,
  Layers3,
  Lightbulb,
  PenLine,
  Route,
  Sparkles,
  Target,
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

const dimensions = [
  { name: '经历匹配', value: 84, note: 'AI 产品 + 商业化运营可形成主线' },
  { name: '能力覆盖', value: 76, note: '产品、AI、数据、协同均有证据' },
  { name: '证据强度', value: 81, note: '有项目和业务闭环，但需量化补强' },
  { name: '简历表达', value: 66, note: '当前偏“做了什么”，需改成“判断 + 结果”' },
];

const evidenceTimeline = [
  { label: 'JD 要求', value: 'AI 产品判断 / Agent 工作流 / 数据分析' },
  { label: '已有证据', value: 'Aiva Agent、Content Copilot、TTMS、Dashboard 排查' },
  { label: '缺口判断', value: 'SQL 与用户研究证据需要更显性' },
  { label: '投递动作', value: '先改简历 bullet，再准备 2 个追问案例' },
];

function analyze(resume, jd, target) {
  const text = `${resume} ${jd}`.toLowerCase();
  const hasAI = /ai|agent|llm|prompt|aiva|copilot|智能|大模型/.test(text);
  const hasData = /sql|data|metric|dashboard|指标|数据/.test(text);
  const hasCommercial = /commercial|sales|ttms|商业化|销售|market|客户/.test(text);
  const hasResearch = /research|interview|用户访谈|用户研究|feedback|反馈|调研/.test(text);
  const score = 66 + (hasAI ? 9 : 0) + (hasData ? 5 : 0) + (hasCommercial ? 5 : 0) + (hasResearch ? 3 : 0);

  return {
    target,
    score: Math.min(score, 88),
    action: score >= 82 ? '强烈建议投递' : score >= 74 ? '准备后投递' : '作为挑战岗位',
    summary: '你和这个岗位的核心匹配点在 AI 产品理解、商业化场景和跨团队推进；真正影响胜率的是：能不能把“运营执行”翻译成“产品判断 + 证据结果”。',
    evidence: [
      { req: 'AI 产品 / Agent 经验', proof: 'Aiva Agent、Content Copilot、AI Workflow 迭代', level: hasAI ? '强' : '中' },
      { req: '商业化产品理解', proof: 'TTMS 区域产品运营、销售反馈闭环、市场 POC 协同', level: hasCommercial ? '强' : '中' },
      { req: '数据分析与指标意识', proof: 'Dashboard 异常排查、指标归因、Product Feedback 汇总', level: hasData ? '中' : '弱' },
      { req: '用户研究 / 需求洞察', proof: hasResearch ? '有反馈闭环，可继续补用户样本与洞察过程' : '缺少明确访谈、样本、洞察提炼证据', level: hasResearch ? '中' : '弱' },
    ],
    gaps: [
      { level: '高', title: '数据证据不够硬', desc: '如果 JD 写 SQL / Metrics，需要准备一个“发现问题 → 定位指标 → 推动修正”的案例。' },
      { level: '中', title: '产品判断需要前置', desc: '减少“协同、跟进、支持”，改成“为什么做、怎么排序、结果如何”。' },
      { level: '中', title: '用户研究表达偏弱', desc: '把销售反馈、区域 POC 沟通整理成需求洞察，而不是简单信息收集。' },
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
  };
}

function Brand() {
  return <div className="brand"><span className="brand-mark">E</span><div><b>Eviden</b><small>证据链求职决策工具</small></div></div>;
}

function Landing({ onStart }) {
  return <section className="landing editorial-bg">
    <nav className="nav">
      <Brand />
      <div className="nav-links"><span>匹配判断</span><span>证据地图</span><span>简历改写</span><button onClick={onStart}>开始分析</button></div>
    </nav>

    <div className="hero-grid">
      <div className="hero-copy">
        <div className="issue-tag"><span>ISSUE 01</span><i />AI 求职不该只靠感觉</div>
        <h1>先判断值不值得投，<br/>再证明你为什么配。</h1>
        <p>Eviden 把 JD、简历和目标岗位拆成一条证据链：匹配在哪里，缺口在哪里，简历应该怎么改，面试前该准备什么。</p>
        <div className="hero-actions">
          <button className="primary" onClick={onStart}>分析一个岗位 <ArrowRight size={18}/></button>
          <button className="secondary" onClick={onStart}>查看样例报告</button>
        </div>
        <div className="hero-stats">
          <div><b>78</b><span>岗位匹配分</span></div>
          <div><b>4</b><span>可用证据</span></div>
          <div><b>2h</b><span>投递前准备</span></div>
        </div>
      </div>

      <div className="magazine-cover" aria-label="Eviden 产品预览">
        <div className="cover-top"><span>CAREER EVIDENCE MAP</span><span>2026</span></div>
        <div className="cover-title">FIT<br/>REPORT</div>
        <div className="cover-grid">
          <div className="score-stamp"><span>匹配分</span><b>78</b></div>
          <div className="cover-note"><b>建议：准备后投递</b><p>AI 产品与商业化产品运营是主要优势；数据和用户研究证据需要补强。</p></div>
        </div>
        <div className="tearline" />
        <div className="cover-list">
          {evidenceTimeline.map(item => <div key={item.label}><span>{item.label}</span><p>{item.value}</p></div>)}
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

  const submit = () => {
    setLoading(true);
    setTimeout(() => onAnalyze(analyze(resume, jd, target)), 650);
  };

  return <section className="workspace input-page">
    <nav className="nav in-app"><Brand /><button className="secondary" onClick={submit}>生成报告</button></nav>
    <div className="page-head">
      <div><small>STEP 01 / INPUT</small><h2>把岗位和经历放在同一张桌面上。</h2><p>先不急着“让 AI 改简历”，先判断：这个岗位到底值不值得投，以及你能拿什么证明自己匹配。</p></div>
      <button className="primary" onClick={submit} disabled={loading}>{loading ? '正在生成证据链…' : '生成岗位匹配报告'} <BrainCircuit size={18}/></button>
    </div>

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
  const radar = useMemo(() => dimensions.map(d => ({ ...d, value: d.name === '简历表达' ? 66 : d.value })), []);

  return <section className="workspace result-page">
    <nav className="nav in-app"><Brand /><button className="secondary" onClick={onBack}>重新分析</button></nav>
    <div className="page-head result-head">
      <div><small>STEP 02 / REPORT</small><h2>{result.target} · 证据链匹配报告</h2><p>{result.summary}</p></div>
      <div className="head-actions"><button className="secondary" onClick={onBack}>换一个 JD</button><button className="primary">导出行动清单</button></div>
    </div>

    <div className="result-grid">
      <main className="result-main">
        <div className="score-card editorial-card">
          <div className="score-block"><span>岗位匹配分</span><b>{result.score}</b><small>/ 100</small></div>
          <div className="dim-grid">{radar.map(d => <div className="dim" key={d.name}><div><b>{d.name}</b><span>{d.value}</span></div><i><em style={{ width: `${d.value}%` }} /></i><p>{d.note}</p></div>)}</div>
        </div>

        <div className="panel editorial-card"><div className="panel-head"><b>证据匹配地图</b><span>JD 要求 → 简历证据</span></div>{result.evidence.map(item => <div className="evidence-row" key={item.req}><div><b>{item.req}</b><p>{item.proof}</p></div><span className={`level ${item.level === '强' ? 'strong' : item.level === '中' ? 'medium' : 'weak'}`}>{item.level}</span></div>)}</div>

        <div className="panel editorial-card"><div className="panel-head"><b>简历改写建议</b><span>从职责描述改成产品证据</span></div>{result.rewrites.map((r, i) => <div className="rewrite-row" key={i}><div><label>现在这样写</label><p>{r.before}</p></div><ChevronRight size={18}/><div className="after"><label>建议改成</label><p>{r.after}</p></div></div>)}</div>
      </main>

      <aside className="result-rail">
        <div className="decision-card"><small>推荐动作</small><h3>{result.action}</h3><p>先用 2–3 小时重写简历表达，并准备 1 个 AI 产品迭代案例 + 1 个数据分析案例。</p><button className="primary full">生成简历改写版</button></div>
        <div className="panel compact editorial-card"><div className="panel-head"><b>优先补齐的缺口</b></div>{result.gaps.map(g => <div className="gap" key={g.title}><span className={g.level === '高' ? 'high' : 'medium'}>{g.level}</span><div><b>{g.title}</b><p>{g.desc}</p></div></div>)}</div>
        <div className="panel compact editorial-card"><div className="panel-head"><b>面试追问压力测试</b></div><ul><li>你怎么定义 AI 能力优化是否成功？</li><li>数据异常排查里，你的个人判断是什么？</li><li>如果重做一次，你会怎么设计评估指标？</li></ul></div>
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
