#!/usr/bin/env node
/* global process */
/**
 * CLI: BPMN 파일에 자동 배치를 적용하고 요약을 출력한다. (js/esm 빌드 사용 — 별도 설치 불필요)
 *   node cli.mjs <input.bpmn> [output.bpmn]   출력 생략 시 stdout 대신 요약만 출력
 *   node cli.mjs <input.bpmn> --check         배치 계산만 하고 겹침·대각선 통계 출력(파일 미변경)
 */
import fs from 'node:fs';
import { autoLayoutBpmnXml, computeBpmnLayout, isOrthogonalPath } from './js/esm/bpmnAutoLayout.mjs';

const [input, outputOrFlag] = process.argv.slice(2);
if (!input) {
    console.error('usage: node cli.mjs <input.bpmn> [output.bpmn | --check]');
    process.exit(2);
}
const xml = fs.readFileSync(input, 'utf8');
const t0 = Date.now();
const layout = computeBpmnLayout(xml);
const seqIds = new Set([...xml.matchAll(/<(?:[\w-]+:)?sequenceFlow\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]));
const nodes = layout.shapes.filter((s) => s.type !== 'lane' && s.type !== 'participant');
let overlaps = 0;
for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++;
    }
}
const diagonalFlows = layout.edges.filter((e) => seqIds.has(e.id) && !isOrthogonalPath(e.points)).map((e) => e.id);
const summary = {
    ms: Date.now() - t0,
    shapes: layout.shapes.length,
    lanes: layout.shapes.filter((s) => s.type === 'lane').length,
    edges: layout.edges.length,
    overlaps,
    diagonalFlows,
    warnings: layout.warnings
};
if (outputOrFlag && outputOrFlag !== '--check') {
    const r = autoLayoutBpmnXml(xml);
    fs.writeFileSync(outputOrFlag, r.xml);
    summary.changed = r.changed;
    summary.output = outputOrFlag;
}
console.log(JSON.stringify(summary, null, 2));
process.exit(overlaps || diagonalFlows.length ? 1 : 0);
