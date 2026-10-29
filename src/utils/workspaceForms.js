/**
 * 대화(딥 에이전트) 작업 폴더의 폼 파일(forms/<id>.form|.html)을 form_def 로 저장할 때 쓰는 규칙.
 *
 * 편집기에서 폼을 저장하면(GPTUserTaskPanel.beforeSave → ProcessDefinitionModule.saveModel)
 *   - 폼 id 는 `<프로세스 id>_<activity id>_form` (소문자, '/'·'.' → '_')
 *   - form_def.activity_id 는 BPMN 요소 id 그대로
 *   - activity.tool 은 `formHandler:<그 폼 id>`
 *   - 참조정보(activity.inputData)·게이트웨이 참조정보(gateway.conditionData)는 `<폼 id>.<필드>`
 * 로 맞춰진다. 실행 엔진은 이 연결로 폼을 찾는다 — 화면(FormWorkItem)은 activity.tool 의 폼 id 로
 * form_def 를 읽고(없으면 기본 폼), 제출값을 그 폼 id 아래에 담는다. 엔진은 게이트웨이
 * conditionData 의 `<폼 id>` 로 그 제출값을 찾아 분기를 정한다.
 *
 * 대화 「저장」은 지금까지 폼을 `<프로세스 id>_<파일명>_form` 으로만 저장하고 정의는 에이전트가
 * 쓴 그대로 두었다. 에이전트가 작성 단계의 id(`formHandler:<activity id>`, 참조 `<activity id>.<필드>`)
 * 를 남긴 채 마무리 치환이 빠지면(마무리 실패·다시 고친 정의·camelCase 파일명) 폼이 연결되지 않아
 * 실행 화면은 기본 폼을 띄우고, 입력값은 엔진이 찾는 폼 id 밑에 없고, 갈림길은 판단할 값을 못 얻는다.
 *
 * 여기서는 편집기 저장과 같은 결과가 되도록 저장할 폼 id·activity id 를 정하고, 정의가 그 id 를
 * 가리키게 고친다. 폼 HTML 정규화(row-layout·v-model)는 putRawDefinition(type: 'form') 이 한다.
 */

const FORM_FILE = /\.(?:html|form)$/i;

/** 파일명(camelCase 등) → snake. 예전 저장 경로(ChatRoomPage.handleSaveWorkspaceFiles)와 같은 규칙. */
export function toSnakeId(value) {
    return (
        String(value || '')
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase() || 'node'
    );
}

/** 편집기 폼 저장과 같은 폼 id (GPTUserTaskPanel.init). 엔진은 form_def.id 를 소문자로 찾는다. */
export function formIdFor(procId, activityId) {
    return `${procId}_${activityId}_form`.toLowerCase().replace(/[/.]/g, '_');
}

export function isWorkspaceFormFile(file) {
    if (!file) return false;
    const p = String(file.path || '').replace(/\\/g, '/');
    if (!/\/forms\//.test(p)) return false;
    const ext = String(file.ext || '').toLowerCase();
    return ext === '.html' || ext === '.form' || FORM_FILE.test(String(file.name || '')) || FORM_FILE.test(p);
}

function fileStem(file) {
    const p = String(file.path || '').replace(/\\/g, '/');
    const name = String(file.name || p.split('/').pop() || '');
    return name.replace(FORM_FILE, '');
}

function formIdOfTool(tool) {
    const t = typeof tool === 'string' ? tool.trim() : '';
    if (!t.startsWith('formHandler:')) return '';
    const id = t.slice('formHandler:'.length).trim();
    return id && id !== 'defaultform' ? id : '';
}

/** 정의 안의 모든 activity(서브프로세스 포함) */
function allActivities(definition) {
    const out = [];
    const visit = (def) => {
        if (!def || typeof def !== 'object') return;
        if (Array.isArray(def.activities)) out.push(...def.activities.filter((a) => a && typeof a === 'object' && a.id));
        if (Array.isArray(def.subProcesses)) def.subProcesses.forEach((sp) => visit(sp && sp.children));
    };
    visit(definition);
    return out;
}

function allGateways(definition) {
    const out = [];
    const visit = (def) => {
        if (!def || typeof def !== 'object') return;
        if (Array.isArray(def.gateways)) out.push(...def.gateways.filter((g) => g && typeof g === 'object'));
        if (Array.isArray(def.subProcesses)) def.subProcesses.forEach((sp) => visit(sp && sp.children));
    };
    visit(definition);
    return out;
}

/** 폼 파일 이름(stem)에 해당하는 activity. 이름 그대로 → snake 로 같음 → tool 이 가리키는 폼 id 순. */
function findActivity(activities, stem) {
    const snake = toSnakeId(stem);
    return (
        activities.find((a) => String(a.id) === stem) ||
        activities.find((a) => toSnakeId(a.id) === snake) ||
        activities.find((a) => {
            const id = formIdOfTool(a.tool);
            return id && (id === stem || toSnakeId(id) === snake);
        }) ||
        null
    );
}

/**
 * 작업 폴더 파일에서 저장할 폼 목록을 만든다.
 * @returns {Array<{ formId: string, activityId: string, html: string, stem: string, aliases: string[] }>}
 *   aliases: 이 폼을 가리키던 이전 id(작성 단계 id·파일명·activity id) — 참조 치환에 쓴다.
 */
export function collectWorkspaceForms(files, procId, definition) {
    const activities = allActivities(definition);
    const forms = [];
    const seen = new Set();
    for (const file of Array.isArray(files) ? files : []) {
        if (!isWorkspaceFormFile(file)) continue;
        const html = (file.content || '').toString();
        const stem = fileStem(file);
        if (!stem || !html) continue;
        const activity = findActivity(activities, stem);
        let activityId;
        let formId;
        if (activity) {
            activityId = String(activity.id);
            const current = formIdOfTool(activity.tool);
            const authoring = new Set([stem, toSnakeId(stem), activityId, toSnakeId(activityId)]);
            // 마무리 단계가 이미 저장용 id(`<uuid>_<id>_form`)로 바꿔 둔 연결은 그대로 쓴다.
            formId = current && !authoring.has(current) ? current : formIdFor(procId, activityId);
        } else {
            // 정의에 없는 폼(파일만 있음) — 예전처럼 파일명으로 저장한다.
            activityId = toSnakeId(stem);
            formId = formIdFor(procId, activityId);
        }
        if (seen.has(formId)) continue;
        seen.add(formId);
        const aliases = new Set([stem, toSnakeId(stem), activityId]);
        if (activity) {
            const current = formIdOfTool(activity.tool);
            if (current) aliases.add(current);
        }
        aliases.delete(formId);
        forms.push({ formId, activityId, html, stem, aliases: [...aliases], linked: !!activity });
    }
    return forms;
}

/**
 * 정의가 저장할 폼 id 를 가리키게 고친다(제자리 수정). activity.tool, activity.inputData,
 * gateway.conditionData 의 `<이전 폼 id>.<필드>` 를 `<폼 id>.<필드>` 로.
 * @returns 같은 forms 배열(호출부에서 그대로 저장에 쓴다)
 */
export function linkWorkspaceForms(definition, forms) {
    const list = Array.isArray(forms) ? forms : [];
    if (!definition || typeof definition !== 'object' || !list.length) return list;
    const activities = allActivities(definition);
    const finalIds = new Set(list.map((f) => f.formId));
    const remap = new Map();
    for (const form of list) {
        if (!form.linked) continue;
        const activity = activities.find((a) => String(a.id) === form.activityId);
        if (activity) activity.tool = `formHandler:${form.formId}`;
        for (const alias of form.aliases || []) {
            // 다른 폼의 최종 id 와 겹치는 이름은 바꾸지 않는다.
            if (alias && !finalIds.has(alias) && !remap.has(alias)) remap.set(alias, form.formId);
        }
    }
    if (!remap.size) return list;
    const remapRef = (ref) => {
        if (typeof ref !== 'string') return ref;
        const dot = ref.indexOf('.');
        if (dot <= 0) return ref;
        const target = remap.get(ref.slice(0, dot));
        return target ? `${target}${ref.slice(dot)}` : ref;
    };
    for (const activity of activities) {
        if (Array.isArray(activity.inputData)) activity.inputData = activity.inputData.map(remapRef);
    }
    for (const gateway of allGateways(definition)) {
        if (Array.isArray(gateway.conditionData)) gateway.conditionData = gateway.conditionData.map(remapRef);
    }
    return list;
}
