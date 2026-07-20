/**
 * processComponentPackage.ts — "프로세스 컴포넌트" 표준 패키지(zip) 포맷 코어.
 *
 * 하나의 프로세스 + 그 프로세스가 참조하는 에이전트·스킬·폼·DMN 을 하나의 zip 으로
 * 묶고(build) / 풀고(parse) / 검증(validate)하는 순수 함수 모음. 백엔드·스토리지 호출은
 * 하지 않는다(그 오케스트레이션은 ProcessGPTBackend 의 export/import 메서드가 담당).
 *
 * 이 포맷은 마켓플레이스 등록/설치, 파일 내보내기/가져오기가 공통으로 사용하는 교환 단위다.
 *
 * zip 레이아웃:
 *   {componentId}-{version}.zip
 *   ├── manifest.json
 *   ├── process/process-definition.json   # sanitize된 proc_def.definition
 *   ├── process/process.bpmn              # BPMN XML (스냅샷)
 *   ├── forms/{formId}.json               # { id, activity_id, html, fields_json }
 *   ├── agents/agents.json                # 포터블 에이전트 스펙 배열
 *   ├── skills/{skill-name}/SKILL.md + …  # /skills/upload 가 그대로 받는 구조
 *   ├── dmn/{ruleId}.json                 # 참조 시에만
 *   └── assets/thumbnail.<ext>
 */

export const PACKAGE_SCHEMA_VERSION = 1;

/** 테넌트 종속 필드를 제거한 포터블 에이전트 스펙(테넌트 users 행이 아님). */
export interface PortableAgentSpec {
    /** 에이전트 표시 이름(users.username). */
    username: string;
    /** 정의 JSON roles[].name 과 매칭되는 포터블 바인딩 키. */
    role: string;
    alias?: string | null;
    goal?: string;
    persona?: string;
    model?: string | null;
    /** MCP 툴 이름 CSV. */
    tools?: string;
    skills?: string[];
    description?: string | null;
}

export interface ComponentManifest {
    schemaVersion: number;
    /** 원본 proc_def.id — 버전 간 안정적 식별자. */
    componentId: string;
    name: string;
    version: string;
    /** 어느 proc_def_version 에서 export 됐는지(재현성). */
    sourceArcvId?: string | null;
    versionTag?: string | null;
    description?: string;
    category?: { mega?: string; major?: string };
    tags?: string[];
    author?: { name?: string; uid?: string };
    createdAt?: string;
    contents: {
        process: string;
        bpmn?: string;
        forms: string[];
        agents?: string;
        skills: string[];
        dmn: string[];
        thumbnail?: string;
    };
    dependencies: {
        /** 패키지에 동봉된 스킬 이름. */
        skills: string[];
        /** 패키지에 담기지 않는 외부 의존(MCP 툴 등) — import 시 경고 표시용. */
        externalTools: string[];
    };
}

export interface PackageFormEntry {
    id: string;
    activity_id?: string;
    html?: string;
    fields_json?: any;
}

export interface PackageDmnEntry {
    id: string;
    content: any;
}

/** buildPackage 입력. skills 는 백엔드 export 엔드포인트에서 받은 per-skill zip(ArrayBuffer). */
export interface ComponentPackageInput {
    componentId: string;
    name: string;
    version: string;
    sourceArcvId?: string | null;
    versionTag?: string | null;
    description?: string;
    category?: { mega?: string; major?: string };
    tags?: string[];
    author?: { name?: string; uid?: string };
    createdAt?: string;
    definition: any;
    bpmn?: string | null;
    forms?: PackageFormEntry[];
    agents?: PortableAgentSpec[];
    skills?: Array<{ name: string; nestedZip: ArrayBuffer | Uint8Array }>;
    dmn?: PackageDmnEntry[];
    thumbnail?: { data: ArrayBuffer | Uint8Array | Blob; ext?: string } | null;
}

export interface ParsedSkill {
    name: string;
    /** SKILL.md 를 루트로 하는 per-skill zip(재압축 완료). /skills/upload 로 그대로 업로드 가능. */
    zipBlob: Blob;
    /** 검증/미리보기용 파일 경로 목록(스킬 폴더 기준 상대 경로). */
    files: string[];
    hasSkillMd: boolean;
}

export interface ParsedPackage {
    manifest: ComponentManifest;
    definition: any;
    bpmn: string | null;
    forms: PackageFormEntry[];
    agents: PortableAgentSpec[];
    skills: ParsedSkill[];
    dmn: PackageDmnEntry[];
    thumbnailBlob: Blob | null;
}

// ---------------------------------------------------------------------------
// Sanitize
// ---------------------------------------------------------------------------

const TENANT_KEYS = new Set(['tenant_id', 'tenantId', 'tenantName']);

/** 객체 트리에서 tenant 식별 키를 재귀적으로 제거한다(원본 비변형: 새 객체 반환). */
function stripTenantKeysDeep(value: any): any {
    if (Array.isArray(value)) {
        return value.map((v) => stripTenantKeysDeep(v));
    }
    if (value && typeof value === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(value)) {
            if (TENANT_KEYS.has(k)) continue;
            out[k] = stripTenantKeysDeep(v);
        }
        return out;
    }
    return value;
}

/** roles[] 배열에서 테넌트 유저 바인딩(default/endpoint)을 제거한다. */
function sanitizeRoles(roles: any[]): any[] {
    if (!Array.isArray(roles)) return roles;
    return roles.map((role) => {
        if (!role || typeof role !== 'object') return role;
        const next = { ...role };
        if ('default' in next) next.default = '';
        if ('endpoint' in next) next.endpoint = '';
        return next;
    });
}

/** activities[] 의 구체 에이전트 id/endpoint 를 제거하고 role/alias 참조만 남긴다. */
function sanitizeActivityAgents(activities: any[]): any[] {
    if (!Array.isArray(activities)) return activities;
    return activities.map((act) => {
        if (!act || typeof act !== 'object') return act;
        const next = { ...act };
        if (Array.isArray(next.agents)) {
            next.agents = next.agents.map((ag: any) => {
                if (!ag || typeof ag !== 'object') return ag;
                const { id, endpoint, tenant_id, tenantId, email, profile, ...rest } = ag;
                return rest;
            });
        }
        return next;
    });
}

/**
 * 프로세스 정의 JSON 을 export 용으로 sanitize 한다.
 * - roles[].default / endpoint 제거
 * - activities(및 subProcesses 하위) 의 구체 에이전트 id/endpoint 제거
 * - tenant_id 전부 제거
 * - processDefinitionId 를 componentId 로 정규화
 */
export function sanitizeDefinition(definition: any, componentId: string): any {
    if (!definition || typeof definition !== 'object') return definition;
    const def = stripTenantKeysDeep(definition);

    if (Array.isArray(def.roles)) def.roles = sanitizeRoles(def.roles);
    if (Array.isArray(def.activities)) def.activities = sanitizeActivityAgents(def.activities);

    if (Array.isArray(def.subProcesses)) {
        def.subProcesses = def.subProcesses.map((sp: any) => {
            if (sp && sp.children && Array.isArray(sp.children.activities)) {
                return {
                    ...sp,
                    children: { ...sp.children, activities: sanitizeActivityAgents(sp.children.activities) }
                };
            }
            return sp;
        });
    }

    if (componentId) def.processDefinitionId = componentId;
    return def;
}

// ---------------------------------------------------------------------------
// Reference collection
// ---------------------------------------------------------------------------

function toArray(v: any): string[] {
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    if (typeof v === 'string')
        return v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    return [];
}

function collectActivitiesDeep(definition: any): any[] {
    const acc: any[] = [];
    if (!definition || typeof definition !== 'object') return acc;
    if (Array.isArray(definition.activities)) acc.push(...definition.activities);
    if (Array.isArray(definition.elements)) acc.push(...definition.elements);
    if (Array.isArray(definition.subProcesses)) {
        for (const sp of definition.subProcesses) {
            if (sp && sp.children && Array.isArray(sp.children.activities)) {
                acc.push(...sp.children.activities);
            }
        }
    }
    return acc;
}

/** 정의 + 에이전트 스펙에서 참조하는 스킬 이름의 합집합을 반환한다. */
export function collectSkillNames(definition: any, agents?: PortableAgentSpec[]): string[] {
    const set = new Set<string>();
    for (const act of collectActivitiesDeep(definition)) {
        for (const s of toArray(act?.skills)) set.add(s);
    }
    for (const ag of agents || []) {
        for (const s of toArray(ag?.skills)) set.add(s);
    }
    return Array.from(set);
}

/** 정의의 roles[].name / activities 에서 참조하는 에이전트 바인딩 키(역할명/alias)를 반환한다. */
export function collectAgentRefs(definition: any): string[] {
    const set = new Set<string>();
    if (Array.isArray(definition?.roles)) {
        for (const role of definition.roles) {
            const name = role?.name || role?.role;
            if (name) set.add(String(name).trim());
        }
    }
    for (const act of collectActivitiesDeep(definition)) {
        const r = act?.role;
        if (r) set.add(String(r).trim());
    }
    return Array.from(set).filter(Boolean);
}

/** 패키지에 담기지 않는 외부 툴 이름(MCP 등)을 정의·에이전트에서 수집한다. */
export function collectExternalTools(definition: any, agents?: PortableAgentSpec[]): string[] {
    const set = new Set<string>();
    for (const act of collectActivitiesDeep(definition)) {
        for (const t of toArray(act?.tools)) set.add(t);
    }
    for (const ag of agents || []) {
        for (const t of toArray(ag?.tools)) set.add(t);
    }
    return Array.from(set);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function normalizeFileSegment(name: string): string {
    return String(name || '')
        .replace(/[\\/]+/g, '_')
        .replace(/\.\.+/g, '_');
}

async function toUint8(data: ArrayBuffer | Uint8Array | Blob): Promise<Uint8Array> {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    // Blob
    return new Uint8Array(await (data as Blob).arrayBuffer());
}

/**
 * 패키지 zip Blob 을 생성한다. definition 은 이미 sanitize 됐다고 가정하지 않고
 * 내부에서 sanitizeDefinition 을 한 번 더 적용한다(호출부가 잊어도 안전).
 */
export async function buildPackage(input: ComponentPackageInput): Promise<{ blob: Blob; manifest: ComponentManifest }> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const componentId = input.componentId;
    const sanitized = sanitizeDefinition(input.definition, componentId);

    // process/
    zip.file('process/process-definition.json', JSON.stringify(sanitized, null, 2));
    let bpmnPath: string | undefined;
    if (input.bpmn) {
        bpmnPath = 'process/process.bpmn';
        zip.file(bpmnPath, input.bpmn);
    }

    // forms/
    const formPaths: string[] = [];
    for (const form of input.forms || []) {
        const fid = normalizeFileSegment(form.id || form.activity_id || `form_${formPaths.length}`);
        const path = `forms/${fid}.json`;
        zip.file(
            path,
            JSON.stringify(
                { id: form.id, activity_id: form.activity_id, html: form.html ?? '', fields_json: form.fields_json ?? null },
                null,
                2
            )
        );
        formPaths.push(path);
    }

    // agents/
    let agentsPath: string | undefined;
    if (input.agents && input.agents.length > 0) {
        agentsPath = 'agents/agents.json';
        zip.file(agentsPath, JSON.stringify(input.agents, null, 2));
    }

    // skills/ — 백엔드에서 받은 per-skill zip 을 풀어 skills/{name}/… 로 재배치
    const skillNames: string[] = [];
    for (const skill of input.skills || []) {
        const name = normalizeFileSegment(skill.name);
        try {
            const inner = await JSZip.loadAsync(await toUint8(skill.nestedZip));
            const entries = Object.values(inner.files).filter((f: any) => !f.dir);
            for (const entry of entries as any[]) {
                const content = await entry.async('uint8array');
                zip.file(`skills/${name}/${entry.name}`, content);
            }
            skillNames.push(skill.name);
        } catch (e) {
            // 개별 스킬 압축 해제 실패는 건너뛴다(패키지 생성 자체는 계속).
            console.warn('[processComponentPackage] skill 압축 해제 실패:', skill.name, e);
        }
    }

    // dmn/
    const dmnPaths: string[] = [];
    for (const rule of input.dmn || []) {
        const rid = normalizeFileSegment(rule.id);
        const path = `dmn/${rid}.json`;
        zip.file(path, JSON.stringify(rule.content ?? null, null, 2));
        dmnPaths.push(path);
    }

    // assets/thumbnail
    let thumbnailPath: string | undefined;
    if (input.thumbnail && input.thumbnail.data) {
        const ext = (input.thumbnail.ext || 'png').replace(/^\./, '');
        thumbnailPath = `assets/thumbnail.${ext}`;
        zip.file(thumbnailPath, await toUint8(input.thumbnail.data));
    }

    const manifest: ComponentManifest = {
        schemaVersion: PACKAGE_SCHEMA_VERSION,
        componentId,
        name: input.name,
        version: input.version,
        sourceArcvId: input.sourceArcvId ?? null,
        versionTag: input.versionTag ?? null,
        description: input.description ?? '',
        category: input.category ?? {},
        tags: input.tags ?? [],
        author: input.author ?? {},
        createdAt: input.createdAt ?? new Date().toISOString(),
        contents: {
            process: 'process/process-definition.json',
            ...(bpmnPath ? { bpmn: bpmnPath } : {}),
            forms: formPaths,
            ...(agentsPath ? { agents: agentsPath } : {}),
            skills: skillNames,
            dmn: dmnPaths,
            ...(thumbnailPath ? { thumbnail: thumbnailPath } : {})
        },
        dependencies: {
            skills: skillNames,
            externalTools: collectExternalTools(sanitized, input.agents)
        }
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, manifest };
}

// ---------------------------------------------------------------------------
// Parse / Validate
// ---------------------------------------------------------------------------

export interface ManifestValidation {
    valid: boolean;
    errors: string[];
}

/** manifest 의 필수 구조를 검사한다. */
export function validateManifest(manifest: any): ManifestValidation {
    const errors: string[] = [];
    if (!manifest || typeof manifest !== 'object') {
        return { valid: false, errors: ['manifest.json 이 없거나 형식이 올바르지 않습니다.'] };
    }
    if (manifest.schemaVersion !== PACKAGE_SCHEMA_VERSION) {
        errors.push(`지원하지 않는 schemaVersion: ${manifest.schemaVersion} (기대값 ${PACKAGE_SCHEMA_VERSION})`);
    }
    if (!manifest.componentId) errors.push('manifest.componentId 가 없습니다.');
    if (!manifest.name) errors.push('manifest.name 이 없습니다.');
    if (!manifest.version) errors.push('manifest.version 이 없습니다.');
    if (!manifest.contents || !manifest.contents.process) errors.push('manifest.contents.process 경로가 없습니다.');
    return { valid: errors.length === 0, errors };
}

async function readJson(zip: any, path?: string): Promise<any> {
    if (!path) return null;
    const file = zip.file(path);
    if (!file) return null;
    const text = await file.async('string');
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(`패키지 내 JSON 파싱 실패: ${path}`);
    }
}

/** 패키지 zip 을 구조화된 파트로 파싱한다. 스킬은 업로드 가능한 per-skill zip 으로 재압축한다. */
export async function parsePackage(zipData: ArrayBuffer | Uint8Array | Blob): Promise<ParsedPackage> {
    const JSZip = (await import('jszip')).default;
    const data = await toUint8(zipData);
    const zip = await JSZip.loadAsync(data);

    const manifest = (await readJson(zip, 'manifest.json')) as ComponentManifest;
    const v = validateManifest(manifest);
    if (!v.valid) {
        throw new Error('유효하지 않은 패키지: ' + v.errors.join(' / '));
    }

    const definition = await readJson(zip, manifest.contents.process);
    if (!definition) throw new Error('패키지에 process-definition.json 이 없습니다.');

    let bpmn: string | null = null;
    if (manifest.contents.bpmn && zip.file(manifest.contents.bpmn)) {
        bpmn = await zip.file(manifest.contents.bpmn)!.async('string');
    }

    const forms: PackageFormEntry[] = [];
    for (const fp of manifest.contents.forms || []) {
        const f = await readJson(zip, fp);
        if (f) forms.push(f);
    }

    const agents: PortableAgentSpec[] = (await readJson(zip, manifest.contents.agents)) || [];

    const dmn: PackageDmnEntry[] = [];
    for (const dp of manifest.contents.dmn || []) {
        const rid = dp.replace(/^dmn\//, '').replace(/\.json$/, '');
        const content = await readJson(zip, dp);
        dmn.push({ id: rid, content });
    }

    // skills: skills/{name}/… 를 이름별로 묶어 per-skill zip 으로 재압축(SKILL.md 를 name 폴더 아래 유지)
    const skillGroups: Record<string, Array<{ rel: string; entry: any }>> = {};
    zip.forEach((relativePath: string, file: any) => {
        if (file.dir) return;
        const m = relativePath.match(/^skills\/([^/]+)\/(.+)$/);
        if (!m) return;
        const name = m[1];
        const rel = m[2];
        (skillGroups[name] = skillGroups[name] || []).push({ rel, entry: file });
    });

    const skills: ParsedSkill[] = [];
    for (const [name, group] of Object.entries(skillGroups)) {
        const outZip = new JSZip();
        const files: string[] = [];
        let hasSkillMd = false;
        for (const { rel, entry } of group) {
            const content = await entry.async('uint8array');
            // /skills/upload 가 폴더명에서 스킬 이름을 복원할 수 있게 {name}/ 프리픽스를 유지한다.
            outZip.file(`${name}/${rel}`, content);
            files.push(rel);
            if (rel === 'SKILL.md' || /(^|\/)SKILL\.md$/i.test(rel)) hasSkillMd = true;
        }
        const zipBlob = await outZip.generateAsync({ type: 'blob' });
        skills.push({ name, zipBlob, files, hasSkillMd });
    }

    let thumbnailBlob: Blob | null = null;
    if (manifest.contents.thumbnail && zip.file(manifest.contents.thumbnail)) {
        thumbnailBlob = await zip.file(manifest.contents.thumbnail)!.async('blob');
    }

    return { manifest, definition, bpmn, forms, agents, skills, dmn, thumbnailBlob };
}

export interface ImportPreview {
    manifest: ComponentManifest;
    formCount: number;
    agentCount: number;
    skillCount: number;
    skillsMissingSkillMd: string[];
    externalTools: string[];
}

/** 파싱된 패키지로부터 설치 전 미리보기 요약을 만든다. */
export function buildImportPreview(parsed: ParsedPackage): ImportPreview {
    return {
        manifest: parsed.manifest,
        formCount: parsed.forms.length,
        agentCount: parsed.agents.length,
        skillCount: parsed.skills.length,
        skillsMissingSkillMd: parsed.skills.filter((s) => !s.hasSkillMd).map((s) => s.name),
        externalTools: parsed.manifest.dependencies?.externalTools || []
    };
}
