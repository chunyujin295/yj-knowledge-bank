'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Boxes,
  Cable,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cloud,
  Database,
  ExternalLink,
  FileSignature,
  Fingerprint,
  GitCompareArrows,
  GraduationCap,
  KeyRound,
  Layers3,
  Library,
  Lightbulb,
  LockKeyhole,
  Map,
  Network,
  RadioTower,
  Route,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  comparisons,
  glossary,
  knowledgeModules,
  lineMeta,
  officialSources,
  products,
  scenarios,
  type Product,
  type ProductLine,
} from '@/lib/knowledge';

type View = 'map' | 'learn' | 'products' | 'compare' | 'scenarios' | 'glossary';

const lines: ProductLine[] = ['密码安全', '网络安全', '数据安全', '身份安全'];

const navItems: { id: View; label: string; hint: string; icon: typeof Map }[] = [
  { id: 'map', label: '总览地图', hint: '先建立坐标系', icon: Map },
  { id: 'learn', label: '密码知识库', hint: '原理与产品双向映射', icon: BookOpen },
  { id: 'products', label: '产品图鉴', hint: '30 类产品详解', icon: Boxes },
  { id: 'compare', label: '产品对比', hint: '相似产品别混淆', icon: GitCompareArrows },
  { id: 'scenarios', label: '部署场景', hint: '看产品如何协作', icon: Route },
  { id: 'glossary', label: '名词词典', hint: '随时查术语', icon: Library },
];

const lineStyles: Record<ProductLine, { bg: string; text: string; border: string; icon: typeof KeyRound }> = {
  密码安全: { bg: 'bg-cyan-500/10', text: 'text-cyan-800', border: 'border-cyan-700/20', icon: KeyRound },
  网络安全: { bg: 'bg-blue-500/10', text: 'text-blue-800', border: 'border-blue-700/20', icon: Network },
  数据安全: { bg: 'bg-amber-500/12', text: 'text-amber-800', border: 'border-amber-700/20', icon: Database },
  身份安全: { bg: 'bg-violet-500/10', text: 'text-violet-800', border: 'border-violet-700/20', icon: Fingerprint },
};

function LineBadge({ line }: { line: ProductLine }) {
  const style = lineStyles[line];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.bg} ${style.text} ${style.border}`}>
      <Icon className="size-3" /> {line}
    </span>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-xs font-bold tracking-[0.14em] text-primary/70">{eyebrow}</p>
      <h1 className="font-heading text-3xl font-black leading-tight tracking-[-0.04em] sm:text-[40px]">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-[15px]">{description}</p>
    </div>
  );
}

function MapView({ onNavigate, onSelect }: { onNavigate: (view: View) => void; onSelect: (product: Product) => void }) {
  const anchors = ['hsm', 'ca', 'vpn', 'db-encryption', 'iam', 'crypto-service-platform']
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean) as Product[];

  const layers = [
    { label: '业务使用层', question: '用户最终要完成什么？', examples: '电子签章 · 统一认证 · 零信任 · 堡垒机', color: 'bg-violet-500/10' },
    { label: '场景保护层', question: '保护哪类数据或通道？', examples: '数据库加密 · VPN · 视频安全 · HTTPS', color: 'bg-amber-500/10' },
    { label: '信任服务层', question: '如何证明身份与时间？', examples: 'CA · 签名验签 · 时间戳 · 协同签名', color: 'bg-blue-500/10' },
    { label: '资源管理层', question: '能力如何共享和治理？', examples: '密码服务平台 · KMS · 密码监管平台', color: 'bg-cyan-500/10' },
    { label: '密码硬件层', question: '密钥在哪里安全地存和算？', examples: '密码机 · 密码卡 · UKey · 物联网模块', color: 'bg-emerald-500/10' },
  ];

  return (
    <>
      <SectionHeading
        eyebrow="START HERE · 先看全局"
        title="先别背产品名，先看它在安全体系中的位置"
        description="这份清单不是 30 个互不相干的盒子。它们组成一条链：底层硬件安全保存密钥，中间平台把能力服务化，上层产品把密码能力嵌入网络、数据、身份和业务流程。"
      />

      <section className="rounded-[26px] border border-border bg-primary p-5 text-primary-foreground shadow-xl shadow-primary/10 sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--signal)]">一张图读懂四条产品线</p>
            <h2 className="mt-2 font-heading text-2xl font-black">造能力 → 护通道 → 护数据 → 信身份</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/70">四条线是产品目录的分类方式，不是四座孤岛。一个完整项目往往同时使用四条线里的产品。</p>
          </div>
          <button onClick={() => onNavigate('learn')} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--signal)] px-4 text-sm font-bold text-[#123c47] transition hover:-translate-y-0.5">开始 15 分钟入门 <ArrowRight className="size-4" /></button>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {lines.map((line, index) => {
            const style = lineStyles[line];
            const Icon = style.icon;
            const count = products.filter((product) => product.line === line).length;
            return (
              <button key={line} onClick={() => onNavigate('products')} className="group rounded-2xl border border-white/12 bg-white/[0.07] p-4 text-left transition hover:bg-white/[0.12]">
                <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><Icon className="size-5 text-[var(--signal)]" /></span><span className="font-mono text-xs text-primary-foreground/45">0{index + 1} / {count} 类</span></div>
                <p className="mt-4 font-heading text-lg font-black">{line} · {lineMeta[line].short}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--signal)]">{lineMeta[line].question}</p>
                <p className="mt-3 text-xs leading-5 text-primary-foreground/60">{lineMeta[line].description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-primary/70">分层心智模型</p><h2 className="mt-1 font-heading text-xl font-black">从业务往下问五次“靠什么”</h2></div><Layers3 className="size-6 text-primary/50" /></div>
          <div className="mt-5 space-y-2">
            {layers.map((layer, index) => (
              <div key={layer.label} className={`grid gap-2 rounded-2xl border border-border/70 p-4 sm:grid-cols-[34px_150px_1fr] sm:items-center ${layer.color}`}>
                <span className="grid size-8 place-items-center rounded-lg bg-card font-mono text-xs font-bold text-muted-foreground">{index + 1}</span>
                <div><p className="text-sm font-bold">{layer.label}</p><p className="text-[11px] text-muted-foreground">{layer.question}</p></div>
                <p className="text-xs leading-5 text-muted-foreground">{layer.examples}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold text-primary/70">先抓住六个锚点</p>
          <h2 className="mt-1 font-heading text-xl font-black">其他产品都可以和它们比较</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {anchors.map((product, index) => (
              <button key={product.id} onClick={() => onSelect(product)} className="group rounded-2xl border border-border bg-background/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="flex items-center justify-between"><span className="font-mono text-[10px] text-muted-foreground">ANCHOR 0{index + 1}</span><ChevronRight className="size-3.5 text-muted-foreground transition group-hover:translate-x-0.5" /></div>
                <p className="mt-3 text-sm font-black">{product.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{product.oneLiner}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[24px] border border-cyan-700/20 bg-cyan-500/[0.06] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-xs font-bold text-cyan-800">新增 · 知识与产品双向照应</p><h2 className="mt-1 font-heading text-xl font-black">不再把“原理课”和“产品手册”分开看</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">知识专题解释算法、密钥和协议怎样工作，并列出相关产品；产品详情反向显示它依赖哪些知识，以及这些知识在产品里承担什么作用。</p></div><button onClick={() => onNavigate('learn')} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">进入密码知识库 <ArrowRight className="size-4" /></button></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">{[['1', '先读知识', '看白话解释、工作步骤、具体例子和常见误区。'], ['2', '打开相关产品', '理解同一个知识点为什么会出现在多种产品中。'], ['3', '从产品返回知识', '在产品详情的“知识照应”中继续补齐原理。']].map(([step, title, body]) => <article key={step} className="rounded-2xl border border-border bg-card p-4"><span className="font-mono text-[10px] font-bold text-cyan-800">STEP {step}</span><p className="mt-2 text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p></article>)}</div>
      </section>

      <section className="mt-8 rounded-[24px] border border-amber-700/20 bg-amber-500/[0.08] p-5 sm:p-6">
        <div className="flex gap-4"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><h2 className="font-heading text-base font-black">目录里的四条“产品线” ≠ 密评标准里的四个“技术层面”</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">产品资料按密码安全、网络安全、数据安全、身份安全分类；GB/T 39786 则从物理和环境、网络和通信、设备和计算、应用和数据四个技术层面提出要求。一个产品可能支撑多个密评指标，但不能因为采购了产品就默认“通过密评”。</p></div></div>
      </section>
    </>
  );
}

function LearnView({ onNavigate, onSelect, focusedId }: { onNavigate: (view: View) => void; onSelect: (product: Product) => void; focusedId: string | null }) {
  const [level, setLevel] = useState<'全部' | '基础' | '核心' | '进阶'>('全部');
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const goals = [
    ['机密性', '不该看的人看不懂', '加密', LockKeyhole],
    ['完整性', '数据被改能发现', '摘要 / MAC / 签名', ShieldCheck],
    ['真实性', '确认对方确实是谁', '认证 / 证书 / 签名', Fingerprint],
    ['不可否认性', '事后有较强举证能力', '签名 + 时间 + 证据链', FileSignature],
    ['可用性', '需要时服务能工作', '集群 / 容灾 / 监控', Activity],
  ] as const;
  const primitives = [
    { name: 'SM4 / AES', type: '对称加密', role: '大量数据加密', metaphor: '同一把钥匙锁门和开门', caution: '速度快，但密钥如何安全送达是难点' },
    { name: 'SM2 / RSA / ECC', type: '公钥密码', role: '签名、密钥交换、小数据加密', metaphor: '公开的锁 + 私有的钥匙', caution: '不适合直接加密超大文件' },
    { name: 'SM3 / SHA-256', type: '密码杂凑', role: '生成数据指纹', metaphor: '文件的防伪指纹', caution: '只有摘要不证明是谁生成的' },
    { name: '真随机数', type: '随机源', role: '生成密钥、随机因子、挑战值', metaphor: '安全系统的“不可预测原料”', caution: '随机数可预测会让好算法也失效' },
  ];
  const filteredModules = knowledgeModules.filter((module) => {
    const matchesLevel = level === '全部' || module.level === level;
    const haystack = `${module.title}${module.question}${module.plain}${module.terms.join('')}`.toLowerCase();
    return matchesLevel && haystack.includes(knowledgeQuery.trim().toLowerCase());
  });
  const productCount = (moduleId: string) => {
    const module = knowledgeModules.find((item) => item.id === moduleId);
    return new Set(module?.productLinks.flatMap((link) => link.ids) ?? []).size;
  };

  return (
    <>
      <SectionHeading eyebrow="CRYPTO KNOWLEDGE BASE · 密码知识库" title="知识讲原理，产品讲它如何把原理变成能力" description="先用五个安全目标和四种密码原料建立基础，再进入 13 个详细专题。每个专题都包含工作过程、例子、常见误区和相关产品；点击产品还能反向查看它对应的知识。" />

      <section className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-bold text-primary/70">第一层 · 先建立判断框架</p><h2 className="mt-1 font-heading text-2xl font-black">任何产品都可以拆成“目标 → 机制 → 产品”</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">不要从型号开始背。先问它想保证什么，再问采用什么密码机制，最后才是哪个设备或平台来执行。</p></div><button onClick={() => onNavigate('products')} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">带着框架看产品 <ArrowRight className="size-4" /></button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {goals.map(([name, plain, method, Icon], index) => (
            <article key={name} className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex items-center justify-between"><Icon className="size-5 text-primary" /><span className="font-mono text-[10px] text-muted-foreground">GOAL 0{index + 1}</span></div>
              <h3 className="mt-5 font-heading text-lg font-black">{name}</h3><p className="mt-1 text-xs font-semibold text-primary/75">{plain}</p><p className="mt-3 border-t border-dashed border-border pt-3 text-[11px] leading-5 text-muted-foreground">常见机制：{method}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[24px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold text-primary/70">第二层 · 四种基础原料</p><h2 className="mt-1 font-heading text-2xl font-black">算法不是产品，算法要被正确地装进系统</h2></div><Sparkles className="size-6 text-amber-600" /></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
            <thead><tr className="text-xs text-muted-foreground"><th className="border-b border-border px-3 py-3">例子</th><th className="border-b border-border px-3 py-3">类型</th><th className="border-b border-border px-3 py-3">主要工作</th><th className="border-b border-border px-3 py-3">小白类比</th><th className="border-b border-border px-3 py-3">最容易踩的坑</th></tr></thead>
            <tbody>{primitives.map((item) => <tr key={item.name} className="align-top"><td className="border-b border-border/60 px-3 py-4 font-mono text-xs font-bold text-primary">{item.name}</td><td className="border-b border-border/60 px-3 py-4 font-bold">{item.type}</td><td className="border-b border-border/60 px-3 py-4 text-muted-foreground">{item.role}</td><td className="border-b border-border/60 px-3 py-4 text-muted-foreground">{item.metaphor}</td><td className="border-b border-border/60 px-3 py-4 text-muted-foreground">{item.caution}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-bold text-primary/70">第三层 · 13 个详细专题</p><h2 className="mt-1 font-heading text-2xl font-black">把密码原理和产品逐一接上</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">展开专题可查看完整过程；专题末尾列出真正使用该知识的产品，以及它们之间的具体关系。</p></div><span className="font-mono text-xs text-muted-foreground">{filteredModules.length} / {knowledgeModules.length} MODULES</span></div>
        <div className="sticky top-[64px] z-10 -mx-2 mt-5 rounded-2xl border border-border bg-background/92 p-2 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-2 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} placeholder="搜索密钥、证书、SM4、TLS、密评…" className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10" /></label><div className="flex gap-1">{(['全部', '基础', '核心', '进阶'] as const).map((item) => <button key={item} onClick={() => setLevel(item)} className={`h-10 rounded-lg px-3 text-xs font-bold ${level === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{item}</button>)}</div></div>
        </div>
        <div className="mt-4 space-y-3">
          {filteredModules.map((module, index) => (
            <details id={`knowledge-${module.id}`} key={module.id} defaultOpen={module.id === focusedId || (!focusedId && index === 0)} className="group overflow-hidden rounded-[22px] border border-border bg-card shadow-sm open:shadow-lg">
              <summary className="flex cursor-pointer list-none items-start gap-4 p-5 marker:hidden sm:p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary font-mono text-xs font-bold text-primary-foreground">{String(knowledgeModules.findIndex((item) => item.id === module.id) + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{module.level}</span><span className="text-[10px] text-muted-foreground">关联 {productCount(module.id)} 类产品</span></div><h3 className="mt-2 font-heading text-lg font-black sm:text-xl">{module.title}</h3><p className="mt-1 text-xs leading-5 text-primary/70">核心问题：{module.question}</p></div>
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition group-open:rotate-90"><ChevronRight className="size-4" /></span>
              </summary>
              <div className="border-t border-border px-5 pb-6 pt-5 sm:px-6">
                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-4"><article className="rounded-2xl border border-border p-4"><p className="flex items-center gap-2 text-xs font-bold text-primary"><BookOpen className="size-4" /> 先用白话理解</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{module.plain}</p></article><article className="rounded-2xl bg-primary p-4 text-primary-foreground"><p className="flex items-center gap-2 text-xs font-bold text-[var(--signal)]"><Lightbulb className="size-4" /> 心智模型</p><p className="mt-2 text-sm leading-7 text-primary-foreground/80">{module.mentalModel}</p></article><article className="rounded-2xl border border-border p-4"><p className="text-xs font-bold">具体例子</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{module.example}</p></article></div>
                  <div className="rounded-2xl border border-border bg-background/50 p-4"><p className="text-xs font-bold text-primary">它是怎样工作的</p><div className="mt-4 space-y-3">{module.mechanics.map((step, stepIndex) => <div key={step} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary font-mono text-[10px] text-primary-foreground">{stepIndex + 1}</span><p className="text-xs leading-5 text-muted-foreground">{step}</p></div>)}</div></div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]"><article className="rounded-2xl border border-amber-700/20 bg-amber-500/[0.07] p-4"><p className="flex items-center gap-2 text-xs font-bold text-amber-800"><AlertTriangle className="size-4" /> 常见误区</p><ul className="mt-3 space-y-2">{module.pitfalls.map((pitfall) => <li key={pitfall} className="flex gap-2 text-xs leading-5 text-muted-foreground"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-600" />{pitfall}</li>)}</ul></article><article className="rounded-2xl border border-border p-4"><p className="text-xs font-bold">这些产品如何使用本知识</p><div className="mt-3 space-y-3">{module.productLinks.map((link) => <div key={link.ids.join('-')} className="rounded-xl bg-muted/55 p-3"><div className="flex flex-wrap gap-2">{link.ids.map((productId) => { const product = products.find((item) => item.id === productId); return product ? <button key={productId} onClick={() => onSelect(product)} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold shadow-sm hover:border-primary/30">{product.name}</button> : null; })}</div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{link.relation}</p></div>)}</div></article></div>
                <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-bold text-muted-foreground">继续查词：</span>{module.terms.map((term) => <button key={term} onClick={() => onNavigate('glossary')} className="rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground hover:border-primary/30">{term}</button>)}</div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[24px] border border-border bg-card p-5 sm:p-6">
        <p className="text-xs font-bold text-primary/70">建议顺序 · 七天入门路线</p><h2 className="mt-1 font-heading text-xl font-black">每天建立一组“知识 ↔ 产品”连接</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {[
            ['D1', '安全目标', '机密性、完整性、真实性'], ['D2', '算法角色', 'SM2/3/4 各做什么'], ['D3', '硬件底座', '密码卡、HSM、UKey'], ['D4', '信任体系', 'CA、证书、签名、时间戳'], ['D5', '通道与数据', 'VPN、HTTPS、数据库加密'], ['D6', '身份与审计', 'IAM、堡垒机、日志审计'], ['D7', '完整方案', '按场景画调用链'],
          ].map(([day, title, body]) => <article key={day} className="rounded-2xl border border-border bg-background/60 p-4"><span className="font-mono text-[10px] font-bold text-primary/70">{day}</span><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{body}</p></article>)}
        </div>
      </section>
    </>
  );
}

function ProductsView({ query, setQuery, onSelect }: { query: string; setQuery: (value: string) => void; onSelect: (product: Product) => void }) {
  const [line, setLine] = useState<'全部' | ProductLine>('全部');
  const filtered = useMemo(() => products.filter((product) => {
    const matchesLine = line === '全部' || product.line === line;
    const haystack = `${product.name}${product.models}${product.layer}${product.oneLiner}${product.terms.join('')}`.toLowerCase();
    return matchesLine && haystack.includes(query.trim().toLowerCase());
  }), [line, query]);

  return (
    <>
      <SectionHeading eyebrow="PRODUCT ATLAS · 产品图鉴" title="30 类产品，按“位置—输入—输出—依赖”重新讲一遍" description="每张卡片都保留原资料页码和型号，同时补上小白类比、部署位置、上下游关系和容易混淆的相邻产品。点击任一产品查看完整拆解。" />
      <div className="sticky top-[64px] z-10 -mx-2 mb-6 rounded-2xl border border-border bg-background/90 p-2 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索产品、型号、SDF、密钥、TLS…" className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10" /></label>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(['全部', ...lines] as const).map((item) => <button key={item} onClick={() => setLine(item)} className={`h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition ${line === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{item}{item !== '全部' && <span className="ml-1 opacity-55">{products.filter((p) => p.line === item).length}</span>}</button>)}
          </div>
        </div>
      </div>
      {filtered.length ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((product) => {
            const relatedKnowledge = knowledgeModules.filter((module) => module.productLinks.some((link) => link.ids.includes(product.id)));
            return (
              <button key={product.id} onClick={() => onSelect(product)} className="group flex min-h-[260px] flex-col rounded-[22px] border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg">
                <div className="flex items-center justify-between gap-3"><LineBadge line={product.line} /><span className="font-mono text-[10px] text-muted-foreground">PDF P.{product.page}</span></div>
                <h2 className="mt-5 font-heading text-lg font-black tracking-tight">{product.name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{product.oneLiner}</p>
                <div className="mt-4"><p className="text-[10px] font-bold text-primary/65">知识照应</p><div className="mt-2 flex flex-wrap gap-1.5">{relatedKnowledge.slice(0, 3).map((module) => <span key={module.id} className="rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">{module.title.split('：')[0]}</span>)}{relatedKnowledge.length > 3 && <span className="rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">+{relatedKnowledge.length - 3}</span>}</div></div>
                <div className="mt-auto pt-5"><div className="flex items-end justify-between gap-3 border-t border-dashed border-border pt-3"><div><p className="text-[10px] text-muted-foreground">部署层级</p><p className="mt-0.5 text-xs font-bold">{product.layer}</p></div><span className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground"><ArrowRight className="size-4" /></span></div></div>
              </button>
            );
          })}
        </div>
      ) : <div className="rounded-3xl border border-dashed border-border p-12 text-center"><CircleHelp className="mx-auto size-8 text-muted-foreground" /><p className="mt-4 font-bold">没有找到匹配产品</p><p className="mt-1 text-sm text-muted-foreground">试试“密钥”“证书”“VPN”或清空产品线筛选。</p></div>}
    </>
  );
}

function CompareView() {
  return (
    <>
      <SectionHeading eyebrow="SIDE BY SIDE · 横向对比" title="名字相近，不代表工作相同；都能加密，也不代表能互换" description="先用一句判断规则抓住差异，再看每类产品的对象、能力与边界。选择产品时，业务语义和部署位置通常比“支持多少种算法”更重要。" />
      <div className="space-y-5">
        {comparisons.map((group, groupIndex) => (
          <section key={group.title} className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
            <div className="flex gap-4 border-b border-border bg-muted/45 p-5 sm:p-6"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-mono text-xs font-bold text-primary-foreground">0{groupIndex + 1}</span><div><h2 className="font-heading text-lg font-black">{group.title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">判断规则：{group.rule}</p></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="px-5 py-3">产品</th><th className="px-5 py-3">核心对象 / 位置</th><th className="px-5 py-3">最适合解决</th><th className="px-5 py-3">关键边界</th></tr></thead><tbody>{group.rows.map((row) => <tr key={row[0]} className="border-t border-border/60 align-top"><td className="px-5 py-4 font-bold text-foreground">{row[0]}</td><td className="px-5 py-4 text-muted-foreground">{row[1]}</td><td className="px-5 py-4 text-muted-foreground">{row[2]}</td><td className="px-5 py-4 text-muted-foreground">{row[3]}</td></tr>)}</tbody></table></div>
          </section>
        ))}
      </div>
    </>
  );
}

function ScenariosView({ onKnowledge }: { onKnowledge: (knowledgeId: string) => void }) {
  const scenarioKnowledge = [
    ['data-protection', 'symmetric-encryption', 'key-lifecycle'],
    ['secure-channel', 'public-key-pki', 'identity-access'],
    ['hash-signature', 'public-key-pki', 'trusted-time'],
    ['cloud-service', 'key-lifecycle', 'hardware-boundary'],
    ['identity-access', 'audit-evidence', 'compliance-engineering'],
    ['secure-channel', 'public-key-pki', 'hardware-boundary'],
  ];
  return (
    <>
      <SectionHeading eyebrow="REFERENCE FLOWS · 典型部署" title="真正的方案不是买一台设备，而是让多个控制点连成闭环" description="下面六条链路把产品放回真实工作流。每条都说明数据怎么走、谁调用谁，以及销售资料里最容易被一句话略过的实施难点。" />
      <div className="space-y-5">
        {scenarios.map((scenario, index) => (
          <section key={scenario.name} className="rounded-[24px] border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary font-mono text-xs font-bold text-primary-foreground">0{index + 1}</span><div><h2 className="font-heading text-xl font-black">{scenario.name}</h2><p className="mt-1 text-sm text-muted-foreground">目标：{scenario.goal}</p></div></div><Badge variant="outline" className="h-7 self-start px-3">多产品协作</Badge></div>
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/55 p-4">
              {scenario.flow.map((node, nodeIndex) => <div key={node} className="flex items-center gap-2"><span className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold shadow-sm">{node}</span>{nodeIndex < scenario.flow.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}</div>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-bold text-primary/70">本场景的知识基础</span>{scenarioKnowledge[index].map((knowledgeId) => { const module = knowledgeModules.find((item) => item.id === knowledgeId); return module ? <button key={knowledgeId} onClick={() => onKnowledge(knowledgeId)} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:border-primary/30">{module.title.split('：')[0]}</button> : null; })}</div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-border p-4"><p className="flex items-center gap-2 text-xs font-bold text-primary"><CheckCircle2 className="size-4" /> 这条链怎么工作</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{scenario.explain}</p></div><div className="rounded-2xl border border-amber-700/20 bg-amber-500/[0.07] p-4"><p className="flex items-center gap-2 text-xs font-bold text-amber-800"><AlertTriangle className="size-4" /> 实施时别漏掉</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{scenario.watch}</p></div></div>
          </section>
        ))}
      </div>
    </>
  );
}

function GlossaryView() {
  const [query, setQuery] = useState('');
  const categories = ['全部', ...Array.from(new Set(glossary.map((item) => item[1])))];
  const [category, setCategory] = useState('全部');
  const filtered = glossary.filter(([term, cat, definition]) => (category === '全部' || cat === category) && `${term}${cat}${definition}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <SectionHeading eyebrow="PLAIN-LANGUAGE GLOSSARY · 名词词典" title={`${glossary.length} 个高频名词，用研发新人听得懂的话解释`} description="这里刻意区分算法、接口、设备、系统、协议和合规概念。搜索缩写或中文名，都可以快速定位。" />
      <div className="sticky top-[64px] z-10 -mx-2 mb-6 rounded-2xl border border-border bg-background/90 p-2 shadow-sm backdrop-blur-xl">
        <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 SM2、SDF、CA、密评、透明加密…" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10" /></label>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`h-8 shrink-0 rounded-lg px-3 text-[11px] font-bold ${category === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{item}</button>)}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map(([term, cat, definition]) => <article key={term} className="rounded-[20px] border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-heading text-base font-black">{term}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{cat}</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{definition}</p></article>)}
      </div>
    </>
  );
}

function ProductDialog({ product, onClose, onKnowledge }: { product: Product | null; onClose: () => void; onKnowledge: (knowledgeId: string) => void }) {
  if (!product) return null;
  const relatedKnowledge = knowledgeModules.flatMap((module) => module.productLinks.filter((link) => link.ids.includes(product.id)).map((link) => ({ module, relation: link.relation })));
  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(920px,calc(100%-24px))] max-w-none overflow-y-auto rounded-[24px] border border-border bg-card p-0 shadow-2xl">
        <DialogHeader className="border-b border-border bg-muted/40 p-6 pr-14 text-left sm:p-7">
          <div className="flex flex-wrap items-center gap-2"><LineBadge line={product.line} /><span className="font-mono text-[10px] text-muted-foreground">原资料 P.{product.page}</span></div>
          <DialogTitle className="mt-3 font-heading text-2xl font-black tracking-tight sm:text-3xl">{product.name}</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-6">{product.oneLiner}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 p-6 sm:p-7">
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground"><p className="flex items-center gap-2 text-xs font-bold text-[var(--signal)]"><Lightbulb className="size-4" /> 小白类比</p><p className="mt-2 text-sm leading-6 text-primary-foreground/85">{product.analogy}</p></div>
          <section className="rounded-[20px] border border-cyan-700/20 bg-cyan-500/[0.06] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-cyan-800">知识照应 · 为什么这个产品需要密码知识</p><h3 className="mt-1 font-heading text-lg font-black">{relatedKnowledge.length} 个知识专题共同解释这个产品</h3></div><BookOpen className="size-5 shrink-0 text-cyan-700" /></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {relatedKnowledge.map(({ module, relation }) => (
                <button key={module.id} onClick={() => onKnowledge(module.id)} className="group rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-cyan-700/30 hover:shadow-md">
                  <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{module.level}</span><ArrowRight className="size-3.5 text-muted-foreground transition group-hover:translate-x-0.5" /></div>
                  <p className="mt-3 text-sm font-black">{module.title}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">与本产品的关系：{relation}</p><p className="mt-2 text-[10px] font-semibold text-cyan-800">要回答：{module.question}</p>
                </button>
              ))}
            </div>
          </section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[['保护什么', product.protects, Target], ['部署在哪里', product.deployment, Server], ['资料型号', product.models, Boxes]].map(([title, body, Icon]) => {
              const CardIcon = Icon as typeof Target;
              return <article key={title as string} className="rounded-2xl border border-border p-4"><CardIcon className="size-5 text-primary" /><p className="mt-3 text-xs font-bold">{title as string}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{body as string}</p></article>;
            })}
          </div>
          <div><p className="text-xs font-bold text-primary/70">把知识放回产品：输入 → 密码处理 → 输出</p><div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><span className="flex-1 rounded-xl bg-muted p-3 text-xs leading-5">{product.input}</span><ArrowRight className="mx-auto size-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" /><span className="rounded-xl bg-primary px-4 py-3 text-center text-xs font-bold text-primary-foreground">{product.name}</span><ArrowRight className="mx-auto size-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" /><span className="flex-1 rounded-xl bg-muted p-3 text-xs leading-5">{product.output}</span></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">注意：产品通常接收的是数据、密钥标识、证书或策略，而不是让业务直接读取长期私钥。实际密钥边界请结合上方“知识照应”和部署说明理解。</p></div>
          <div className="grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-border p-4"><p className="text-xs font-bold">经常和谁一起工作</p><div className="mt-3 flex flex-wrap gap-2">{product.worksWith.map((item) => <span key={item} className="rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">{item}</span>)}</div></article><article className="rounded-2xl border border-amber-700/20 bg-amber-500/[0.06] p-4"><p className="text-xs font-bold text-amber-800">最容易和什么混淆</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{product.notSameAs}</p></article></div>
          <div><p className="text-xs font-bold">理解它需要先懂这些词</p><div className="mt-3 flex flex-wrap gap-2">{product.terms.map((term) => <span key={term} className="rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{term}</span>)}</div></div>
          {product.caveat && <div className="flex gap-3 rounded-2xl border border-red-700/20 bg-red-500/[0.06] p-4"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-700" /><p className="text-xs leading-5 text-muted-foreground">{product.caveat}</p></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RightRail({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  const tips: Record<View, { title: string; body: string; icon: typeof Lightbulb }> = {
    map: { title: '从“保护对象”入手', body: '先判断产品保护人、设备、链路还是数据，再看算法和型号。', icon: Map },
    learn: { title: '沿着双向链接阅读', body: '知识专题末尾能打开相关产品；产品详情里的“知识照应”又能返回原理专题。', icon: GraduationCap },
    products: { title: '别被型号带着走', body: '型号回答“是哪款”，部署层级和输入输出才回答“它是什么”。', icon: Boxes },
    compare: { title: '先比业务语义', body: '都支持 SM2/SM4 并不意味着可以互换，产品封装和场景更关键。', icon: GitCompareArrows },
    scenarios: { title: '方案一定有上下游', body: '每个产品都要问：谁调用它、密钥在哪、失败后怎么办、日志去哪。', icon: Route },
    glossary: { title: '缩写先分类型', body: 'SM2 是算法，SDF 是接口，HSM 是设备，PKI 是体系，密评是评估活动。', icon: Library },
  };
  const tip = tips[view];
  const TipIcon = tip.icon;
  return (
    <aside className="hidden border-l border-border/80 bg-card/35 px-5 py-7 xl:block">
      <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground">当前阅读提示</p>
      <div className="mt-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/10"><TipIcon className="size-6 text-[var(--signal)]" /><h2 className="mt-4 font-heading text-lg font-black">{tip.title}</h2><p className="mt-2 text-sm leading-6 text-primary-foreground/70">{tip.body}</p></div>
      <div className="mt-6"><p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground">资料边界</p><div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-bold">产品能力来自企业资料</p><p className="mt-2 text-xs leading-5 text-muted-foreground">型号、性能、认证等级与“亮点”属于资料中的厂商陈述，本网站未替代采购测试或认证查询。</p></div><div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-bold">法规与标准已单独校正</p><p className="mt-2 text-xs leading-5 text-muted-foreground">例如 GM/T 0018-2012 已被 2023 版全部代替，网站按当前公开标准状态提示。</p></div></div>
      <button onClick={() => onNavigate('glossary')} className="mt-5 flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left text-xs font-bold shadow-sm">遇到缩写？查名词词典 <ArrowRight className="size-4" /></button>
    </aside>
  );
}

export default function Home() {
  const [view, setView] = useState<View>('map');
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [focusedKnowledge, setFocusedKnowledge] = useState<string | null>(null);
  const navigate = (next: View) => { setFocusedKnowledge(null); setView(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openKnowledge = (knowledgeId: string) => {
    setSelectedProduct(null);
    setFocusedKnowledge(knowledgeId);
    setView('learn');
    window.setTimeout(() => document.getElementById(`knowledge-${knowledgeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const handleGlobalSearch = (value: string) => { setQuery(value); if (value.trim()) setView('products'); };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate('map')} className="flex shrink-0 items-center gap-3 text-left"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><ShieldCheck className="size-5" /></span><div className="hidden sm:block"><p className="font-heading text-[15px] font-black tracking-tight">密码产品知识地图</p><p className="text-[9px] tracking-[0.18em] text-muted-foreground">从产品清单到行业全景</p></div></button>
          <label className="relative ml-auto w-full max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => handleGlobalSearch(event.target.value)} placeholder="搜索 30 类产品…" className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10" /></label>
          <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground md:inline-flex">零基础模式</span>
        </div>
        <div className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto border-t border-border/60 px-4 py-1.5 lg:hidden">
          {navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => navigate(item.id)} className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold ${view === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><Icon className="size-3.5" />{item.label}</button>; })}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] grid-cols-1 lg:grid-cols-[226px_minmax(0,1fr)] xl:grid-cols-[226px_minmax(0,1fr)_284px]">
        <aside className="hidden min-h-[calc(100vh-64px)] border-r border-border/80 px-4 py-7 lg:block">
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.16em] text-muted-foreground">知识导航</p>
          <nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} onClick={() => navigate(item.id)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className={`size-4 ${active ? 'text-[var(--signal)]' : ''}`} /><span className="min-w-0"><span className="block text-sm font-bold">{item.label}</span><span className={`block text-[10px] ${active ? 'text-primary-foreground/55' : 'text-muted-foreground/70'}`}>{item.hint}</span></span></button>; })}</nav>
          <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="flex items-center gap-2 text-xs font-bold"><Lightbulb className="size-4 text-amber-600" />阅读原则</p><p className="mt-2 text-xs leading-5 text-muted-foreground">先问“保护什么”，再问“部署在哪”，最后才看算法、型号和性能。</p></div>
          <div className="mt-4 rounded-2xl bg-muted/60 p-4"><p className="font-mono text-[10px] text-muted-foreground">KNOWLEDGE SNAPSHOT</p><div className="mt-3 grid grid-cols-3 gap-2"><div><p className="font-heading text-xl font-black">30</p><p className="text-[10px] text-muted-foreground">类产品</p></div><div><p className="font-heading text-xl font-black">{knowledgeModules.length}</p><p className="text-[10px] text-muted-foreground">个专题</p></div><div><p className="font-heading text-xl font-black">{glossary.length}</p><p className="text-[10px] text-muted-foreground">个名词</p></div></div></div>
        </aside>

        <div className="min-w-0 px-4 py-7 sm:px-6 lg:px-8 lg:py-9 2xl:px-10">
          {view === 'map' && <MapView onNavigate={navigate} onSelect={setSelectedProduct} />}
          {view === 'learn' && <LearnView onNavigate={navigate} onSelect={setSelectedProduct} focusedId={focusedKnowledge} />}
          {view === 'products' && <ProductsView query={query} setQuery={setQuery} onSelect={setSelectedProduct} />}
          {view === 'compare' && <CompareView />}
          {view === 'scenarios' && <ScenariosView onKnowledge={openKnowledge} />}
          {view === 'glossary' && <GlossaryView />}

          <footer className="mt-12 border-t border-border pt-7">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"><div><p className="font-heading text-sm font-black">内容依据与使用边界</p><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">产品名称、型号、产品特性与应用场景来自《中安云科产品介绍 v2.1（2026-05-22）》；解释、对比与架构梳理为面向新人的教学性重组。认证状态、性能、采购适配和法律效果应以正式证书、检测报告、合同与主管部门要求为准。</p></div><div><p className="text-xs font-bold">法规与标准入口</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{officialSources.map(([title, url]) => <a key={title} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary underline decoration-primary/25 underline-offset-4 hover:decoration-primary"><ExternalLink className="size-3" />{title}</a>)}</div></div></div>
            <p className="mt-7 pb-3 font-mono text-[9px] tracking-[0.12em] text-muted-foreground">BUILT AS A LEARNING MAP · NOT A SUBSTITUTE FOR FORMAL DESIGN, TESTING OR ASSESSMENT</p>
          </footer>
        </div>

        <RightRail view={view} onNavigate={navigate} />
      </div>

      <ProductDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onKnowledge={openKnowledge} />
    </main>
  );
}
