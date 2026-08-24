import StorageBaseFactory from './StorageBaseFactory';

// PI Flag 유형 카탈로그는 configuration 테이블(key: 'pi_flag_types')에 tenant 단위로 저장한다.
// 과거 localStorage(pi_flag_type_master) 데이터는 서버에 데이터가 없을 때 1회 이전 후 제거한다.
const storage = StorageBaseFactory.getStorage();
const CONFIG_KEY = 'pi_flag_types';
const LEGACY_STORAGE_KEY = 'pi_flag_type_master';
const CHANGE_EVENT = 'pi-flag-types-changed';

export const PI_FLAG_TYPES_CHANGE_EVENT = CHANGE_EVENT;

const DEFAULT_PI_FLAG_TYPES = [
    { code: 'PROCESS_REMOVE', label: '불필요 프로세스 삭제', description: '', sortOrder: 0, active: true },
    { code: 'TASK_INTEGRATION', label: '업무 통합', description: '', sortOrder: 1, active: true },
    { code: 'MANUAL_WORK', label: '수작업 과다', description: '', sortOrder: 2, active: true },
    { code: 'SYSTEM_LIMIT', label: '시스템 한계', description: '', sortOrder: 3, active: true }
];

function normalizeItem(it) {
    return {
        code: String(it?.code || ''),
        label: String(it?.label || ''),
        description: String(it?.description || ''),
        sortOrder: Number(it?.sortOrder ?? 0),
        active: it?.active !== false,
        deletedAt: it?.deletedAt || null,
        deletedBy: it?.deletedBy || null
    };
}

function readLegacyLocalStorage() {
    try {
        const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

async function readServerList() {
    const value = await storage.getString('configuration', {
        match: { key: CONFIG_KEY },
        column: 'value'
    });
    return Array.isArray(value) ? value : null;
}

async function writeServerList(list) {
    await storage.putObject(
        'configuration',
        { key: CONFIG_KEY, value: list, tenant_id: window.$tenantName },
        { onConflict: 'key,tenant_id' }
    );
}

async function loadAllRaw() {
    let list = await readServerList();
    if (list === null) {
        const legacy = readLegacyLocalStorage();
        if (legacy) {
            try {
                // configuration 쓰기는 admin+ 전용(RLS)이라 일반 사용자는 실패할 수 있음
                // → 실패 시 로컬 데이터로 표시만 하고 localStorage를 남겨 다음 기회에 재시도
                await writeServerList(legacy);
                window.localStorage.removeItem(LEGACY_STORAGE_KEY);
            } catch (e) {
                console.warn('[piFlagTypes] localStorage → 서버 마이그레이션 실패:', e);
            }
            list = legacy;
        }
    }
    if (list === null) {
        list = DEFAULT_PI_FLAG_TYPES.map((t) => ({ ...t, deletedAt: null, deletedBy: null }));
    }
    return list.map(normalizeItem).filter((it) => it.code);
}

export async function loadPiFlagTypes() {
    return (await loadAllRaw()).filter((it) => !it.deletedAt);
}

export async function loadDeletedPiFlagTypes() {
    return (await loadAllRaw()).filter((it) => !!it.deletedAt);
}

export async function savePiFlagTypes(activeList) {
    // activeList는 활성 항목만 들어옴; 휴지통 항목은 보존
    const trashed = (await loadAllRaw()).filter((it) => !!it.deletedAt);
    const normalized = (activeList || [])
        .map(normalizeItem)
        .filter((it) => it.code)
        .map((it) => ({ ...it, deletedAt: null, deletedBy: null }));
    await writeServerList([...normalized, ...trashed]);
    notifyChange();
}

export async function softDeletePiFlagType(code, deletedBy = '') {
    const all = await loadAllRaw();
    const idx = all.findIndex((it) => it.code === code && !it.deletedAt);
    if (idx === -1) return false;
    all[idx] = { ...all[idx], deletedAt: new Date().toISOString(), deletedBy: deletedBy || null };
    await writeServerList(all);
    notifyChange();
    return true;
}

export async function restorePiFlagType(code) {
    const all = await loadAllRaw();
    const idx = all.findIndex((it) => it.code === code && !!it.deletedAt);
    if (idx === -1) return false;
    if (all.some((it) => it.code === code && !it.deletedAt)) {
        throw new Error('동일한 키의 활성 유형이 이미 존재합니다.');
    }
    all[idx] = { ...all[idx], deletedAt: null, deletedBy: null };
    await writeServerList(all);
    notifyChange();
    return true;
}

export async function hardDeletePiFlagType(code) {
    const all = await loadAllRaw();
    const next = all.filter((it) => !(it.code === code && !!it.deletedAt));
    if (next.length === all.length) return false;
    await writeServerList(next);
    notifyChange();
    return true;
}

export async function getActivePiFlagTypeLabels() {
    return (await loadPiFlagTypes())
        .filter((t) => t.active)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.label).localeCompare(String(b.label), 'ko'))
        .map((t) => t.label);
}

export function notifyChange() {
    try {
        window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {}
}
