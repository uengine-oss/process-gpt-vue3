/**
 * executableForms — 실행형 변환 결과의 userTask 별 form_def 폼 결정론 생성.
 *
 * "실행 정의로 등록" 시 각 userTask 의 outputData 를 입력 필드로 하는 폼을 만들어
 * form_def 에 저장하고 activities[].tool = formHandler:<form id> 로 연결한다.
 * 규약은 운영 검증된 scripts/execute-bpmn(build_exec/build_link_forms)을 승계:
 *  - 폼 id: `${proc_def_id}_${activity_id 소문자}_form`
 *  - html: 레거시 커스텀 태그 HTML (DynamicForm 렌더 — 한글 필드 키 검증 완료 포맷)
 *  - 게이트웨이 conditionData: `<form id>.<결정필드>` 프리픽스
 *  - 시퀀스 conditionFunction 은 bare 필드명 유지 (엔진 결정론 평가 규약)
 */
import { cleanStringArray, type ExecutableDefinition, type ExecutableActivity } from './executableModel';

export interface GeneratedExecForm {
    id: string;
    proc_def_id: string;
    activity_id: string;
    /** 레거시 커스텀 태그 HTML (form_def.html) */
    html: string;
    fields_json: Array<{ text: string; key: string; type: string; disabled: string; readonly: string }>;
}

const FIELD_TEMPLATE = (key: string, alias: string) =>
    '<div class="row"><div class="col-sm-12">' +
    `<text-field name="${key}" alias="${alias}" type="text" disabled="false" readonly="false" ` +
    `v-model="slotProps.modelValue['${key}']"></text-field>` +
    '</div></div>';

const FORM_WRAP = (inner: string) =>
    '<section><row-layout name="main" alias="" is_multidata_mode="false" v-model="formValues" v-slot="slotProps">' +
    inner +
    '</row-layout></section>';

export function execFormId(defId: string, activityId: string): string {
    return `${String(defId).toLowerCase()}_${String(activityId).toLowerCase()}_form`;
}

/**
 * outputData 항목 → 폼 필드 키. 엔진 conditionFunction 이 bare 필드명으로 평가하므로
 * 원문을 최대한 보존하고, HTML 속성/JSON 키로 문제가 되는 문자만 _ 로 치환한다.
 */
export function sanitizeFieldKey(name: string, index: number): string {
    const key = String(name || '')
        .trim()
        .replace(/["'<>&\s.]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return key || `필드_${index + 1}`;
}

function escapeAttr(v: string): string {
    return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isUserTask(a: ExecutableActivity): boolean {
    return a.type === 'userTask';
}

/** 이미 사용자 지정 폼이 연결돼 있으면 존중한다 (defaultform/빈 값만 자동 연결 대상). */
function hasCustomForm(a: ExecutableActivity): boolean {
    const tool = String(a.tool || '').trim();
    if (!tool) return false;
    if (!tool.startsWith('formHandler:')) return false;
    const id = tool.slice('formHandler:'.length).trim().toLowerCase();
    return !!id && id !== 'defaultform';
}

export interface BuildExecutableFormsResult {
    forms: GeneratedExecForm[];
    /** tool 연결·conditionData 프리픽스가 반영된 새 definition (원본 불변). */
    definition: ExecutableDefinition;
}

export function buildExecutableForms(definition: ExecutableDefinition, defId: string): BuildExecutableFormsResult {
    const def: ExecutableDefinition = JSON.parse(JSON.stringify(definition));
    const forms: GeneratedExecForm[] = [];
    const formIdByActivity = new Map<string, string>();
    const fieldKeysByActivity = new Map<string, Set<string>>();

    for (const a of def.activities || []) {
        if (!isUserTask(a)) continue;
        if (hasCustomForm(a)) continue; // 사용자 지정 폼 존중 — 자동 생성/재연결하지 않음

        const outputs = cleanStringArray(a.outputData);
        const seen = new Set<string>();
        const fields = outputs
            .map((name, i) => ({ raw: String(name || '').trim(), key: sanitizeFieldKey(name, i) }))
            .filter((f) => {
                if (!f.raw || seen.has(f.key)) return false;
                seen.add(f.key);
                return true;
            });
        // 출력이 없는 태스크도 진행 기록용 최소 필드 1개로 폼을 만든다.
        if (!fields.length) fields.push({ raw: '처리 내용', key: '처리내용' });

        const formId = execFormId(defId, a.id);
        const inner = fields.map((f) => FIELD_TEMPLATE(f.key, escapeAttr(f.raw))).join('');
        forms.push({
            id: formId,
            proc_def_id: String(defId).toLowerCase(),
            activity_id: a.id,
            html: FORM_WRAP(inner),
            fields_json: fields.map((f) => ({
                text: f.raw,
                key: f.key,
                type: 'text',
                disabled: 'false',
                readonly: 'false'
            }))
        });
        formIdByActivity.set(a.id, formId);
        fieldKeysByActivity.set(a.id, new Set(fields.map((f) => f.key).concat(fields.map((f) => f.raw))));

        a.tool = `formHandler:${formId}`;
    }

    // 게이트웨이 conditionData 를 `<form id>.<결정필드>` 로 프리픽스 (bare 항목만).
    // 결정필드 공급 태스크 = 게이트웨이에서 시퀀스를 거슬러 올라간 가장 가까운 userTask.
    const incoming = new Map<string, string[]>();
    for (const s of def.sequences || []) {
        if (!incoming.has(s.target)) incoming.set(s.target, []);
        incoming.get(s.target)!.push(s.source);
    }
    const findUpstreamFormRef = (gatewayId: string, field: string): string | null => {
        const visited = new Set<string>([gatewayId]);
        const queue = [...(incoming.get(gatewayId) || [])];
        while (queue.length) {
            const cur = queue.shift()!;
            if (visited.has(cur)) continue;
            visited.add(cur);
            const keys = fieldKeysByActivity.get(cur);
            if (keys && keys.has(field)) return `${formIdByActivity.get(cur)}.${field}`;
            for (const prev of incoming.get(cur) || []) queue.push(prev);
        }
        return null;
    };
    for (const g of def.gateways || []) {
        if (!Array.isArray(g.conditionData) || !g.conditionData.length) continue;
        g.conditionData = g.conditionData.map((field) => {
            if (!field || String(field).includes('.')) return field; // 이미 프리픽스됨
            return findUpstreamFormRef(g.id, String(field)) || field;
        });
    }

    return { forms, definition: def };
}
