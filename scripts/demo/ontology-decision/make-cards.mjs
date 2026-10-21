#!/usr/bin/env node
// 온톨로지 근거 에이전트 판단(spec 018) 영상의 타이틀(s0)·정리(s9) 카드 — 시나리오별.
//   node scripts/demo/ontology-decision/make-cards.mjs  → docs/manuals/video/ontology-agent-decision/<sc>/clips/s0.png, s9.png
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const ROOT = 'docs/manuals/video/ontology-agent-decision';
const TYPES = [
    ['1', '정상', '상충 없음 → 지배 KPI 를 함께 만족'],
    ['2.1', '상충 + 우선순위', '우선순위로 에이전트가 기준 선택'],
    ['2.2', '상충 + 우선순위 미정', '에이전트가 담당자에게 질문']
];
const CARDS = {
    sc1: {
        n: '1',
        title: '전략·KPI 에 따라<br>에이전트가 판단한다',
        sub: '소모품 정기 구매 — 에이전트가 온톨로지에서 이 업무를 지배하는 KPI 를 읽고, 둘을 함께 만족하는 공급사를 고른다.',
        end: '상충이 없으면 지배 KPI 를 모두 만족하는 쪽으로 — 근거(목표·현재값)를 보고서에 남긴다'
    },
    sc21: {
        n: '2.1',
        title: '상충하는 KPI,<br>우선순위로 고른다',
        sub: '생산 자재 긴급 구매 — 납기 준수율 ↔ 단가 절감률. 전략 보드에서 정한 판단 우선순위대로 에이전트가 기준을 택한다.',
        end: '우선순위를 정해 두면 에이전트는 묻지 않고 그 설정대로 — 택한 기준과 포기한 기준을 남긴다'
    },
    scx: {
        n: 'all',
        title: '긴 프로세스 한 건에서<br>세 가지 판단이 차례로',
        sub: '생산라인 증설 자재 조달 — 요청서 → 에이전트 판단 3단계(포장 부자재 · 핵심 자재 · 설비 부품) → 통합 승인. 단계마다 근거 KPI 가 달라 상충 없음 → 우선순위 → 질문이 한 인스턴스에서 일어난다.',
        end: 'KPI 의 판단 적용 활동으로 단계마다 근거를 나누면, 한 프로세스 안에서도 판단 방식이 단계별로 달라진다'
    },
    sc22: {
        n: '2.2',
        title: '정할 수 없으면<br>담당자에게 묻는다',
        sub: '설비 부품 구매 — 품질 합격률 ↔ 단가 절감률, 우선순위 미정. 에이전트가 담당자에게 묻고, 담당자가 택한 기준으로 뒤의 검수 Gateway 가 갈린다.',
        end: '근거가 부족하면 추측하지 않고 묻는다 — 받은 답은 판단 근거로 남고, Gateway 분기로 흐름까지 바꾼다'
    }
};

const html = (n, title, sub, foot, eyebrow) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1440px;height:900px;background:#f5f7fb;font-family:"Noto Sans KR",sans-serif;color:#0f172a;
       display:flex;flex-direction:column;justify-content:center;padding:0 110px}
  .eyebrow{color:#2563eb;font-weight:700;letter-spacing:.3px;font-size:22px;margin-bottom:18px}
  h1{font-size:58px;line-height:1.22;letter-spacing:-1.5px;font-weight:800}
  p.sub{margin-top:18px;font-size:24px;color:#475569;line-height:1.5;max-width:1150px}
  ol{list-style:none;padding:0;margin-top:54px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  li{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 18px;min-height:112px}
  li.on{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
  li b{display:block;color:#2563eb;font-size:24px}
  li span{display:block;font-weight:700;font-size:20px;margin-top:6px}
  li small{display:block;color:#64748b;font-size:15px;margin-top:4px;line-height:1.35}
  .foot{margin-top:46px;color:#475569;font-size:19px}
</style></head><body>
  <div class="eyebrow">${eyebrow}</div>
  <h1>${title}</h1>
  <p class="sub">${sub}</p>
  <ol>${TYPES.map(([k, t, s]) => `<li class="${k === n || n === 'all' ? 'on' : ''}"><b>시나리오 ${k}</b><span>${t}</span><small>${s}</small></li>`).join('')}</ol>
  <div class="foot">${foot}</div>
</body></html>`;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const [slug, c] of Object.entries(CARDS)) {
    const out = `${ROOT}/${slug}/clips`;
    fs.mkdirSync(out, { recursive: true });
    await p.setContent(html(c.n, c.title, c.sub, '예시 데이터 — 가상 구매 조직 · 일반 BPM 화면', `온톨로지 근거 에이전트 판단 · ${c.n === 'all' ? '통합 시나리오' : '시나리오 ' + c.n}`));
    await p.screenshot({ path: `${out}/s0.png` });
    await p.setContent(html(c.n, '정리', c.end, '테스트 진행 문서: docs/manuals/ontology-agent-decision.md', c.n === 'all' ? '통합 시나리오' : `시나리오 ${c.n}`));
    await p.screenshot({ path: `${out}/s9.png` });
}
await browser.close();
console.log('cards → ' + ROOT + '/*/clips/s0.png, s9.png');
