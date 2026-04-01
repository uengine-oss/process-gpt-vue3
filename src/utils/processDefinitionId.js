function normalizeMode(mode) {
    return String(mode || '').trim().toLowerCase();
}

export function isUEngineMode(options = {}) {
    return normalizeMode(options.mode) === 'uengine';
}

export function isValidProcessDefinitionId(id, options = {}) {
    const value = String(id || '').trim();
    if (!value) return false;

    if (isUEngineMode(options)) {
        return /^[가-힣a-zA-Z0-9_][가-힣a-zA-Z0-9_\/-]*$/.test(value);
    }

    return /^[a-z][a-z0-9_]*$/.test(value);
}

export function getProcessDefinitionIdHint(options = {}) {
    if (isUEngineMode(options)) {
        return '한글, 영문, 숫자, 언더스코어(_), 슬래시(/), 대시(-)를 사용할 수 있습니다.';
    }

    return '영문 소문자, 숫자, 언더스코어(_)만 사용';
}

export function getInvalidProcessDefinitionIdMessage(options = {}) {
    if (isUEngineMode(options)) {
        return '한글/영문/숫자로 시작하고, 한글/영문/숫자/언더스코어(_)/슬래시(/)/대시(-)만 허용';
    }

    return '영문 소문자로 시작, 소문자/숫자/언더스코어만 허용';
}

export function normalizeGeneratedProcessDefinitionId(name, options = {}) {
    const value = String(name || '').trim();

    if (isUEngineMode(options)) {
        let id = value
            .replace(/\s+/g, '_')
            .replace(/[^가-힣a-zA-Z0-9_\/-]/g, '')
            .replace(/^[_\/-]+/, '')
            .replace(/_+/g, '_');

        if (!id) {
            id = `process_${Date.now().toString(36)}`;
        }

        return id;
    }

    let id = value
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^[0-9_]+/, '')
        .replace(/_+/g, '_')
        .replace(/_$/, '');

    if (!id) {
        id = 'process';
    }

    return id;
}
