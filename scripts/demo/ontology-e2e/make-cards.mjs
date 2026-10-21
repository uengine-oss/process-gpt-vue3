#!/usr/bin/env node
// 온톨로지 E2E 가이드 영상의 타이틀(s0)·엔딩(s8) 카드를 PNG 로 렌더한다 (ffmpeg-static 에 drawtext 가 없어 HTML 로 그린다).
//   node scripts/demo/ontology-e2e/make-cards.mjs  → docs/manuals/video/ontology-e2e-guide/clips/s0.png, s8.png
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'docs/manuals/video/ontology-e2e-guide/clips';
fs.mkdirSync(OUT, { recursive: true });

const STEPS = [
    ['①', '프로세스 생성', 'BPMN 업로드 · 버전 저장'],
    ['②', '전략 연결', 'KPI ↔ 프로세스'],
    ['③', '실행', '점검 요청 제출'],
    ['④', '에이전트', '온톨로지 MCP 로 원인 분석'],
    ['⑤', '검토 완료', '사람 → 에이전트 → 사람'],
    ['⑥', '온톨로지 반영', '실행이 지도에'],
    ['⑦', '분석', '질문하기 · 원인 분석']
];

const page = (title, sub, foot) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1440px;height:900px;background:#f6f4fb;font-family:"Noto Sans KR",sans-serif;color:#1d1830;
       display:flex;flex-direction:column;justify-content:center;padding:0 110px}
  .eyebrow{color:#7b2cbf;font-weight:700;letter-spacing:.5px;font-size:22px;margin-bottom:18px}
  h1{font-size:58px;line-height:1.22;letter-spacing:-1.5px;font-weight:800}
  p.sub{margin-top:18px;font-size:24px;color:#4a4560;line-height:1.5}
  ol{list-style:none;padding:0;margin-top:54px;display:grid;grid-template-columns:repeat(7,1fr);gap:12px}
  li{background:#fff;border:1px solid #e3ddf0;border-radius:14px;padding:16px 14px;min-height:118px}
  li b{display:block;color:#7b2cbf;font-size:26px}
  li span{display:block;font-weight:700;font-size:19px;margin-top:6px}
  li small{display:block;color:#6b6680;font-size:14.5px;margin-top:4px;line-height:1.35}
  .foot{margin-top:46px;color:#6b6680;font-size:17px}
</style></head><body>
  <div class="eyebrow">온톨로지 익스플로러 · 실행 가이드</div>
  <h1>${title}</h1>
  <p class="sub">${sub}</p>
  <ol>${STEPS.map(([n, t, s]) => `<li><b>${n}</b><span>${t}</span><small>${s}</small></li>`).join('')}</ol>
  <div class="foot">${foot}</div>
</body></html>`;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p.setContent(page(
    '프로세스 생성부터<br>온톨로지 분석까지',
    '새 프로세스를 만들어 실행하면, 에이전트가 온톨로지를 읽어 일하고 그 기록이 다시 온톨로지에 쌓여 분석된다.',
    '예시 데이터 — 구매 KPI 주간 점검 (가상 구매 조직)'
));
await p.screenshot({ path: `${OUT}/s0.png` });
await p.setContent(page(
    '만들고 · 실행하고 · 읽고 · 분석한다',
    '사람과 에이전트가 같은 지도(전략–실행 온톨로지)와 같은 도구를 쓴다. 단계별 화면은 가이드 문서를 참고.',
    'docs/manuals/ontology-e2e-guide.md'
));
await p.screenshot({ path: `${OUT}/s8.png` });
await browser.close();
console.log('cards → ' + OUT);
