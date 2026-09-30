// PDF 내보내기용 프로세스/Lane/Task 설정 데이터 수집 (PAL 순서도 화면 전용)
//
// 모델러의 elementRegistry + uengine:Properties(JSON)에서 사용자가 입력한 값만 모아
// { process, lanes, raci } 구조로 돌려준다. 값이 비어 있는 필드는 넣지 않는다.
// 노출 여부는 호출자가 넘긴 isVisible(taskType, key) — Task Catalog 스튜디오의
// isBuiltinPropVisible 규칙 — 을 그대로 따른다.
import { readUengineProperties } from '@/utils/bpmnUengineProperties';
import { toSafeText } from '@/utils/safeText';

export const RACI_KEYS = ['R', 'A', 'S', 'C', 'I'];

export function normalizeRaci(value) {
    const out = { R: [], A: [], S: [], C: [], I: [] };
    if (value && typeof value === 'object') {
        RACI_KEYS.forEach((key) => {
            if (Array.isArray(value[key])) out[key] = value[key].filter(Boolean);
            else if (typeof value[key] === 'string' && value[key]) out[key] = [value[key]];
        });
    }
    return out;
}

function hasRaciValue(raci) {
    return RACI_KEYS.some((key) => raci[key].length > 0);
}

function cleanStringList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => toSafeText(typeof v === 'object' ? v?.name ?? v?.title ?? '' : v).trim()).filter(Boolean);
}

// ManualLinkField 저장 포맷({name, url}) + 레거시 문자열 혼용을 흡수한다
function cleanManualLinks(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (item == null) return null;
            if (typeof item === 'string') {
                const url = item.trim();
                return url ? { name: '', url } : null;
            }
            if (typeof item === 'object') {
                const url = toSafeText(item.url ?? '').trim();
                if (!url) return null;
                return { name: toSafeText(item.name ?? item.displayName ?? '').trim(), url };
            }
            return null;
        })
        .filter(Boolean);
}

function cleanPpi(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => ({
            name: toSafeText(item?.name).trim(),
            unit: toSafeText(item?.unit).trim(),
            cycle: toSafeText(item?.cycle).trim(),
            definition: toSafeText(item?.definition).trim(),
            formula: toSafeText(item?.formula).trim()
        }))
        .filter((item) => item.name || item.definition || item.formula);
}

function taskSortComparator(rows) {
    const allHaveCode = rows.length > 0 && rows.every((r) => r.taskCode);
    if (allHaveCode) {
        return (a, b) => a.taskCode.localeCompare(b.taskCode, undefined, { numeric: true });
    }
    return (a, b) => a.x - b.x || a.y - b.y;
}

// 커스텀 스키마 필드 값의 표시용 문자열 (빈 값이면 '' — 행 생략)
function formatCustomValue(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    if (typeof value === 'boolean') return value ? '예' : '';
    if (Array.isArray(value)) {
        return value
            .map((v) => formatCustomValue(v))
            .filter(Boolean)
            .join(', ');
    }
    if (typeof value === 'object') {
        // {name,url} 류의 흔한 형태 우선, 그 외엔 값들만 이어붙임
        const name = toSafeText(value.name ?? value.title ?? '').trim();
        const url = toSafeText(value.url ?? '').trim();
        if (name || url) return [name, url].filter(Boolean).join(' — ');
        return Object.values(value)
            .map((v) => formatCustomValue(v))
            .filter(Boolean)
            .join(', ');
    }
    return '';
}

function buildTaskEntry(el, isVisible, getCustomSchemas) {
    const props = readUengineProperties(el.businessObject);
    // 커스텀 스키마가 다루는 키는 커스텀 행(관리자 라벨)으로만 출력 — 내장 폴백과 중복 방지
    const customSchemas = typeof getCustomSchemas === 'function' ? getCustomSchemas(el.type) || [] : [];
    const customKeys = new Set(customSchemas.map((s) => toSafeText(s?.property_key).trim()).filter(Boolean));
    const entry = {
        id: el.id,
        type: el.type,
        name: toSafeText(el.businessObject?.name).trim() || el.id,
        taskCode: toSafeText(props.taskCode).trim(),
        x: el.x || 0,
        y: el.y || 0
    };

    if (isVisible('task', 'description')) {
        const description = toSafeText(props.description).trim();
        if (description) entry.description = description;
    }
    if (isVisible('task', 'raci')) {
        const raci = normalizeRaci(props.raci);
        if (hasRaciValue(raci)) entry.raci = raci;
    }
    if (isVisible('task', 'task_io')) {
        const procedure = cleanStringList(props.procedure);
        if (procedure.length) entry.procedure = procedure;
        // TaskIoField 구버전 포맷 포함 — 입력물/산출물이 uengine json 의 input/output 배열로 저장돼 있다
        if (!customKeys.has('input')) {
            const inputs = cleanStringList(props.input);
            if (inputs.length) entry.inputs = inputs;
        }
        if (!customKeys.has('output')) {
            const outputs = cleanStringList(props.output);
            if (outputs.length) entry.outputs = outputs;
        }
    }
    if (isVisible('task', 'data_io')) {
        // 다이어그램에서 연결한 데이터 객체 (DataInput/OutputAssociation)
        const bo = el.businessObject || {};
        const dataInputs = (bo.dataInputAssociations || [])
            .flatMap((assoc) => (Array.isArray(assoc?.sourceRef) ? assoc.sourceRef : [assoc?.sourceRef]))
            .map((ref) => toSafeText(ref?.name).trim())
            .filter(Boolean);
        if (dataInputs.length) entry.dataInputs = dataInputs;
        const dataOutputs = (bo.dataOutputAssociations || [])
            .map((assoc) => toSafeText(assoc?.targetRef?.name).trim())
            .filter(Boolean);
        if (dataOutputs.length) entry.dataOutputs = dataOutputs;
    }
    if (isVisible('task', 'form_link')) {
        const tool = toSafeText(props.tool).trim();
        if (tool.startsWith('formHandler:')) {
            const formId = tool.slice('formHandler:'.length).trim();
            if (formId) entry.formId = formId;
        }
    }
    if (isVisible('task', 'related_project_mapping')) {
        const relatedProjects = (Array.isArray(props.relatedProjects) ? props.relatedProjects : [])
            .map((p) => toSafeText(typeof p === 'object' ? p?.name : p).trim())
            .filter(Boolean);
        if (relatedProjects.length) entry.relatedProjects = relatedProjects;
    }
    {
        const futureStatus = toSafeText(props.futureStatus).trim();
        if (futureStatus) entry.futureStatus = futureStatus;
    }
    if (!customKeys.has('mandatory_rule')) {
        // 필수 Rule (PAL) — 문자열 또는 배열
        const mandatoryRule = cleanStringList(Array.isArray(props.mandatory_rule) ? props.mandatory_rule : [props.mandatory_rule]);
        if (mandatoryRule.length) entry.mandatoryRule = mandatoryRule;
    }
    if (el.type === 'bpmn:SendTask') {
        const mail = {};
        if (isVisible('bpmn:SendTask', 'mail_recipients')) {
            const recipients = cleanStringList(props.recipients);
            if (recipients.length) mail.recipients = recipients;
        }
        if (isVisible('bpmn:SendTask', 'mail_title')) {
            const title = toSafeText(props.title).trim();
            if (title) mail.title = title;
        }
        if (isVisible('bpmn:SendTask', 'mail_contents')) {
            const contents = toSafeText(props.contents).trim();
            if (contents) mail.contents = contents;
        }
        if (Object.keys(mail).length) entry.mail = mail;
    }
    if (el.type === 'bpmn:CallActivity' && isVisible('bpmn:CallActivity', 'definition_link')) {
        const ids = Array.isArray(props.definitionIds) && props.definitionIds.length ? props.definitionIds : [props.definitionId];
        const linkedDefinitions = cleanStringList(ids);
        if (linkedDefinitions.length) entry.linkedDefinitions = linkedDefinitions;
    }
    {
        // 속성 스키마 스튜디오에서 정의한 커스텀 필드 (값은 uengine json 에 property_key 로 저장)
        const customFields = [];
        customSchemas.forEach((schema) => {
            const key = toSafeText(schema?.property_key).trim();
            if (!key) return;
            const value = formatCustomValue(props[key]);
            if (value) customFields.push({ label: toSafeText(schema?.property_label).trim() || key, value });
        });
        if (customFields.length) entry.customFields = customFields;
    }
    if (isVisible('task', 'manual_links')) {
        const manualLinks = cleanManualLinks(props.manualLinks);
        if (manualLinks.length) entry.manualLinks = manualLinks;
    }
    if (isVisible('task', 'system_mapping')) {
        const systems = cleanStringList(props.systems);
        if (systems.length) entry.systems = systems;
    }
    if (isVisible('task', 'api_integrations')) {
        const apiIntegrations = (Array.isArray(props.apiIntegrations) ? props.apiIntegrations : [])
            .map((a) => ({
                name: toSafeText(a?.name).trim(),
                method: toSafeText(a?.method).trim(),
                url: toSafeText(a?.url).trim()
            }))
            .filter((a) => a.name || a.url);
        if (apiIntegrations.length) entry.apiIntegrations = apiIntegrations;
    }
    if (isVisible('task', 'opex')) {
        const opexCost = Number(props.opexCost);
        if (Number.isFinite(opexCost) && opexCost > 0) {
            entry.opex = {
                cost: opexCost,
                unit: toSafeText(props.opexUnit).trim(),
                note: toSafeText(props.opexNote).trim()
            };
        }
    }
    if (isVisible('task', 'fte_calculator')) {
        const fte = props.fte;
        if (fte && typeof fte === 'object' && (Number(fte.timePerTask) > 0 || Number(fte.directPercent) > 0)) {
            entry.fte = {
                inputMode: toSafeText(fte.inputMode).trim() || 'time',
                directPercent: Number(fte.directPercent) || 0,
                freqCycle: toSafeText(fte.freqCycle).trim(),
                freqCount: Number(fte.freqCount) || 0,
                timePerTask: Number(fte.timePerTask) || 0,
                headcount: Number(fte.headcount) || 0
            };
        }
    }
    const ppi = cleanPpi(props.ppi);
    if (ppi.length) entry.ppi = ppi;

    return entry;
}

function buildLaneAssignment(props) {
    const assignment = {
        resourceType: toSafeText(props.laneResourceType).trim(),
        assignees: cleanStringList(props.laneAssignee),
        organizations: cleanStringList(props.laneOrganization),
        suppliers: cleanStringList(props.laneSupplier)
    };
    const hasValue =
        assignment.resourceType || assignment.assignees.length || assignment.organizations.length || assignment.suppliers.length;
    return hasValue ? assignment : null;
}

/**
 * @param {object} modeler bpmn-js modeler (useBpmnStore().getModeler)
 * @param {object|null} processDefinition 디자이너가 받는 processDefinition prop
 * @param {(taskType: string, key: string) => boolean} [isVisible]
 * @param {(elementType: string) => Array<object>} [getCustomSchemas] 커스텀 스키마 행 목록 (taskCatalog.schemasByAppliesTo)
 */
export function collectProcessExportData(modeler, processDefinition, isVisible = () => true, getCustomSchemas = null) {
    const result = { process: {}, lanes: [], raci: { rows: [], orgs: [] } };
    if (!modeler) return result;

    // ---- 프로세스 설정 (ProcessHierarchyProperties 의 processForm 로드 규칙과 동일 소스) ----
    const def = processDefinition || {};
    result.process.title = toSafeText(def.name).trim();
    if (isVisible('process', 'description')) {
        const description = toSafeText(def.definition?.description ?? def.description).trim();
        if (description) result.process.description = description;
    }
    if (isVisible('process', 'owner')) {
        const owner = toSafeText(def.owner).trim();
        if (owner) result.process.owner = owner;
    }
    if (isVisible('process', 'system_list')) {
        const systems = cleanStringList(def.systems);
        if (systems.length) result.process.systems = systems;
    }
    if (isVisible('process', 'manual_links')) {
        const manualLinksSource =
            def.manualLinks ?? def.manual_links ?? def.definition?.manualLinks ?? def.definition?.manual_links;
        const legacySingle = def.manualLink ?? def.manual_link ?? def.definition?.manualLink ?? def.definition?.manual_link;
        const raw = Array.isArray(manualLinksSource) ? manualLinksSource : legacySingle ? [legacySingle] : [];
        const manualLinks = cleanManualLinks(raw);
        if (manualLinks.length) result.process.manualLinks = manualLinks;
    }

    const elementRegistry = modeler.get('elementRegistry');
    const all = elementRegistry.getAll();

    // Pool(Participant)의 PPI — 프로세스 수준 성과지표로 함께 출력
    if (isVisible('bpmn:Participant', 'ppi')) {
        const ppi = [];
        all.filter((el) => el.type === 'bpmn:Participant').forEach((el) => {
            ppi.push(...cleanPpi(readUengineProperties(el.businessObject).ppi));
        });
        const defPpi = cleanPpi(def.ppi ?? def.definition?.ppi);
        defPpi.forEach((item) => {
            if (!ppi.some((p) => p.name === item.name)) ppi.push(item);
        });
        if (ppi.length) result.process.ppi = ppi;
    }

    // ---- Lane 및 소속 Task ----
    const laneElements = all.filter((el) => el.type === 'bpmn:Lane').sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
    const laneIdByTaskId = {};
    laneElements.forEach((laneEl) => {
        (laneEl.businessObject?.flowNodeRef || []).forEach((flowNode) => {
            laneIdByTaskId[flowNode.id] = laneEl.id;
        });
    });

    const isTaskLike = (el) => el.type && (el.type.includes('Task') || el.type === 'bpmn:CallActivity');
    const taskEntries = all.filter(isTaskLike).map((el) => buildTaskEntry(el, isVisible, getCustomSchemas));
    taskEntries.sort(taskSortComparator(taskEntries));

    const lanes = laneElements.map((laneEl) => {
        const props = readUengineProperties(laneEl.businessObject);
        const lane = {
            id: laneEl.id,
            name: toSafeText(laneEl.businessObject?.name).trim() || laneEl.id,
            tasks: taskEntries.filter((t) => laneIdByTaskId[t.id] === laneEl.id)
        };
        if (isVisible('bpmn:Lane', 'description')) {
            const description = toSafeText(props.laneDescription).trim();
            if (description) lane.description = description;
        }
        if (isVisible('bpmn:Lane', 'lane_assignment')) {
            const assignment = buildLaneAssignment(props);
            if (assignment) lane.assignment = assignment;
        }
        return lane;
    });

    const unassigned = taskEntries.filter((t) => !laneIdByTaskId[t.id]);
    if (unassigned.length) {
        lanes.push({ id: '__no_lane__', name: '(Lane 없음)', tasks: unassigned });
    }
    result.lanes = lanes.filter((lane) => lane.tasks.length || lane.description || lane.assignment);

    // ---- 통합 RACI (RaciMatrixDialog.build 와 동일 규칙: Task 계열만, taskCode → 좌표 정렬) ----
    const laneNameById = {};
    laneElements.forEach((laneEl) => {
        laneNameById[laneEl.id] = toSafeText(laneEl.businessObject?.name).trim();
    });
    if (isVisible('task', 'raci')) {
        const rows = all
            .filter((el) => el.type && el.type.includes('Task'))
            .map((el) => {
                const props = readUengineProperties(el.businessObject);
                return {
                    id: el.id,
                    name: toSafeText(el.businessObject?.name).trim() || el.id,
                    taskCode: toSafeText(props.taskCode).trim(),
                    laneName: laneNameById[laneIdByTaskId[el.id]] || '',
                    raci: normalizeRaci(props.raci),
                    x: el.x || 0,
                    y: el.y || 0
                };
            });
        rows.sort(taskSortComparator(rows));

        const orgs = [];
        rows.forEach((row) => {
            RACI_KEYS.forEach((key) => {
                row.raci[key].forEach((org) => {
                    if (org && !orgs.includes(org)) orgs.push(org);
                });
            });
        });
        if (orgs.length) {
            result.raci = { rows, orgs };
        }
    }

    return result;
}
