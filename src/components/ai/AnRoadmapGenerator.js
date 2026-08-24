/**
 * AnRoadmapGenerator — To-Be 블록/솔루션을 분기(Quarter) 기반 자동화 로드맵으로 도출.
 *
 * AN Transformation Studio 4단계(Roadmap Generation). 솔루션 timeline_months 와 블록 의존성을
 * 참고해 분기별 이니셔티브 막대를 JSON 으로 받아 RoadmapModel 로 정규화한다. (실시간 LLM 전용)
 */
import { genId } from '@/composables/blueprint/blueprintModel';
import { parseJsonLoose, readAnswerText } from './blueprintAiUtils';

function buildPrompt({ processName, baseYear, blocks }) {
    const quarters = [`Q1 ${baseYear}`, `Q2 ${baseYear}`, `Q3 ${baseYear}`, `Q4 ${baseYear}`];
    const context = { process: processName || '', quarters, blocks };
    return [
        '당신은 통신사 디지털 전환(DT) 프로그램 매니저입니다.',
        '아래 To-Be 블록과 솔루션(예상 기간 timeline_months 포함)을 바탕으로,',
        `${baseYear}년 4개 분기(Q1~Q4) 기준의 자동화 전환 로드맵을 작성하세요.`,
        '각 이니셔티브는 시작 분기 인덱스(start_index, 0=Q1)와 진행 분기 수(span, 1~4)를 가집니다.',
        'timeline_months 가 길수록 span 을 크게, 선행 의존이 있으면 start_index 를 뒤로 배치하세요.',
        'partition_name 은 블록 name 과 정확히 일치시키세요. label 은 막대에 표시할 짧은 문구(예: "Implement APIs").',
        '',
        '반드시 아래 형식의 JSON 객체만 ```json 코드펜스로 출력하세요. 다른 설명 금지.',
        '```json',
        '{',
        '  "initiatives": [',
        '    { "name": "현장 위험 식별", "partition_name": "현장 위험 식별", "start_index": 0, "span": 1, "label": "Implement APIs" }',
        '  ]',
        '}',
        '```',
        '',
        '컨텍스트(JSON):',
        JSON.stringify(context, null, 2)
    ].join('\n');
}

function clampInt(v, min, max, fallback) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

/**
 * 자동화 로드맵 생성.
 * @param {any} backend
 * @param {{ processName?: string, baseYear?: number, partitions?: any[], blockSolutions?: any[], orchestrator?: any, sessionId?: string }} [params]
 * @returns {Promise<import('@/composables/blueprint/blueprintModel').RoadmapModel>}
 */
export async function generateRoadmap(backend, params = {}) {
    const { processName = '', baseYear = 2026, partitions = [], blockSolutions = [], orchestrator = null, sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    const partitionList = Array.isArray(partitions) ? partitions : [];
    const orchBlocks = orchestrator?.blocks || [];
    const blocks = partitionList.length
        ? partitionList.map((p) => {
              const sol = (blockSolutions || []).find((s) => s.partition_id === p.id || s.partition_name === p.name);
              const ob = orchBlocks.find((b) => b.partition_id === p.id || b.name === p.name);
              return {
                  name: p.name,
                  tmf: ob?.tmf || '',
                  solution_type: sol?.solution_type || '',
                  timeline_months: sol?.expected_impact?.timeline_months || null
              };
          })
        : orchBlocks.map((b) => {
              const sol = (blockSolutions || []).find((s) => s.partition_id === b.partition_id || s.partition_name === b.name);
              return {
                  name: b.name,
                  tmf: b.tmf || '',
                  solution_type: sol?.solution_type || '',
                  timeline_months: sol?.expected_impact?.timeline_months || null
              };
          });

    const quarters = [`Q1 ${baseYear}`, `Q2 ${baseYear}`, `Q3 ${baseYear}`, `Q4 ${baseYear}`];
    const message = buildPrompt({ processName, baseYear, blocks });
    const response = await backend.qdrantChat({ message, sessionId });
    const text = readAnswerText(response);
    const parsed = parseJsonLoose(text);
    const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.initiatives) ? parsed.initiatives : [];

    const initiatives = rawList
        .filter((x) => x && (x.name || x.partition_name))
        .map((x) => {
            const pname = String(x.partition_name || x.name || '');
            const match = partitionList.find((p) => p.name === pname);
            const orchMatch = orchBlocks.find((b) => b.name === pname);
            const start = clampInt(x.start_index ?? x.start, 0, 3, 0);
            const span = clampInt(x.span ?? x.duration ?? 1, 1, 4 - start, 1);
            return {
                id: genId('init'),
                name: String(x.name || pname).slice(0, 120),
                partition_id: match ? match.id : orchMatch?.partition_id ?? null,
                start_index: start,
                span,
                label: String(x.label || x.text || 'Implement').slice(0, 60)
            };
        });

    if (!initiatives.length) {
        throw new Error('AI 로드맵 생성 결과를 해석하지 못했습니다.');
    }
    return { quarters, initiatives, generated_at: new Date().toISOString() };
}
