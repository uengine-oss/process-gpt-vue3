/**
 * definition-service 목록(listDefinition)과 정의 id(맵의 sub id 등)를 맞추기 위한 경로 정규화.
 * UEngineBackend.__normalizeRawResourcePath(bpmn)과 동일 규칙을 유지한다.
 */
export function normalizeBpmnStoragePath(defId: string): string {
    let p = String(defId || '')
        .trim()
        .replace(/^\/+/, '')
        .replace(/^definition\/raw\/?/i, '')
        .replace(/^definitions\//i, '');
    if (!p.toLowerCase().endsWith('.bpmn')) {
        p += '.bpmn';
    }
    if (!p.includes('/')) {
        p = 'default/' + p;
    }
    return p;
}

export function parentFolderOfDefPath(fullPath: string): string {
    const lastSlash = fullPath.lastIndexOf('/');
    return lastSlash > 0 ? fullPath.slice(0, lastSlash) : 'default';
}

function normPath(s: string): string {
    return String(s || '')
        .replace(/\\/g, '/')
        .replace(/^\//, '');
}

function pickFirstNonEmptyString(obj: Record<string, any> | null | undefined, keys: string[]): string | undefined {
    if (!obj) return undefined;
    for (const k of keys) {
        const v = obj[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return undefined;
}

/** listDefinition(폴더) 결과에서 해당 경로 행의 표시명·수정자·수정 시각 메타 */
export async function fetchDefinitionRowMeta(
    listDefinition: (basePath: string) => Promise<any[]>,
    defId: string
): Promise<{ name?: string; updatedByName?: string; updatedAt?: string } | null> {
    const fullPath = normalizeBpmnStoragePath(defId);
    const dir = parentFolderOfDefPath(fullPath);
    try {
        const list = await listDefinition(dir);
        if (!Array.isArray(list)) return null;
        const target = normPath(fullPath);
        const hit = list.find((it) => normPath(it.path || it.id || '') === target);
        if (!hit) return null;
        const updatedByName = pickFirstNonEmptyString(hit, [
            'updatedByName',
            'updated_by_name',
            'UPDATED_BY_NAME',
            'modifiedBy',
            'MODIFIED_BY'
        ]);
        const updatedAt = pickFirstNonEmptyString(hit, [
            'updatedAt',
            'updated_at',
            'UPDATED_AT',
            'modifiedAt',
            'modified_at',
            'lastModified',
            'timeStamp',
            'time_stamp',
            'TIME_STAMP'
        ]);
        const displayName =
            pickFirstNonEmptyString(hit, ['definitionName', 'displayName']) ||
            (typeof hit.name === 'string' ? hit.name : hit.name != null ? String(hit.name) : undefined);
        return {
            ...(displayName && { name: displayName }),
            ...(updatedByName && { updatedByName }),
            ...(updatedAt && { updatedAt })
        };
    } catch {
        return null;
    }
}

/** 정의체계도 표시명 ↔ TB_BPM_PROCDEF.name (PUT raw `name`) 동기화 */
export async function syncBpmnDefinitionDisplayName(
    backend: { getRawDefinition: (id: string, opts?: any) => Promise<any>; putRawDefinition: (xml: any, path: string, opts: any) => Promise<any> },
    defId: string,
    displayName: string
): Promise<{ ok: boolean; reason?: string }> {
    const name = String(displayName || '').trim();
    if (!defId || !name) return { ok: false, reason: 'empty' };
    try {
        const raw = await backend.getRawDefinition(defId, { type: 'bpmn' });
        const xml = typeof raw === 'string' ? raw : (raw?.bpmn ?? raw?.definition ?? '');
        if (!xml || typeof xml !== 'string' || !xml.trim()) {
            return { ok: false, reason: 'no_xml' };
        }
        await backend.putRawDefinition(xml, defId, { type: 'bpmn', name });
        return { ok: true };
    } catch (e: any) {
        return { ok: false, reason: e?.message || String(e) };
    }
}
