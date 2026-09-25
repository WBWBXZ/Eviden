# Eviden

**Know your fit. Prove your edge.**

Eviden 是一个 evidence-based 求职匹配与投递策略 Web App。用户输入简历 / 经历证据与目标 JD 后，系统会从岗位匹配、证据强度、能力缺口、简历表达和投递 ROI 等维度生成可解释的申请建议。

## 在线 Demo

https://a8223b45ac7d.aime-site.bytedance.net

## 当前版本

当前版本是第一版 Web Demo，先用本地 mock 逻辑跑通完整产品体验，暂未接入真实 AI API。

核心流程：

1. 输入 Resume / Evidence Profile
2. 输入目标 JD 和目标岗位
3. 生成 Fit Score 与多维评分
4. 查看 Evidence Match Map、Top Gaps、Resume Rewrite Suggestions 与 Claim Stress Test

## 产品定位

Eviden 不是单纯的“AI 改简历工具”，而是一个帮助求职者判断岗位是否值得投、应该怎么投、以及如何用证据证明自己匹配的申请策略工作台。

核心方法：

```text
Claim → Evidence → Gap → Action
```

## 技术栈

- React
- Vite
- CSS
- lucide-react

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## Roadmap

- 接入真实 AI API，替换本地 mock 分析逻辑
- 增加历史分析记录与 Dashboard
- 支持多份简历 / 多个 JD 对比
- 输出可复制的简历 bullet rewrite 与面试追问清单
- 增加投递策略、准备成本与申请优先级管理
