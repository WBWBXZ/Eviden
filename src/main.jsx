import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BadgeCheck, BrainCircuit, BriefcaseBusiness, CheckCircle2, ChevronRight, FileText, Gauge, Layers3, Lightbulb, Route, Sparkles, Target, UploadCloud } from 'lucide-react';
import './styles.css';

const sampleResume = `胥哲｜产品运营 / AI 产品方向\n\n字节跳动 TikTok 商业化产品运营\n- 负责 TTMS 区域产品运营，基于销售反馈和市场使用数据沉淀 Product Feedback，推动需求优先级评估与产品迭代落地。\n- 参与 Aiva Agent、Content Copilot、AI Workflow 等 AI 能力迭代，围绕准确率、可用性和业务场景设计优化方向。\n- 排查 Dashboard 数据异常，结合指标归因、销售口径和脚本逻辑定位问题并同步业务方。\n\n项目经历\n- Aiva Agent：推动从 Q&A 向 Agent 能力演进，优化知识库、Prompt 和多轮对话记忆。\n- TTMS：支持欧洲市场商业化产品运营，协同销售、产品和区域 POC 处理需求反馈。`;

const sampleJD = `AI Product Manager Intern\n\nResponsibilities:\n- Define and iterate AI product features based on user needs and business scenarios.\n- Work with engineering and operation teams to improve LLM-powered workflows.\n- Analyze user feedback and product metrics to identify opportunities.\n- Prepare product requirement documents and support cross-functional delivery.\n\nRequirements:\n- Strong product sense and structured thinking.\n- Experience with AI products, agents, prompt engineering or LLM applications is preferred.\n- Data analysis ability, SQL preferred.\n- User research or customer-facing experience is a plus.`;

const dimensions = [
  { name: 'Experience Fit', value: 84, note: 'AI 产品与商业化产品经历强相关' },
  { name: 'Skill Fit', value: 74, note: '产品、AI、数据能力覆盖较好' },
  { name: 'Evidence Strength', value: 80, note: '多段经历可直接支撑 JD 要求' },
  { name: 'Resume Expression', value: 65, note: '表达偏运营，需要更产品化' },
];

function analyze(resume, jd, target) {
  const text = `${resume} ${jd}`.toLowerCase();
  const hasAI = /ai|agent|llm|prompt|aiva|copilot/.test(text);
  const hasData = /sql|data|metric|dashboard|指标|数据/.test(text);
  const hasCommercial = /commercial|sales|ttms|商业化|销售|market/.test(text);
  const hasResearch = /research|interview|用户访谈|用户研究|feedback|反馈/.test(text);
  const score = 68 + (hasAI ? 8 : 0) + (hasData ? 5 : 0) + (hasCommercial ? 4 : 0) + (hasResearch ? 3 : 0);
  return {
    target,
    score: Math.min(score, 88),
    action: score >= 82 ? 'Strong Apply' : score >= 74 ? 'Apply with Preparation' : 'Stretch Application',
    summary: '你的 AI 产品与商业化产品运营经历能形成主要优势，但简历需要补足数据分析和用户研究证据。',
    evidence: [
      { req: 'AI 产品经验', proof: 'Aiva Agent、Content Copilot、AI Workflow', level: hasAI ? 'Strong' : 'Medium' },
      { req: '商业化理解', proof: 'TTMS、区域产品运营、销售反馈闭环', level: hasCommercial ? 'Strong' : 'Medium' },
      { req: '数据分析', proof: 'Dashboard 排查、指标归因、Product Feedback', level: hasData ? 'Medium' : 'Weak' },
      { req: '用户研究', proof: hasResearch ? '反馈闭环可支撑，访谈口径需补充' : '缺少明确用户访谈或样本口径', level: hasResearch ? 'Medium' : 'Weak' },
    ],
    gaps: [
      { level: 'High', title: 'SQL / 数据证据不够显性', desc: '如果 JD 明确写 SQL，需要补一段可验证的数据分析案例。' },
      { level: 'Medium', title: '用户研究表达偏弱', desc: '把销售反馈、区域 POC 沟通整理成需求洞察故事。' },
      { level: 'Medium', title: '产品判断需要前置', desc: '把“执行了什么”改成“为什么这样判断、如何取舍”。' },
    ],
    rewrites: [
      { before: '负责 TTMS 产品运营，协同销售和产品团队推进需求落地。', after: '负责 TikTok 商业化产品 TTMS 的区域产品运营，基于销售反馈与市场使用数据沉淀 Product Feedback，推动需求优先级评估和产品迭代落地。' },
      { before: '参与 Aiva Agent 相关能力优化。', after: '参与 Aiva Agent 从 Q&A 到 Agent 能力的产品迭代，围绕知识库命中、Prompt 表达和多轮对话记忆优化 AI 工作流体验。' },
    ],
  };
}

function Landing({ onStart }) {
  return <section className="landing">
    <div className="nav"><div className="brand"><span className="brand-mark">E</span><div><b>Eviden</b><small>AI Career Copilot</small></div></div><div className="nav-links"><span>Analyze</span><span>Evidence</span><span>Resume</span><button onClick={onStart}>Start analysis</button></div></div>
    <div className="hero-grid">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={14}/> Evidence + Evan inspired</div>
        <h1>Know your fit.<br/>Prove your edge.</h1>
        <p>Eviden 把 JD、简历和目标岗位转成一张证据链地图：哪些经历能证明你匹配，哪些能力需要补，投递前应该先改哪里。</p>
        <div className="hero-actions"><button className="primary" onClick={onStart}>Analyze a JD <ArrowRight size={18}/></button><button className="secondary">View sample report</button></div>
        <div className="hero-stats"><div><b>78</b><span>Fit score</span></div><div><b>4</b><span>Matched evidence</span></div><div><b>2h</b><span>Prep estimate</span></div></div>
      </div>
      <div className="hero-art">
        <div className="glass screen-card">
          <div className="mock-head"><b>AI Product Manager</b><span>Apply with Preparation</span></div>
          <div className="mock-score"><div className="ring"><b>78</b></div><div><b>Strong direction fit</b><p>AI product and commercial ops are your strongest proof points.</p></div></div>
          <div className="mini-bars">{dimensions.map(d => <div key={d.name}><span>{d.name}</span><i><em style={{width: `${d.value}%`}} /></i></div>)}</div>
        </div>
        <div className="glass float-card left"><b>Evidence path</b><p>Aiva Agent → AI Product → JD Requirement</p></div>
        <div className="glass float-card right"><b>Resume action</b><p>Rewrite bullets with proof, not buzzwords.</p></div>
      </div>
    </div>
  </section>
}

function InputPanel({ onAnalyze }) {
  const [resume, setResume] = useState(sampleResume);
  const [jd, setJd] = useState(sampleJD);
  const [target, setTarget] = useState('AI Product Manager');
  return <section className="workspace input-page">
    <div className="page-head"><div><small>Step 1</small><h2>Upload your proof. Paste the role.</h2><p>Phase 1 先用文本输入跑通主链路，真实 API 和文件解析会作为下一步接入。</p></div><button className="primary" onClick={() => onAnalyze(analyze(resume, jd, target))}>Generate analysis <BrainCircuit size={18}/></button></div>
    <div className="input-grid">
      <div className="input-card"><div className="card-title"><FileText size={18}/><b>Resume / Evidence Profile</b><span>sample loaded</span></div><textarea value={resume} onChange={e => setResume(e.target.value)} /></div>
      <div className="input-card"><div className="card-title"><BriefcaseBusiness size={18}/><b>Target JD</b><span>{target}</span></div><input value={target} onChange={e => setTarget(e.target.value)} /><textarea value={jd} onChange={e => setJd(e.target.value)} /></div>
    </div>
    <div className="hint-row"><div><UploadCloud size={18}/><span>PDF / DOCX upload placeholder</span></div><div><Route size={18}/><span>API-ready JSON workflow reserved</span></div><div><BadgeCheck size={18}/><span>Missing evidence will not be invented</span></div></div>
  </section>
}

function ResultPage({ result, onBack }) {
  const radar = useMemo(() => dimensions.map(d => ({...d, value: d.name === 'Resume Expression' ? 65 : d.value })), []);
  return <section className="workspace result-page">
    <div className="page-head"><div><small>Step 2</small><h2>{result.target} · Match Analysis</h2><p>{result.summary}</p></div><div className="head-actions"><button className="secondary" onClick={onBack}>New analysis</button><button className="primary">Export plan</button></div></div>
    <div className="result-grid">
      <main className="result-main">
        <div className="score-card"><div className="big-ring"><b>{result.score}</b><span>Fit Score</span></div><div className="dim-grid">{radar.map(d => <div className="dim" key={d.name}><div><b>{d.name}</b><span>{d.value}</span></div><i><em style={{width:`${d.value}%`}} /></i><p>{d.note}</p></div>)}</div></div>
        <div className="panel"><div className="panel-head"><b>Evidence Match Map</b><span>JD requirement → resume proof</span></div>{result.evidence.map(item => <div className="evidence-row" key={item.req}><div><b>{item.req}</b><p>{item.proof}</p></div><span className={`level ${item.level.toLowerCase()}`}>{item.level}</span></div>)}</div>
        <div className="panel"><div className="panel-head"><b>Resume Rewrite Suggestions</b><span>bullet-level only</span></div>{result.rewrites.map((r, i) => <div className="rewrite-row" key={i}><div><label>Before</label><p>{r.before}</p></div><ChevronRight size={18}/><div className="after"><label>After</label><p>{r.after}</p></div></div>)}</div>
      </main>
      <aside className="result-rail">
        <div className="decision-card"><small>Recommended Action</small><h3>{result.action}</h3><p>建议投递前用 2–3 小时调整简历表达，并准备 1 个 AI 产品迭代案例和 1 个数据分析案例。</p><button className="primary full">Tailor resume</button></div>
        <div className="panel compact"><div className="panel-head"><b>Top Gaps</b></div>{result.gaps.map(g => <div className="gap" key={g.title}><span className={g.level.toLowerCase()}>{g.level}</span><div><b>{g.title}</b><p>{g.desc}</p></div></div>)}</div>
        <div className="panel compact"><div className="panel-head"><b>Claim Stress Test</b></div><ul><li>80%→95% 准确率如何定义？</li><li>样本量和评测集怎么构建？</li><li>如果重做一次，评测体系如何设计？</li></ul></div>
      </aside>
    </div>
  </section>
}

function App() {
  const [step, setStep] = useState('landing');
  const [result, setResult] = useState(null);
  if (step === 'landing') return <Landing onStart={() => setStep('input')} />;
  if (step === 'input') return <InputPanel onAnalyze={(r) => { setResult(r); setStep('result'); }} />;
  return <ResultPage result={result} onBack={() => setStep('input')} />;
}

createRoot(document.getElementById('root')).render(<App />);
