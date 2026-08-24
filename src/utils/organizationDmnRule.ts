export const DEFAULT_ORGANIZATION_DMN_KEY = 'organization-assignment-routing';
export const DEFAULT_ORGANIZATION_DMN_NAME = '조직 배정 라우팅';
export const DEFAULT_ORGANIZATION_DMN_DESCRIPTION = '역할, 도메인, 지역, 망종류, 제조사 기준으로 협력사 배정 결과를 결정합니다.';

export const ORGANIZATION_DMN_INPUTS = [
    { key: 'role', label: '역할' },
    { key: 'domain', label: '도메인' },
    { key: 'region', label: '지역' },
    { key: 'networkType', label: '망종류' },
    { key: 'manufacturer', label: '제조사' }
] as const;

export const ORGANIZATION_DMN_OUTPUTS = [
    { key: 'contractor', label: '도급사' },
    { key: 'operationPartner', label: '운용지원파트너사' }
] as const;

/**
 * 출력의 "구조적 참조"(org_id/member_type)를 담는 추가 DMN 출력 컬럼 구성.
 * label 컬럼(contractor/operationPartner)은 사람이 읽는 org_name을 유지하고,
 * id/type 컬럼은 실제 조직 레코드를 가리키는 참조를 함께 직렬화한다.
 * (org-dmn-rule.contract §2 / research R2)
 */
export const ORGANIZATION_DMN_OUTPUT_REFS = [
    { labelKey: 'contractor', idKey: 'contractorId', typeKey: 'contractorType', refField: 'contractorRef', label: '도급사' },
    {
        labelKey: 'operationPartner',
        idKey: 'operationPartnerId',
        typeKey: 'operationPartnerType',
        refField: 'operationPartnerRef',
        label: '운용지원파트너사'
    }
] as const;

export type OrganizationMemberType = 'team' | 'supplier';

/** DMN 출력이 가리키는 실제 조직 레코드에 대한 구조적 참조 (data-model §2) */
export type OrganizationReference = {
    orgId: string;
    orgName: string;
    memberType: OrganizationMemberType;
};

export type OrganizationRoutingRule = {
    id: string;
    role: string;
    domain: string;
    region: string;
    networkType: string;
    manufacturer: string;
    contractor: string;
    operationPartner: string;
    /** 도급사 출력의 구조적 참조. null이면 레거시 자유 텍스트(미연결). */
    contractorRef?: OrganizationReference | null;
    /** 운용지원파트너사 출력의 구조적 참조. null이면 레거시 자유 텍스트(미연결). */
    operationPartnerRef?: OrganizationReference | null;
    memo?: string;
    enabled: boolean;
};

export type OrganizationDmnRuleModel = {
    id: string;
    name: string;
    description: string;
    rules: OrganizationRoutingRule[];
};

export type OrganizationDecisionRow = Omit<OrganizationRoutingRule, 'id' | 'enabled'>;

export function makeOrganizationDmnRowId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeMemberType(value: unknown): OrganizationMemberType {
    return String(value ?? '').trim().toLowerCase() === 'supplier' ? 'supplier' : 'team';
}

export function createEmptyOrganizationRoutingRule(value?: Partial<OrganizationRoutingRule>): OrganizationRoutingRule {
    return {
        id: makeOrganizationDmnRowId(),
        role: '',
        domain: '',
        region: '',
        networkType: '',
        manufacturer: '',
        contractor: '',
        operationPartner: '',
        contractorRef: null,
        operationPartnerRef: null,
        memo: '',
        enabled: true,
        ...(value || {})
    };
}

export function createDefaultOrganizationDmnRule(): OrganizationDmnRuleModel {
    return {
        id: DEFAULT_ORGANIZATION_DMN_KEY,
        name: DEFAULT_ORGANIZATION_DMN_NAME,
        description: DEFAULT_ORGANIZATION_DMN_DESCRIPTION,
        rules: [createEmptyOrganizationRoutingRule()]
    };
}

export function createSampleOrganizationRoutingRules(): OrganizationRoutingRule[] {
    return [
        createEmptyOrganizationRoutingRule({
            role: '운용지원',
            domain: '전송',
            region: '수도권',
            networkType: '5G',
            manufacturer: 'Samsung',
            contractor: '수도권 전송 도급사',
            operationPartner: 'Samsung 운용지원파트너',
            memo: '수도권 5G 전송 장비'
        }),
        createEmptyOrganizationRoutingRule({
            role: '현장조치',
            domain: '교환',
            region: '영남',
            networkType: 'LTE',
            manufacturer: 'Ericsson',
            contractor: '영남 교환 도급사',
            operationPartner: 'Ericsson 운용지원파트너',
            memo: '영남 LTE 교환 장비'
        })
    ];
}

export function isValidOrganizationDmnKey(value: string) {
    return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(String(value || '').trim());
}

function xmlEscape(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function feelStringLiteral(value: unknown) {
    const escaped = String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function unquoteFeelLiteral(value: string) {
    const raw = String(value ?? '').trim();
    if (raw === '-') return '';
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
        return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return raw;
}

function normalizeXmlId(value: string, fallback: string) {
    const raw = String(value || '').trim();
    const normalized = raw
        .replace(/[^A-Za-z0-9_.-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[-.0-9]+/, '')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
}

function trimRule(row: OrganizationRoutingRule): OrganizationRoutingRule {
    return {
        ...row,
        role: String(row.role || '').trim(),
        domain: String(row.domain || '').trim(),
        region: String(row.region || '').trim(),
        networkType: String(row.networkType || '').trim(),
        manufacturer: String(row.manufacturer || '').trim(),
        contractor: String(row.contractor || '').trim(),
        operationPartner: String(row.operationPartner || '').trim(),
        memo: String(row.memo || '').trim()
    };
}

export function hasOrganizationRuleContent(row: OrganizationRoutingRule) {
    const r = trimRule(row);
    return Boolean(r.role || r.domain || r.region || r.networkType || r.manufacturer || r.contractor || r.operationPartner || r.memo);
}

export function isCompleteOrganizationRule(row: OrganizationRoutingRule) {
    const r = trimRule(row);
    return r.enabled !== false && Boolean(r.role && (r.contractor || r.operationPartner));
}

export function buildOrganizationDecisionRows(model: OrganizationDmnRuleModel): OrganizationDecisionRow[] {
    return (model.rules || [])
        .map(trimRule)
        .filter(isCompleteOrganizationRule)
        .map((row) => ({
            role: row.role,
            domain: row.domain,
            region: row.region,
            networkType: row.networkType,
            manufacturer: row.manufacturer,
            contractor: row.contractor,
            operationPartner: row.operationPartner,
            contractorRef: row.contractorRef || null,
            operationPartnerRef: row.operationPartnerRef || null,
            memo: row.memo
        }));
}

export function organizationRuleIdentity(row: OrganizationRoutingRule) {
    const r = trimRule(row);
    return [r.role, r.domain, r.region, r.networkType, r.manufacturer].join(' / ');
}

export function organizationDmnRuleToXml(model: OrganizationDmnRuleModel) {
    const dmnKey = String(model.id || DEFAULT_ORGANIZATION_DMN_KEY).trim();
    const decisionId = isValidOrganizationDmnKey(dmnKey) ? dmnKey : normalizeXmlId(dmnKey, DEFAULT_ORGANIZATION_DMN_KEY);
    const safeId = normalizeXmlId(decisionId, 'organization_assignment_routing');
    const ruleName = String(model.name || DEFAULT_ORGANIZATION_DMN_NAME).trim();
    const rows = buildOrganizationDecisionRows(model);

    const inputXml = ORGANIZATION_DMN_INPUTS.map(
        (input) => `      <input id="input_${xmlEscape(input.key)}" label="${xmlEscape(input.label)}">
        <inputExpression id="input_expression_${xmlEscape(input.key)}" typeRef="string">
          <text>${xmlEscape(input.key)}</text>
        </inputExpression>
      </input>`
    ).join('\n');

    // 출력 컬럼: 라벨(org_name) + 구조적 참조(org_id, member_type)
    const outputColumns = ORGANIZATION_DMN_OUTPUT_REFS.flatMap((ref) => [
        { key: ref.labelKey, label: ref.label },
        { key: ref.idKey, label: `${ref.label} ID` },
        { key: ref.typeKey, label: `${ref.label} 유형` }
    ]);

    const outputXml = outputColumns
        .map(
            (output) =>
                `      <output id="output_${xmlEscape(output.key)}" label="${xmlEscape(output.label)}" name="${xmlEscape(
                    output.key
                )}" typeRef="string" />`
        )
        .join('\n');

    const rulesXml = rows
        .map((row, index) => {
            const ruleNo = index + 1;
            const inputEntries = ORGANIZATION_DMN_INPUTS.map((input, inputIndex) => {
                const rawValue = row[input.key] || '';
                const unaryTest = rawValue ? feelStringLiteral(rawValue) : '-';
                return `        <inputEntry id="rule_${ruleNo}_input_entry_${inputIndex + 1}"><text>${xmlEscape(
                    unaryTest
                )}</text></inputEntry>`;
            }).join('\n');
            const outputValues = ORGANIZATION_DMN_OUTPUT_REFS.flatMap((ref) => {
                const refValue = row[ref.refField] as OrganizationReference | null | undefined;
                return [row[ref.labelKey] || '', refValue?.orgId || '', refValue?.memberType || ''];
            });
            const outputEntries = outputValues
                .map(
                    (value, outputIndex) =>
                        `        <outputEntry id="rule_${ruleNo}_output_entry_${outputIndex + 1}"><text>${xmlEscape(
                            feelStringLiteral(value)
                        )}</text></outputEntry>`
                )
                .join('\n');
            return `      <rule id="rule_${ruleNo}">
${inputEntries}
${outputEntries}
        <annotationEntry id="rule_${ruleNo}_annotation_entry_1"><text>${xmlEscape(row.memo)}</text></annotationEntry>
      </rule>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             id="${xmlEscape(`definitions_${safeId}`)}"
             name="${xmlEscape(ruleName)}"
             namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="${xmlEscape(decisionId)}" name="${xmlEscape(ruleName)}">
    <decisionTable id="${xmlEscape(`decision_table_${safeId}`)}" hitPolicy="FIRST">
${inputXml}
${outputXml}
      <annotation id="annotation_1" name="Note" />
${rulesXml}
    </decisionTable>
  </decision>
</definitions>`;
}

export function organizationDmnXmlToRule(xmlString: string, fallback?: Partial<OrganizationDmnRuleModel>): OrganizationDmnRuleModel {
    const rule = {
        ...createDefaultOrganizationDmnRule(),
        ...(fallback || {})
    };

    if (!xmlString || typeof DOMParser === 'undefined') return rule;

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) return rule;

        const allByLocalName = (root: ParentNode | null | undefined, localName: string): Element[] => {
            if (!root) return [];
            const searchableRoot = root as ParentNode & {
                getElementsByTagNameNS?: (namespaceURI: string, localName: string) => HTMLCollectionOf<Element>;
                getElementsByTagName?: (qualifiedName: string) => HTMLCollectionOf<Element>;
            };
            try {
                if (typeof searchableRoot.getElementsByTagNameNS === 'function') {
                    return Array.from(searchableRoot.getElementsByTagNameNS('*', localName));
                }
            } catch (e) {
                // fallback below
            }
            if (typeof searchableRoot.getElementsByTagName === 'function') {
                return Array.from(searchableRoot.getElementsByTagName(localName));
            }
            return [];
        };

        const firstByLocalName = (root: ParentNode | null | undefined, localName: string) => allByLocalName(root, localName)[0] || null;
        const decision = firstByLocalName(xmlDoc, 'decision');
        const decisionTable = decision ? firstByLocalName(decision, 'decisionTable') : null;
        if (!decisionTable) return rule;

        const inputKeys = allByLocalName(decisionTable, 'input').map((input, index) => {
            const expression = firstByLocalName(input, 'inputExpression');
            const expressionText = String(firstByLocalName(expression, 'text')?.textContent || '').trim();
            const label = String(input.getAttribute('label') || '').trim();
            return expressionText || label || ORGANIZATION_DMN_INPUTS[index]?.key || `input_${index + 1}`;
        });
        const outputKeys = allByLocalName(decisionTable, 'output').map((output, index) => {
            const name = String(output.getAttribute('name') || '').trim();
            const label = String(output.getAttribute('label') || '').trim();
            return name || label || `output_${index + 1}`;
        });

        const rows = allByLocalName(decisionTable, 'rule').map((ruleNode) => {
            const inputEntries = allByLocalName(ruleNode, 'inputEntry');
            const outputEntries = allByLocalName(ruleNode, 'outputEntry');
            const annotationEntries = allByLocalName(ruleNode, 'annotationEntry');
            const row = createEmptyOrganizationRoutingRule();

            inputKeys.forEach((key, index) => {
                const normalizedKey = key as keyof OrganizationRoutingRule;
                if (!(normalizedKey in row)) return;
                if (normalizedKey === 'contractorRef' || normalizedKey === 'operationPartnerRef') return;
                row[normalizedKey] = unquoteFeelLiteral(firstByLocalName(inputEntries[index], 'text')?.textContent || '') as never;
            });

            // 출력값을 name 기준 맵으로 수집(라벨 + id/type 컬럼)
            const outputValues: Record<string, string> = {};
            outputKeys.forEach((key, index) => {
                outputValues[key] = unquoteFeelLiteral(firstByLocalName(outputEntries[index], 'text')?.textContent || '');
            });

            ORGANIZATION_DMN_OUTPUT_REFS.forEach((ref) => {
                const label = outputValues[ref.labelKey] || '';
                const orgId = outputValues[ref.idKey] || '';
                const memberType = outputValues[ref.typeKey] || '';
                row[ref.labelKey] = label as never;
                // id/type 컬럼이 있으면 구조적 참조 복원, 없으면 null(레거시 하위호환)
                row[ref.refField] = (orgId
                    ? { orgId, orgName: label, memberType: normalizeMemberType(memberType) }
                    : null) as never;
            });

            row.memo = firstByLocalName(annotationEntries[0], 'text')?.textContent || '';
            return row;
        });

        return {
            id: String(fallback?.id || decision?.getAttribute('id') || rule.id),
            name: String(fallback?.name || decision?.getAttribute('name') || rule.name),
            description: String(fallback?.description || rule.description),
            rules: rows.length ? rows : [createEmptyOrganizationRoutingRule()]
        };
    } catch (e) {
        return rule;
    }
}

// ============================================================================
// 디자인-시점 미리보기 (FIRST-hit 매처) — org-dmn-rule.contract §4 / research R3
// ============================================================================

export type OrganizationRuleInput = Partial<
    Record<'role' | 'domain' | 'region' | 'networkType' | 'manufacturer', string>
>;

export type OrganizationMatchResult = {
    matched: boolean;
    ruleId?: string;
    contractor?: string;
    contractorRef?: OrganizationReference | null;
    operationPartner?: string;
    operationPartnerRef?: OrganizationReference | null;
};

const ORGANIZATION_INPUT_KEYS = ['role', 'domain', 'region', 'networkType', 'manufacturer'] as const;

function ruleFieldMatchesInput(ruleValue: string, inputValue: string | undefined) {
    const rv = String(ruleValue ?? '').trim();
    if (!rv || rv === '-') return true; // any
    return rv === String(inputValue ?? '').trim();
}

/**
 * 결정 테이블을 FIRST hit policy로 평가한다. 백엔드 호출 없이 결정적으로 동작.
 * enabled !== false 규칙을 배열 순서대로 순회하여 첫 매칭 출력을 반환.
 */
export function matchOrganizationRule(model: OrganizationDmnRuleModel, input: OrganizationRuleInput): OrganizationMatchResult {
    const rules = (model?.rules || []).filter((r) => r && r.enabled !== false);
    for (const raw of rules) {
        const r = trimRule(raw);
        const allMatch = ORGANIZATION_INPUT_KEYS.every((key) => ruleFieldMatchesInput(r[key], input[key]));
        if (!allMatch) continue;
        return {
            matched: true,
            ruleId: raw.id,
            contractor: r.contractor,
            contractorRef: raw.contractorRef || null,
            operationPartner: r.operationPartner,
            operationPartnerRef: raw.operationPartnerRef || null
        };
    }
    return { matched: false };
}

// ============================================================================
// 그룹 관점 투영 — 출력 참조가 특정 조직 집합(그룹 id + 구성원 org_id)을 가리키는
// 활성 규칙을 조회한다. 내부조직역할 관리(DefinedRoleGroups)의 그룹별 라우팅 조건과
// 순서도 Lane 패널의 조회 전용 표시가 같은 기준을 공유하기 위한 공용 헬퍼.
// ============================================================================

export type OrganizationRuleProjection = {
    ruleId: string;
    role: string;
    domain: string;
    region: string;
    networkType: string;
    manufacturer: string;
    slot: 'contractor' | 'operationPartner';
    slotLabel: string;
    outputOrgId: string;
    outputOrgName: string;
};

export function projectOrganizationRulesForOrgIds(
    model: OrganizationDmnRuleModel | null | undefined,
    orgIds: Set<string>
): OrganizationRuleProjection[] {
    const projections: OrganizationRuleProjection[] = [];
    if (!model || !orgIds || orgIds.size === 0) return projections;
    for (const raw of model.rules || []) {
        if (!raw || raw.enabled === false) continue;
        const r = trimRule(raw);
        (['contractorRef', 'operationPartnerRef'] as const).forEach((refField) => {
            const ref = raw[refField];
            if (!ref || !ref.orgId || !orgIds.has(ref.orgId)) return;
            const slot = refField === 'contractorRef' ? 'contractor' : 'operationPartner';
            projections.push({
                ruleId: raw.id,
                role: r.role,
                domain: r.domain,
                region: r.region,
                networkType: r.networkType,
                manufacturer: r.manufacturer,
                slot,
                slotLabel: ORGANIZATION_DMN_OUTPUTS.find((o) => o.key === slot)?.label || slot,
                outputOrgId: ref.orgId,
                outputOrgName: ref.orgName || ref.orgId
            });
        });
    }
    return projections;
}

/** 투영된 규칙의 입력 조건 요약 (예: "역할=시공 · 망종류=5G"). 입력이 모두 비면 항상 매칭. */
export function formatOrganizationRuleInputs(projection: OrganizationRuleProjection): string {
    const parts = ORGANIZATION_DMN_INPUTS.map(({ key, label }) => {
        const value = String(projection[key] || '').trim();
        return value ? `${label}=${value}` : '';
    }).filter(Boolean);
    return parts.length ? parts.join(' · ') : '모든 요청에 매칭';
}

// ============================================================================
// 검증 — org-dmn-rule.contract §5 / research R5
// ============================================================================

export type OrgDmnValidationCode =
    | 'invalid-key'
    | 'duplicate-key'
    | 'incomplete-rule'
    | 'shadowed-rule'
    | 'dangling-ref'
    | 'unlinked-output'
    | 'match-all';

export type OrgDmnValidationIssue = {
    level: 'error' | 'warning';
    code: OrgDmnValidationCode;
    ruleId?: string;
    message: string;
};

export type OrgSnapshot = {
    orgIds: Set<string>;
    existingKeys?: Set<string>;
};

function ruleCoversLater(earlier: OrganizationRoutingRule, later: OrganizationRoutingRule) {
    // earlier가 later를 완전히 그림자 처리하는가?
    // 각 입력에 대해: earlier가 any(공백)이거나 (later 지정 && earlier==later)여야 함.
    const e = trimRule(earlier);
    const l = trimRule(later);
    return ORGANIZATION_INPUT_KEYS.every((key) => {
        const ev = String(e[key] || '');
        const lv = String(l[key] || '');
        if (!ev) return true; // earlier any → 커버
        if (!lv) return false; // later any인데 earlier 지정 → 커버 못함
        return ev === lv;
    });
}

export function validateOrganizationDmn(model: OrganizationDmnRuleModel, snapshot?: OrgSnapshot): OrgDmnValidationIssue[] {
    const issues: OrgDmnValidationIssue[] = [];
    const orgIds = snapshot?.orgIds || new Set<string>();
    const existingKeys = snapshot?.existingKeys;

    const key = String(model?.id || '').trim();
    if (!isValidOrganizationDmnKey(key)) {
        issues.push({ level: 'error', code: 'invalid-key', message: `DMN 키 형식이 올바르지 않습니다: "${key}"` });
    }
    if (existingKeys && existingKeys.has(key)) {
        issues.push({ level: 'error', code: 'duplicate-key', message: `이미 존재하는 DMN 키입니다: "${key}"` });
    }

    const rules = (model?.rules || []).filter((r) => r && r.enabled !== false);

    rules.forEach((raw) => {
        const r = trimRule(raw);
        if (!hasOrganizationRuleContent(raw)) return;

        // 불완전 규칙: 역할 없음 또는 출력 없음
        if (!r.role || (!r.contractor && !r.operationPartner)) {
            issues.push({
                level: 'error',
                code: 'incomplete-rule',
                ruleId: raw.id,
                message: `불완전한 규칙입니다(역할/출력 누락): ${organizationRuleIdentity(raw)}`
            });
        }

        // 모든 입력이 비어 있으면 전건 매칭 위험
        const allInputsEmpty = ORGANIZATION_INPUT_KEYS.every((k) => !String(r[k] || ''));
        if (allInputsEmpty) {
            issues.push({
                level: 'warning',
                code: 'match-all',
                ruleId: raw.id,
                message: `모든 입력이 비어 있어 모든 요청에 매칭됩니다(위험).`
            });
        }

        // 출력 참조 무결성
        (['contractorRef', 'operationPartnerRef'] as const).forEach((refField) => {
            const ref = raw[refField];
            const labelKey = refField === 'contractorRef' ? 'contractor' : 'operationPartner';
            const label = String(raw[labelKey] || '').trim();
            if (ref && ref.orgId) {
                if (orgIds.size > 0 && !orgIds.has(ref.orgId)) {
                    issues.push({
                        level: 'warning',
                        code: 'dangling-ref',
                        ruleId: raw.id,
                        message: `끊긴 참조: "${ref.orgName || ref.orgId}"(이)가 더 이상 존재하지 않습니다.`
                    });
                }
            } else if (label) {
                issues.push({
                    level: 'warning',
                    code: 'unlinked-output',
                    ruleId: raw.id,
                    message: `미연결 출력: "${label}"은(는) 사전정의 그룹/공급사와 연결되지 않았습니다.`
                });
            }
        });
    });

    // FIRST-hit 그림자 규칙: 선행 규칙이 후행 규칙을 완전히 커버하면 후행은 도달 불가
    for (let j = 0; j < rules.length; j++) {
        for (let i = 0; i < j; i++) {
            if (ruleCoversLater(rules[i], rules[j])) {
                issues.push({
                    level: 'warning',
                    code: 'shadowed-rule',
                    ruleId: rules[j].id,
                    message: `이 규칙은 선행 규칙(${organizationRuleIdentity(rules[i])})에 의해 FIRST-hit로 도달할 수 없습니다.`
                });
                break;
            }
        }
    }

    return issues;
}
