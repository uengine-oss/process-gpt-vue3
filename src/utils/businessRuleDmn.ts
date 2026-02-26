type BusinessRuleCondition = { item?: any; key?: any; operator?: any; value?: any };
type BusinessRuleResult = { outcome?: any; note?: any };

export type BusinessRuleInputDef = {
    item?: any; // 내부 key(실행 변수명/식별자) - 대소문자 유지
    label?: any; // 사람용 라벨(UI 표시)
    key?: any; // 호환: 일부 저장본은 key로 내려올 수 있음
    inputMode?: any; // number | boolean | enum | date (UI 용)
    options?: any[]; // enum 선택지(선택적)
};

export type BusinessRuleRuleRow = {
    conditions?: BusinessRuleCondition[];
    result?: BusinessRuleResult; // 고정 출력: outcome, note
    enabled?: boolean; // 규칙 활성화/비활성화 상태 (기본값: true)
};

export type BusinessRuleModel = {
    id?: any;
    name?: any;
    description?: any;
    // 신규: 입력 항목(열) + 규칙(행)
    inputs?: BusinessRuleInputDef[];
    rules?: BusinessRuleRuleRow[];
    // 레거시(호환): 단일 조건/결과
    conditions?: BusinessRuleCondition[];
    result?: BusinessRuleResult;
};

function xmlEscape(value: string) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function toSnakeId(value: string, fallback: string) {
    // NOTE: DMN element id 용. 실행 변수명과는 분리한다.
    const raw = String(value ?? '').trim().toLowerCase();
    const s = raw
        .replace(/[^a-z0-9가-힣]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return s || fallback;
}

function toExpressionNamePreserveCase(value: string, fallback: string) {
    // NOTE: 실행 시 입력 변수명 매칭이 깨지지 않도록 "대소문자 유지"가 중요하다.
    // - creditRating -> creditRating (유지)
    // - 신용 점수 -> 신용_점수 (공백 등만 정리)
    const raw = String(value ?? '').trim();
    const s = raw
        .replace(/[^a-zA-Z0-9가-힣]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return s || fallback;
}

function isNumberLike(v: string) {
    const s = String(v ?? '').trim();
    if (!s) return false;
    // allow integers / floats
    return /^-?\d+(\.\d+)?$/.test(s);
}

function feelStringLiteral(v: string) {
    const escaped = String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function normalizeOutcome(outcome: any) {
    const o = String(outcome ?? '').trim();
    if (o === 'approve' || o === 'conditional' || o === 'reject') return o;
    return 'approve';
}

function normalizeInputMode(mode: any) {
    const m = String(mode ?? '');
    if (
        m === 'number' ||
        m === 'boolean' ||
        m === 'enum' ||
        m === 'date' ||
        m === 'time' ||
        m === 'dateTime' ||
        m === 'dayTimeDuration' ||
        m === 'yearMonthDuration' ||
        m === 'any'
    ) return m;
    return 'number';
}

function inputModeToTypeRef(mode: any) {
    switch (normalizeInputMode(mode)) {
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'date':
            return 'date';
        case 'time':
            return 'time';
        case 'dateTime':
            return 'dateTime';
        case 'dayTimeDuration':
            return 'dayTimeDuration';
        case 'yearMonthDuration':
            return 'yearMonthDuration';
        case 'any':
            return 'Any';
        case 'enum':
        default:
            return 'string';
    }
}

function normalizeBooleanLike(v: any) {
    if (typeof v === 'boolean') return v;
    const s = String(v ?? '').trim().toLowerCase();
    if (s === 'true' || s === 'yes' || s === 'y' || s === '1') return true;
    if (s === 'false' || s === 'no' || s === 'n' || s === '0') return false;
    return null;
}

function dateLiteral(yyyyMmDd: string) {
    const s = String(yyyyMmDd ?? '').trim();
    if (!s) return '';
    // FEEL date literal
    return `date(${feelStringLiteral(s)})`;
}

function timeLiteral(hhMm: string) {
    const s = String(hhMm ?? '').trim();
    if (!s) return '';
    // FEEL time literal
    return `time(${feelStringLiteral(s)})`;
}

function dateTimeLiteral(yyyyMmDdThhMm: string) {
    const s = String(yyyyMmDdThhMm ?? '').trim();
    if (!s) return '';
    // FEEL date and time literal
    return `date and time(${feelStringLiteral(s)})`;
}

function operatorToUnaryTest(op: any, rawValue: any) {
    const vRaw = rawValue;
    const v = String(vRaw ?? '').trim();
    const hasValue = v.length > 0;
    const literal = isNumberLike(v) ? v : feelStringLiteral(v);

    switch (String(op ?? '')) {
        case 'gte':
            return hasValue ? `>= ${literal}` : '-';
        case 'lte':
            return hasValue ? `<= ${literal}` : '-';
        case 'eq':
            return hasValue ? `${literal}` : '-';
        case 'neq':
            return hasValue ? `not(${literal})` : '-';
        case 'contains':
            // FEEL unary test: use '?' placeholder
            return hasValue ? `contains(?, ${literal})` : '-';
        case 'before': {
            // date/time/dateTime 모두 before/after 지원
            const dt = dateTimeLiteral(v);
            if (dt) return `< ${dt}`;
            const t = timeLiteral(v);
            if (t) return `< ${t}`;
            const d = dateLiteral(v);
            return d ? `< ${d}` : '-';
        }
        case 'after': {
            const dt = dateTimeLiteral(v);
            if (dt) return `> ${dt}`;
            const t = timeLiteral(v);
            if (t) return `> ${t}`;
            const d = dateLiteral(v);
            return d ? `> ${d}` : '-';
        }
        default:
            // boolean direct (true/false) or string/number fallback
            if (typeof vRaw === 'boolean') return vRaw ? 'true' : 'false';
            const b = normalizeBooleanLike(vRaw);
            if (b !== null) return b ? 'true' : 'false';
            return hasValue ? `${literal}` : '-';
    }
}

function unaryTestToOperatorAndValue(test: string) {
    const t = String(test ?? '').trim();
    if (!t || t === '-') return { operator: 'gte', value: '' };

    const mGte = t.match(/^>=\s*(.+)$/);
    if (mGte) return { operator: 'gte', value: unquoteFeelLiteral(mGte[1]) };
    const mLte = t.match(/^<=\s*(.+)$/);
    if (mLte) return { operator: 'lte', value: unquoteFeelLiteral(mLte[1]) };

    const mNot = t.match(/^not\((.*)\)$/);
    if (mNot) return { operator: 'neq', value: unquoteFeelLiteral(mNot[1]) };

    const mContains = t.match(/^contains\(\?\s*,\s*(.*)\)$/);
    if (mContains) return { operator: 'contains', value: unquoteFeelLiteral(mContains[1]) };

    const mBeforeDt = t.match(/^<\s*date and time\("(.*)"\)\s*$/);
    if (mBeforeDt) return { operator: 'before', value: mBeforeDt[1] };
    const mAfterDt = t.match(/^>\s*date and time\("(.*)"\)\s*$/);
    if (mAfterDt) return { operator: 'after', value: mAfterDt[1] };

    const mBeforeTime = t.match(/^<\s*time\("(.*)"\)\s*$/);
    if (mBeforeTime) return { operator: 'before', value: mBeforeTime[1] };
    const mAfterTime = t.match(/^>\s*time\("(.*)"\)\s*$/);
    if (mAfterTime) return { operator: 'after', value: mAfterTime[1] };

    const mBefore = t.match(/^<\s*date\("(.*)"\)\s*$/);
    if (mBefore) return { operator: 'before', value: mBefore[1] };
    const mAfter = t.match(/^>\s*date\("(.*)"\)\s*$/);
    if (mAfter) return { operator: 'after', value: mAfter[1] };

    return { operator: 'eq', value: unquoteFeelLiteral(t) };
}

function unquoteFeelLiteral(v: string) {
    const s = String(v ?? '').trim();
    // strip surrounding quotes if present
    const m = s.match(/^"(.*)"$/);
    if (m) return m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    return s;
}

/**
 * 비즈니스 룰(조건/결과) → DMN 1.3 DecisionTable XML
 * - UI에는 XML을 노출하지 않고 내부 데이터로만 사용한다.
 * - DI(DMNDI) 정보는 생성하지 않는다(실행/저장용 최소 XML).
 */
export function businessRuleToDmnXml(rule: BusinessRuleModel) {
    const ruleId = String(rule?.id ?? '').trim();
    const ruleName = String(rule?.name ?? '').trim() || '비즈니스 규칙';
    const defId = toSnakeId(ruleId || ruleName, 'business_rule');

    // 입력 항목(열) 구성: 신규 모델 우선, 없으면 레거시 conditions 기반으로 유도
    const inputs: BusinessRuleInputDef[] = Array.isArray(rule?.inputs) && rule.inputs.length > 0
        ? rule.inputs
        : (Array.isArray(rule?.conditions) ? rule.conditions.map((c) => ({
              item: String(c?.item ?? '').trim(),
              inputMode: isNumberLike(String(c?.value ?? '').trim()) ? 'number' : 'enum',
              options: []
          })) : []);

    const normalizedInputs = inputs.map((i, idx) => ({
        item: String(i?.item ?? '').trim() || String(i?.key ?? '').trim() || `input_${idx + 1}`,
        label: String(i?.label ?? '').trim() || String(i?.item ?? '').trim() || `항목 ${idx + 1}`,
        inputMode: normalizeInputMode(i?.inputMode),
        options: Array.isArray(i?.options) ? i.options : []
    }));

    // 규칙(행) 구성: 신규 모델 우선, 없으면 레거시 단일 조건/결과로 유도
    const rows: BusinessRuleRuleRow[] = Array.isArray(rule?.rules) && rule.rules.length > 0
        ? rule.rules
        : [{
              conditions: Array.isArray(rule?.conditions) ? rule.conditions : [],
              result: rule?.result ?? { outcome: 'approve', note: '' }
          }];

    const normalizedRows = rows.map((r) => ({
        conditions: Array.isArray(r?.conditions) ? r.conditions.map((c) => ({
            // UI는 key를 사용(내부 식별자). 레거시/호환을 위해 item도 허용한다.
            item: String(c?.key ?? c?.item ?? '').trim(),
            operator: String(c?.operator ?? '').trim(),
            value: c?.value
        })) : [],
        result: {
            outcome: normalizeOutcome(r?.result?.outcome),
            note: String(r?.result?.note ?? '').trim()
        },
        enabled: r?.enabled !== undefined ? r.enabled : true
    }));

    const decisionId = `decision_${defId}`;
    const tableId = `decision_table_${defId}`;

    const inputXml = normalizedInputs
        .map((inp, idx) => {
            const inputId = `input_${idx + 1}`;
            const inputExprId = `input_expression_${idx + 1}`;
            const label = inp.label || `항목 ${idx + 1}`;
            const key = inp.item || `input_${idx + 1}`;
            // 실행 입력 변수명: 내부 key(대소문자) 유지
            const expr = toExpressionNamePreserveCase(key, `input_${idx + 1}`);
            const typeRef = inputModeToTypeRef(inp.inputMode);
            return `      <input id="${xmlEscape(inputId)}" label="${xmlEscape(label)}">
        <inputExpression id="${xmlEscape(inputExprId)}" typeRef="${xmlEscape(typeRef)}">
          <text>${xmlEscape(expr)}</text>
        </inputExpression>
      </input>`;
        })
        .join('\n');

    // 저장/실행 관점에서는 로케일에 영향받지 않는 영어 라벨을 사용한다.
    // (UI 표시 문구는 별도로 locale/i18n으로 처리)
    // NOTE: note는 "결과 데이터"가 아니라 사람이 읽는 설명이므로 output이 아닌 annotations로 저장한다.
    const outputsXml = `      <output id="output_1" label="Outcome" name="outcome" typeRef="string" />`;

    // decision table annotations(주석 컬럼)
    const annotationsXml = `      <annotation id="annotation_1" name="Note" />`;

    const rulesXml = normalizedRows
        .map((row, rIdx) => {
            // enabled가 false인 경우 주석으로 표시 (DMN 표준에는 enabled 속성이 없으므로)
            const isEnabled = row.enabled !== false;
            const whenMap = new Map<string, any>();
            row.conditions.forEach((c: any) => {
                const k = String(c?.key ?? c?.item ?? '').trim();
                if (!k) return;
                // 동일 항목이 중복되면 마지막 값을 사용
                whenMap.set(k, c);
            });

            const inputEntriesXml = normalizedInputs
                .map((inp, idx) => {
                    const entryId = `rule_${rIdx + 1}_input_entry_${idx + 1}`;
                    const c = whenMap.get(inp.item);
                    const test = c ? operatorToUnaryTest(c.operator, c.value) : '-';
                    return `        <inputEntry id="${xmlEscape(entryId)}"><text>${xmlEscape(test)}</text></inputEntry>`;
                })
                .join('\n');

            const outcomeLiteral = feelStringLiteral(row.result.outcome);
            const outputEntriesXml = `        <outputEntry id="rule_${rIdx + 1}_output_entry_1"><text>${xmlEscape(outcomeLiteral)}</text></outputEntry>`;

            // 주석은 FEEL이 아닌 plain text로 저장한다.
            const noteText = String(row.result.note ?? '').trim();
            // enabled 상태를 주석에 포함 (복원 시 사용)
            const enabledNote = isEnabled ? noteText : `[DISABLED] ${noteText}`;
            const annotationEntryXml = `        <annotationEntry id="rule_${rIdx + 1}_annotation_entry_1"><text>${xmlEscape(enabledNote)}</text></annotationEntry>`;

            return `      <rule id="rule_${rIdx + 1}">
${inputEntriesXml ? inputEntriesXml + '\n' : ''}${outputEntriesXml}
${annotationEntryXml}
      </rule>`;
        })
        .join('\n');

    // IMPORTANT: parseDmnXml()가 querySelector('decision') 등으로 찾기 때문에,
    // element prefix 없이 default namespace만 사용한다.
    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             id="${xmlEscape(`definitions_${defId}`)}"
             name="${xmlEscape(ruleName)}"
             namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="${xmlEscape(decisionId)}" name="${xmlEscape(ruleName)}">
    <decisionTable id="${xmlEscape(tableId)}" hitPolicy="FIRST">
${inputXml ? inputXml + '\n' : ''}${outputsXml}
${annotationsXml}
${rulesXml}
    </decisionTable>
  </decision>
</definitions>`;
}

/**
 * DMN 1.3 DecisionTable XML → 비즈니스 룰(조건/결과)
 * - 이 변환은 UI를 깨지 않게 하기 위한 "호환 레이어"로만 사용한다.
 */
export function dmnXmlToBusinessRule(xmlString: string) {
    if (!xmlString) return null;
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) return null;

        const allByLocalName = (root: any, localName: string): Element[] => {
            try {
                if (root && typeof root.getElementsByTagNameNS === 'function') {
                    return Array.from(root.getElementsByTagNameNS('*', localName)) as Element[];
                }
            } catch (e) {
                // ignore
            }
            try {
                return Array.from(root.getElementsByTagName(localName)) as Element[];
            } catch (e) {
                return [];
            }
        };
        const firstByLocalName = (root: any, localName: string): Element | null => allByLocalName(root, localName)[0] || null;

        const decision = firstByLocalName(xmlDoc, 'decision');
        const decisionTable = decision ? firstByLocalName(decision, 'decisionTable') : null;
        if (!decisionTable) return null;

        const inputs = allByLocalName(decisionTable, 'input');
        const inputDefs: BusinessRuleInputDef[] = inputs.map((input, idx) => {
            const label = input.getAttribute('label') || '';
            const inputExpr = firstByLocalName(input, 'inputExpression');
            const typeRef = inputExpr?.getAttribute('typeRef') || '';
            const exprText = firstByLocalName(inputExpr, 'text')?.textContent || '';
            // UI에서 item은 "식별자"로 쓰이므로 expression text를 우선 사용
            const item = exprText || label || `input_${idx + 1}`;
            const mode =
                typeRef === 'number' ? 'number' :
                typeRef === 'boolean' ? 'boolean' :
                typeRef === 'date' ? 'date' :
                typeRef === 'time' ? 'time' :
                typeRef === 'dateTime' ? 'dateTime' :
                typeRef === 'dayTimeDuration' ? 'dayTimeDuration' :
                typeRef === 'yearMonthDuration' ? 'yearMonthDuration' :
                typeRef === 'Any' ? 'any' :
                'enum';
            return { item, label: label || item, inputMode: mode, options: [] };
        });

        const ruleNodes = allByLocalName(decisionTable, 'rule');
        const annotationHeaders = allByLocalName(decisionTable, 'annotation');
        const noteAnnotationIdx = annotationHeaders.findIndex((a) => {
            const name = String(a.getAttribute('name') || '').trim().toLowerCase();
            return name === 'note' || name.includes('note');
        });

        const rows: BusinessRuleRuleRow[] = ruleNodes.map((ruleNode) => {
            const inputEntries = allByLocalName(ruleNode, 'inputEntry');
            const outputEntries = allByLocalName(ruleNode, 'outputEntry');
            const annotationEntries = allByLocalName(ruleNode, 'annotationEntry');
            const conditions = inputDefs.map((inp, idx) => {
                const test = firstByLocalName(inputEntries[idx], 'text')?.textContent || '';
                const parsed = unaryTestToOperatorAndValue(test);
                let value: any = parsed.value;
                if ((parsed.operator === 'gte' || parsed.operator === 'lte') && isNumberLike(String(value))) {
                    value = Number(value);
                }
                const b = normalizeBooleanLike(value);
                if (b !== null) value = b;
                return { key: inp.item, operator: parsed.operator, value };
            });

            const outcomeText = firstByLocalName(outputEntries[0], 'text')?.textContent || '';
            const outcome = normalizeOutcome(unquoteFeelLiteral(outcomeText));
            // NOTE:
            // - note는 "annotations"가 정식 저장 위치다.
            // - 기존(outputEntry 2번째)에 들어있던 note는 더 이상 사용하지 않는다.
            let note = '';
            const noteFromAnnotation = noteAnnotationIdx >= 0
                ? (firstByLocalName(annotationEntries[noteAnnotationIdx], 'text')?.textContent || '')
                : (firstByLocalName(annotationEntries[0], 'text')?.textContent || '');
            if (String(noteFromAnnotation || '').trim()) {
                note = String(noteFromAnnotation || '');
            }
            
            // enabled 상태 복원: 주석에 [DISABLED]가 포함되어 있으면 false
            const enabled = !String(note || '').includes('[DISABLED]');
            // [DISABLED] 접두사 제거
            if (!enabled && note.startsWith('[DISABLED]')) {
                note = note.replace(/^\[DISABLED\]\s*/, '');
            }
            
            return { conditions, result: { outcome, note }, enabled };
        });

        return {
            name: decision?.getAttribute('name') || '',
            inputs: inputDefs,
            rules: rows
        };
    } catch (e) {
        return null;
    }
}

