/**
 * AnOrchestratorGenerator — 확정 블록 + 락인된 Gap 으로 To-Be Master Orchestrator 모델 설계.
 *
 * AN Transformation Studio 3단계(To-Be Orchestrator). 한 번의 qdrantChat 호출로
 *  (1) orchestrator: 상단 마스터 오케스트레이터 스윔레인 모델
 *  (2) block_solutions: 블록별 To-Be 솔루션 + ROI 임팩트(누적 ROI 계산용)
 *  (3) skill_shift: HR 역량 전환(Skill Shift) 시뮬레이션
 * 을 구조화 JSON 으로 받아 정규화한다. (실시간 LLM 전용)
 */
import { SOLUTION_TYPES } from '@/composables/blueprint/blueprintModel';
import { parseJsonLoose, readAnswerText } from './blueprintAiUtils';

const VALID_TYPES = SOLUTION_TYPES.map((t) => t.value);
const VALID_EFFORT = ['low', 'medium', 'high'];
const VALID_CONFIDENCE = ['low', 'medium', 'high'];

function normalizeType(raw) {
    const up = String(raw || '')
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    if (VALID_TYPES.includes(up)) return up;
    if (/API/.test(up)) return 'API_INTEGRATION';
    if (/RPA|BOT/.test(up)) return 'RPA';
    if (/REDESIGN|REENG|재설계/.test(up)) return 'PROCESS_REDESIGN';
    if (/MANUAL|수작업/.test(up)) return 'MANUAL_AUTOMATION';
    if (/SYSTEM|시스템/.test(up)) return 'SYSTEM_ENHANCEMENT';
    if (/OUTSOURC|아웃소싱|위탁/.test(up)) return 'OUTSOURCING';
    return 'OTHER';
}

function pick(list, value, fallback) {
    const v = String(value || '').toLowerCase();
    return list.includes(v) ? v : fallback;
}

function buildPrompt({ processName, partitions, gaps }) {
    const context = {
        process: processName || '',
        blocks: (partitions || []).map((p) => ({ id: p.id, name: p.name, etom_l3: p.etom_l3, tasks: (p.tasks || []).map((t) => t.name) })),
        locked_gaps: (gaps || []).map((g) => ({
            category: g.category,
            partition_name: g.partition_name,
            title: g.title,
            recommendation: g.recommendation
        }))
    };
    return [
        '당신은 통신사 AI 무인화/자동화 아키텍트입니다.',
        '아래 확정된 블록과 합의된 Gap(개선 과제)을 바탕으로, DT/AI 기술을 접목한 To-Be 모델과',
        '전체 흐름을 제어하는 Master Orchestrator 아키텍처를 설계하세요.',
        '- orchestrator.gateway: TMF Open API 게이트웨이 (예: name "TMF641 API Gateway", subtitle "Request Routing & Validation")',
        '- orchestrator.blocks: 각 블록의 To-Be 단계(to_be_steps). 자동화되는 단계는 automated:true, tmf 코드 포함.',
        '- block_solutions: 블록별 핵심 솔루션과 ROI 임팩트. cost_delta/fte_delta 는 연간 변화이며 절감이면 음수(원/FTE).',
        '- skill_shift: 자동화로 인한 HR 역량 전환. as_is(현재 역량) → to_be(미래 역량), reskill_count(재교육 필요 인원), 임원 보고용 insight.',
        'solution_type 코드: ' + VALID_TYPES.join(', ') + '.',
        'partition_name 은 위 블록 name 과 정확히 일치시키세요.',
        '',
        '반드시 아래 형식의 JSON 객체만 ```json 코드펜스로 출력하세요. 다른 설명 금지.',
        '```json',
        '{',
        '  "orchestrator": {',
        '    "master_name": "AI 무인화 Master Orchestrator",',
        '    "gateway": { "name": "TMF641 API Gateway", "subtitle": "Request Routing & Validation" },',
        '    "blocks": [ { "partition_name": "현장 위험 식별", "tmf": "TMF641", "to_be_steps": [ { "name": "...", "automated": true, "tmf": "TMF641" } ] } ]',
        '  },',
        '  "block_solutions": [ { "partition_name": "현장 위험 식별", "solution_type": "API_INTEGRATION", "title": "...", "description": "...", "implementation_effort": "medium", "cost_delta": -36000000, "fte_delta": -1.5, "timeline_months": 3, "confidence": "medium" } ],',
        '  "skill_shift": [ { "partition_name": "현장 위험 식별", "as_is": "데이터 수기 입력, 엑셀 대사", "to_be": "API 예외 처리, AI 결과 검수", "reskill_count": 3, "insight": "..." } ]',
        '}',
        '```',
        '',
        '컨텍스트(JSON):',
        JSON.stringify(context, null, 2)
    ].join('\n');
}

function matchPartitionId(partitions, name) {
    const m = (partitions || []).find((p) => p.name === name);
    return m ? m.id : null;
}

function normalize(parsed, partitions) {
    const o = parsed?.orchestrator || {};
    const blocks = Array.isArray(o.blocks) ? o.blocks : [];
    const orchestrator = {
        master_name: String(o.master_name || o.name || 'To-Be Master Orchestrator').slice(0, 160),
        gateway: {
            name: String(o.gateway?.name || 'API Gateway').slice(0, 120),
            subtitle: String(o.gateway?.subtitle || o.gateway?.desc || '').slice(0, 160)
        },
        blocks: blocks.map((b) => ({
            partition_id: matchPartitionId(partitions, b?.partition_name),
            name: String(b?.name || b?.partition_name || '블록').slice(0, 120),
            tmf: String(b?.tmf || 'TMF XXX'),
            to_be_steps: (Array.isArray(b?.to_be_steps) ? b.to_be_steps : [])
                .map((s) => ({
                    name: String(typeof s === 'string' ? s : s?.name || '').slice(0, 200),
                    automated: typeof s === 'object' ? !!s?.automated : false,
                    tmf: typeof s === 'object' ? String(s?.tmf || '') : ''
                }))
                .filter((s) => s.name)
        })),
        generated_at: new Date().toISOString()
    };

    const block_solutions = (Array.isArray(parsed?.block_solutions) ? parsed.block_solutions : []).map((s) => ({
        partition_id: matchPartitionId(partitions, s?.partition_name),
        partition_name: String(s?.partition_name || ''),
        solution_type: normalizeType(s?.solution_type || s?.type),
        title: String(s?.title || s?.name || '솔루션').slice(0, 200),
        description: String(s?.description || s?.desc || ''),
        implementation_effort: pick(VALID_EFFORT, s?.implementation_effort || s?.effort, 'medium'),
        expected_impact: {
            cost_delta: Number(s?.cost_delta ?? s?.expected_impact?.cost_delta ?? 0) || 0,
            fte_delta: Number(s?.fte_delta ?? s?.expected_impact?.fte_delta ?? 0) || 0,
            timeline_months:
                s?.timeline_months != null
                    ? Number(s.timeline_months)
                    : s?.expected_impact?.timeline_months != null
                    ? Number(s.expected_impact.timeline_months)
                    : undefined,
            confidence: pick(VALID_CONFIDENCE, s?.confidence ?? s?.expected_impact?.confidence, 'medium')
        }
    }));

    const skill_shift = (Array.isArray(parsed?.skill_shift) ? parsed.skill_shift : []).map((k) => ({
        partition_id: matchPartitionId(partitions, k?.partition_name),
        partition_name: String(k?.partition_name || ''),
        as_is: String(k?.as_is || k?.asIs || k?.current || ''),
        to_be: String(k?.to_be || k?.toBe || k?.future || ''),
        insight: String(k?.insight || k?.report || ''),
        reskill_count: k?.reskill_count != null ? Number(k.reskill_count) : undefined
    }));

    return { orchestrator, block_solutions, skill_shift };
}

/**
 * To-Be Master Orchestrator + 블록 솔루션 + Skill Shift 설계.
 * @param {any} backend
 * @param {{ asIsXml?: string, processName?: string, partitions: any[], gaps?: any[], sessionId?: string }} [params]
 * @returns {Promise<{ orchestrator: any, block_solutions: any[], skill_shift: any[] }>}
 */
export async function designToBe(backend, params = {}) {
    const { asIsXml = '', processName = '', partitions = [], gaps = [], sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    const message = buildPrompt({ processName, partitions, gaps });
    const response = await backend.qdrantChat({ message, xml: asIsXml || undefined, sessionId });
    const text = readAnswerText(response);
    const parsed = parseJsonLoose(text);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI To-Be 오케스트레이터 결과를 해석하지 못했습니다.');
    }
    const result = normalize(parsed, partitions);
    if (!result.orchestrator.blocks.length && !result.block_solutions.length) {
        throw new Error('AI To-Be 오케스트레이터 결과가 비어 있습니다.');
    }
    return result;
}
