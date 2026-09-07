/**
 * 결정론적 코드와 파라미터 스펙(`mcp_python_code.parameters`) 사이의 규약.
 *
 * 코드는 도구 인자를 `${이름}` 템플릿으로 쓰고, 실행 런타임이 파라미터 스펙에서 만든
 * 값 묶음으로 그 자리를 채운다(`Template.substitute`). 그래서 **코드가 쓰는 이름과 스펙에
 * 적힌 이름은 같아야 한다** — 코드에만 있는 이름은 실행 때 KeyError 로 죽어 에이전트
 * 폴백으로 떨어지고, 스펙에만 있는 이름은 값을 뽑아 놓고 아무 데도 쓰지 않는다.
 *
 * 편집 화면이 이 대조를 보여 주기 위한 순수 함수들이다. 저장소 접근은 하지 않는다.
 */

export interface ParameterSpec {
    name?: string;
    type?: string;
    label?: string;
    example?: unknown;
    runtime?: string;
    upstream?: { activity_id?: string; path?: string[] };
    [key: string]: unknown;
}

export interface SpecCheck {
    /** 스펙이 저장 가능한 모양인가. false 면 message 에 사유가 담긴다. */
    valid: boolean;
    message: string;
    /** 코드에는 `${이름}` 으로 나오는데 스펙에 없는 이름 (실행 시 실패) */
    missing: string[];
    /** 스펙에 있는데 코드가 쓰지 않는 이름 (값만 뽑고 버려진다) */
    unused: string[];
}

/**
 * 코드가 템플릿으로 참조하는 이름들.
 *
 * Python `string.Template` 문법을 따른다 — `$$` 는 리터럴 `$` 라 먼저 걷어내야
 * `$${amount}` 같은 자리를 파라미터로 착각하지 않는다.
 */
export function referencedNames(code: string): string[] {
    if (!code) return [];
    const withoutEscapes = code.replace(/\$\$/g, '');
    const names = new Set<string>();
    const pattern = /\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(withoutEscapes)) !== null) {
        names.add(match[1] || match[2]);
    }
    return [...names];
}

/** 스펙에 선언된 파라미터 이름들. */
export function declaredNames(parameters: unknown): string[] {
    const list = (parameters as { parameters?: unknown } | null | undefined)?.parameters;
    if (!Array.isArray(list)) return [];
    return list.map((param: ParameterSpec) => String(param?.name || '')).filter(Boolean);
}

/**
 * 코드가 앞 도구의 결과를 이어받아 쓰는가.
 *
 * 이어받은 값(`linked`)은 실행 중에 코드가 스스로 채우므로 파라미터 스펙에 없는 것이
 * 정상이다. 그런 코드에서는 "스펙에 없는 이름" 을 오류로 볼 수 없다.
 * 생성 템플릿의 호출 모양(`render(tpl, inputs, linked_x)`)으로만 판별한다.
 */
function usesLinkedValues(code: string): boolean {
    return /,\s*inputs\s*,/.test(code || '');
}

/**
 * 파라미터 스펙 JSON 텍스트를 검사하고 코드와 대조한다.
 *
 * 비어 있는 스펙은 유효하다 — 입력을 받지 않는 코드가 실제로 있다(파라미터 없이 고정
 * 쿼리만 도는 활동). 그 경우 `parameters` 는 null 로 저장된다.
 */
export function checkParameterSpec(specText: string, code: string): SpecCheck {
    const empty: SpecCheck = { valid: true, message: '', missing: [], unused: [] };
    const trimmed = (specText || '').trim();
    if (!trimmed) return empty;

    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        return { valid: false, message: (e as Error)?.message || 'JSON 형식 오류', missing: [], unused: [] };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, message: '최상위는 { "parameters": [...] } 객체여야 합니다.', missing: [], unused: [] };
    }
    const list = (parsed as { parameters?: unknown }).parameters;
    if (!Array.isArray(list)) {
        return { valid: false, message: '"parameters" 는 배열이어야 합니다.', missing: [], unused: [] };
    }
    const nameless = list.findIndex((param: ParameterSpec) => !param || !param.name);
    if (nameless >= 0) {
        // 이름 없는 항목은 런타임이 조용히 건너뛴다(`if not name: continue`).
        // 값이 채워지지 않는 이유를 화면에서 찾을 수 없게 되므로 저장 전에 막는다.
        return { valid: false, message: `${nameless + 1}번째 파라미터에 name 이 없습니다.`, missing: [], unused: [] };
    }

    const declared = new Set(declaredNames(parsed));
    const referenced = referencedNames(code);
    return {
        valid: true,
        message: '',
        missing: usesLinkedValues(code) ? [] : referenced.filter((name) => !declared.has(name)),
        unused: [...declared].filter((name) => !referenced.includes(name))
    };
}
