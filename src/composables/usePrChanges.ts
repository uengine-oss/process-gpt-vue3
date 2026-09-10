import { computeBpmnDiff, type BpmnChange } from '@/utils/bpmnDiff';
import { t } from '@/composables/i18nText';
import { parseDmnXml, diffDmn } from '@/utils/dmnParser';

/** 스킬 병합 요청의 변경 파일 한 건. (깃 PR files API 응답 형태) */
export interface PrFileChange {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
}

/** 프로세스·의사결정 병합 요청의 변경 항목 한 건. */
export interface PrChangeItem {
    kind: 'added' | 'modified' | 'removed';
    /** 바뀐 대상의 사람이 읽는 이름 (태스크명·Decision 명 등) */
    name: string;
    /** 대상의 종류를 가리키는 번역 키 조각. 'task', 'gateway', 'decision' … */
    category: string;
    /** 무엇이 어떻게 바뀌었는지 한 줄. 없으면 빈 문자열. */
    detail: string;
    /** 요약 비교에서 좌우 두 칸으로 세울 값 짝. 없으면 비어 있다. */
    fields?: { label: string; before: string; after: string }[];
    /** 연결선이면 어디서 어디로 가는지. */
    flow?: { from: string; to: string };
}

/** 상세 비교가 쓸 원본 두 벌. 목록 요약을 채울 때는 담지 않는다. */
export interface PrSnapshots {
    baseXml: string;
    headXml: string;
    /** BPMN 다이어그램에 칠할 하이라이트 맵 (요소 id → added|modified|deleted) */
    diffActivitiesBase: Record<string, string>;
    diffActivitiesHead: Record<string, string>;
}

export interface PrChanges {
    /** 'files' = 스킬(깃 패치), 'items' = 프로세스·의사결정(구조 비교) */
    shape: 'files' | 'items';
    files: PrFileChange[];
    items: PrChangeItem[];
    /**
     * 변경 전/후 정의 원본. 상세 비교(다이어그램·규칙표)가 쓴다.
     * 목록 카드용 요약을 채울 때는 요청 수만큼 XML 을 들고 있게 되므로 비워 둔다.
     */
    snapshots?: PrSnapshots;
    /** 상세에 놓는 요약. 바뀐 것을 종류별로 모두 부른다. */
    summary: string;
    /** 목록 카드에 놓는 요약. 좁은 카드에서 한 줄로 읽히도록 가장 큰 변경만 부른다. */
    shortSummary: string;
    /**
     * 변경 내역을 계산하지 못한 이유. 비어 있으면 정상이다.
     * 침묵하면 "바뀐 게 없다" 로 읽히므로, 못 보여줄 때는 이유를 반드시 남긴다.
     */
    unavailable: string;
}

const EMPTY: PrChanges = { shape: 'items', files: [], items: [], summary: '', shortSummary: '', unavailable: '' };

/** 상세에서만 원본을 싣는다. 목록은 요약 한 줄이면 충분하고, 그만큼 메모리도 아낀다. */
export interface LoadPrChangesOptions {
    withSnapshots?: boolean;
}

/** 프로세스·의사결정의 브랜치 이름은 `v4.0-abc` 처럼 버전 앞에 v 가 붙는다. */
function stripVersionPrefix(branch: string | null | undefined): string {
    return String(branch || '').replace(/^v/i, '');
}

/** BPMN 요소 종류 → 번역 키. 화면에 나가는 말은 모두 로케일 파일이 갖는다. */
const BPMN_CATEGORY: Record<string, string> = {
    task: 'task',
    userTask: 'task',
    serviceTask: 'task',
    manualTask: 'task',
    scriptTask: 'task',
    sendTask: 'task',
    receiveTask: 'task',
    businessRuleTask: 'task',
    callActivity: 'subProcess',
    subProcess: 'subProcess',
    startEvent: 'event',
    endEvent: 'event',
    intermediateThrowEvent: 'event',
    intermediateCatchEvent: 'event',
    boundaryEvent: 'event',
    exclusiveGateway: 'gateway',
    parallelGateway: 'gateway',
    inclusiveGateway: 'gateway',
    eventBasedGateway: 'gateway',
    complexGateway: 'gateway',
    sequenceFlow: 'flow',
    lane: 'lane',
    laneSet: 'lane',
    participant: 'pool',
    dataObject: 'data',
    dataObjectReference: 'data',
    dataStoreReference: 'data'
};

/** 요소 종류·동작을 지금 언어의 말로. */
function categoryLabel(category: string): string {
    return t(`pr.changes.category.${category}`);
}

function kindLabel(kind: PrChangeItem['kind']): string {
    return t(`pr.changes.kind.${kind}`);
}

/** 화면에서 부르는 속성 이름. 모르는 키는 키 그대로 — 지어내는 것보다 낫다. */
const KNOWN_ATTRS = [
    'name',
    'description',
    'instruction',
    'role',
    'lane',
    'condition',
    'connection',
    'checkpoints',
    'inputData',
    'outputData',
    'inputMapping',
    'outputMapping',
    'duration',
    'tool',
    'agent'
];

function attrLabel(key: string): string {
    if (!key) return '';
    return KNOWN_ATTRS.includes(key) ? t(`pr.changes.attr.${key}`) : key;
}

function bpmnCategory(elementType: string | undefined): string {
    return BPMN_CATEGORY[elementType || ''] || 'element';
}

const KIND_ORDER: PrChangeItem['kind'][] = ['added', 'modified', 'removed'];

/**
 * 요약에서 먼저 부를 대상의 순서.
 * 개수로 줄을 세우면 이름 없는 연결선이 늘 앞을 차지하고, 정작 업무가 어떻게
 * 달라지는지를 말해 주는 태스크·게이트웨이가 "외 N개" 뒤로 숨는다.
 */
const CATEGORY_RANK: string[] = ['task', 'subProcess', 'gateway', 'decision', 'event', 'lane', 'input', 'data', 'pool', 'element', 'flow'];

function categoryRank(category: string): number {
    const index = CATEGORY_RANK.indexOf(category);
    return index === -1 ? CATEGORY_RANK.length : index;
}

/**
 * 사람이 붙인 이름인가, 내부 id 인가. id 를 인용해 봐야 무엇이 바뀌었는지 알 수 없다.
 * 연결선 id 는 `sequence_기존_이전_활동_민원접수_act_precheck_legal` 처럼 한글이 섞여 있어서
 * 글자만 봐서는 갈리지 않는다 — 띄어쓰기 없이 밑줄로 이어 붙인 꼴을 id 로 본다.
 */
function hasHumanName(name: string): boolean {
    const text = (name || '').trim();
    if (!/[가-힣]/.test(text)) return false;
    if (!/\s/.test(text) && /[_]/.test(text)) return false;
    return true;
}

/** (동작, 종류) 묶음 하나를 "'무엇' 등 종류 N개 동작" 으로 옮긴다. */
function phraseGroup(kind: PrChangeItem['kind'], category: string, members: PrChangeItem[]): string {
    const label = categoryLabel(category);
    const verb = kindLabel(kind);
    const named = members.find((item) => hasHumanName(item.name));
    if (!named) return t('pr.changes.phrase.group', { category: label, count: members.length, kind: verb });
    const name = truncate(named.name, 22);
    // 하나뿐이면 "등" 을 붙일 나머지가 없다.
    if (members.length === 1) return t('pr.changes.phrase.groupOneNamed', { name, category: label, kind: verb });
    return t('pr.changes.phrase.groupManyNamed', { name, category: label, count: members.length, kind: verb });
}

/**
 * 무엇이 바뀌었는지를 한 줄로 옮긴다.
 * 개수만 세면 "태스크 3개 추가" 가 되어 정작 어떤 업무 단계가 늘었는지가 빠지므로,
 * 묶음마다 실제 이름을 하나씩 대표로 불러 준다.
 * (예: "'관할성/법령 사전 검토' 등 태스크 3개 추가 · 게이트웨이 1개 추가")
 */
function summarizeItems(items: PrChangeItem[], maxGroups = 3): string {
    if (!items.length) return '';

    const groups = new Map<string, { kind: PrChangeItem['kind']; category: string; members: PrChangeItem[] }>();
    for (const item of items) {
        const key = `${item.kind}|${item.category}`;
        const group = groups.get(key) || { kind: item.kind, category: item.category, members: [] };
        group.members.push(item);
        groups.set(key, group);
    }

    const ranked = [...groups.values()].sort(
        (a, b) =>
            KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
            categoryRank(a.category) - categoryRank(b.category) ||
            b.members.length - a.members.length
    );

    const kept = ranked.slice(0, maxGroups);
    const phrases = kept.map((group) => phraseGroup(group.kind, group.category, group.members));
    const hidden = ranked.slice(maxGroups).reduce((sum, group) => sum + group.members.length, 0);
    // 접어 둔 나머지는 별개 항목이 아니라 앞 구절의 꼬리다. `· 외 3건` 으로 떨어뜨리면
    // 마치 또 다른 종류의 변경인 것처럼 읽힌다.
    if (hidden) phrases[phrases.length - 1] += t('pr.changes.phrase.hiddenTail', { count: hidden });

    return phrases.join(' · ');
}

/**
 * 목록 카드용 한 줄. 가장 눈여겨볼 묶음 하나만 부르고 나머지는 건수로 접는다.
 * 카드 폭이 340px 라 묶음을 다 늘어놓으면 세 줄로 번지고, 그러면 훑어볼 수가 없다.
 * (예: "'민원 접수' 등 태스크 8개 변경 외 22건")
 */
function shortSummarizeItems(items: PrChangeItem[]): string {
    return summarizeItems(items, 1);
}

/**
 * 이름 있는 요소를 먼저 보여 준다.
 * 연결선은 대개 이름이 없어 내부 id 로 표시되는데, 그게 목록 맨 위를 차지하면
 * 정작 어떤 업무 단계가 늘고 줄었는지가 스크롤 아래로 밀려난다.
 */
function orderItems(items: PrChangeItem[]): PrChangeItem[] {
    return [...items].sort(
        (a, b) => categoryRank(a.category) - categoryRank(b.category) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    );
}

/** 패치에서 건져 올린 한 줄. */
interface PatchLine {
    /** 마크다운 장식과 목록 기호를 걷어낸 본문. */
    text: string;
    /** 이 줄이 속한 문단 제목. 못 찾으면 빈 문자열. */
    section: string;
}

/** 내용이 없는 줄. 인용해 봐야 아무것도 알려주지 못한다. */
function isNoiseLine(text: string): boolean {
    if (!text) return true;
    if (/^[-=_*\s]+$/.test(text)) return true; // 구분선
    if (/^\|[\s|:-]*\|?$/.test(text)) return true; // 표 구분행
    if (/^[[\]{},]+$/.test(text)) return true; // JSON 뼈대
    return text.replace(/[^0-9A-Za-z가-힣]/g, '').length < 2;
}

/** 인용할 수 있게 목록 기호·강조·따옴표를 정리한다. */
function cleanLine(raw: string): string {
    let text = raw.trim();
    text = text.replace(/^[-*+]\s+/, '').replace(/^\d+[.)]\s+/, '');
    text = text.replace(/^#{1,6}\s+/, '');
    text = text.replace(/\*\*|__|`/g, '');
    text = text.replace(/^["'\u201c\u2018]+|["',\u201d\u2019]+$/g, '');
    return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, limit: number): string {
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

/**
 * 통합 패치를 훑어 추가·삭제된 본문 줄을 모은다.
 * 문맥 줄에 나오는 제목(`## …`)을 따라가며 각 줄이 어느 문단에서 바뀌었는지도 같이 남긴다 —
 * "무엇이 바뀌었나" 는 대개 "어디가 바뀌었나" 와 함께여야 뜻이 통한다.
 */
function readPatch(patch: string): { added: PatchLine[]; removed: PatchLine[] } {
    const added: PatchLine[] = [];
    const removed: PatchLine[] = [];
    let section = '';

    for (const line of (patch || '').split('\n')) {
        if (line.startsWith('@@')) {
            section = '';
            continue;
        }
        if (line.startsWith('+++') || line.startsWith('---')) continue;

        const marker = line[0];
        const body = line.slice(1);
        const heading = body.trim().match(/^#{1,6}\s+(.+)$/);

        if (marker === ' ') {
            if (heading) section = cleanLine(heading[1]);
            continue;
        }
        if (marker !== '+' && marker !== '-') continue;

        const text = cleanLine(body);
        if (isNoiseLine(text)) {
            if (marker === '+' && heading) section = text;
            continue;
        }
        (marker === '+' ? added : removed).push({ text, section });
        if (marker === '+' && heading) section = text;
    }

    return { added, removed };
}

/** 파일 경로를 검토자가 쓰는 말로 바꾼다. 경로는 파일 위치일 뿐 내용이 아니다. */
function fileLabel(filename: string): string {
    if (/^SKILL\.md$/i.test(filename)) return t('pr.changes.file.skillBody');
    if (/(^|\/)evals?\//i.test(filename) || /evals?\.json$/i.test(filename)) return t('pr.changes.file.evals');
    if (/(^|\/)references?\//i.test(filename)) return t('pr.changes.file.references');
    return filename;
}

/** 이만큼 손댔으면 한 줄 인용으로는 오해를 부른다. 통째로 다시 썼다고 말하는 편이 정직하다. */
const REWRITE_THRESHOLD = 50;

/**
 * 파일 한 건이 무엇을 바꾸는지 한 조각으로 옮긴다.
 * 줄 수가 아니라 바뀐 문장 자체를 말하는 것이 목적이다.
 */
function describeFile(file: PrFileChange): string {
    const label = fileLabel(file.filename);
    const { added, removed } = readPatch(file.patch || '');

    if (file.status === 'added') {
        // 새 문서는 제목이 곧 내용 요약이다.
        const title = added.find((line) => line.section && line.section === line.text)?.text || added[0]?.text;
        return title ? t('pr.changes.phrase.docAdded', { title: truncate(title, 34) }) : t('pr.changes.phrase.fileAdded', { label });
    }
    if (file.status === 'removed') return t('pr.changes.phrase.fileRemoved', { label });

    const touched = (file.additions || 0) + (file.deletions || 0);
    if (touched >= REWRITE_THRESHOLD) return t('pr.changes.phrase.fileRewritten', { label });

    // 스킬 설명(description)은 언제 이 스킬이 불릴지를 정하는 문장이라 따로 짚어 준다.
    const isDescription = (line: PatchLine) => /^description\s*:/i.test(line.text);
    if (added.some(isDescription) || removed.some(isDescription)) {
        const rest = added.filter((line) => !isDescription(line));
        return rest.length ? t('pr.changes.phrase.descriptionWithRest', { count: rest.length }) : t('pr.changes.phrase.descriptionOnly');
    }

    const quoted = added[0] || removed[0];
    if (!quoted) return t('pr.changes.phrase.fileChanged', { label });

    const verb = kindLabel(added.length ? 'added' : 'removed');
    const rest = (added.length || removed.length) - 1;
    const where = quoted.section ? t('pr.changes.phrase.quotedWhere', { section: truncate(quoted.section, 16) }) : '';
    const tail = rest > 0 ? t('pr.changes.phrase.quotedTail', { count: rest }) : '';
    return t('pr.changes.phrase.quoted', { where, quote: truncate(quoted.text, 40), tail, verb });
}

/**
 * 스킬 병합 요청이 실제로 무엇을 바꾸는지 옮긴다.
 * `SKILL.md +1` 같은 깃 표기는 통계지 요약이 아니다 — 검토자가 알고 싶은 것은
 * 어떤 문장이 늘고 줄었는지, 어떤 문서가 새로 생겼는지다.
 */
function summarizeFiles(files: PrFileChange[], maxChars = Infinity): string {
    if (!files.length) return '';

    const removedFiles = files.filter((file) => file.status === 'removed');
    const rest = files.filter((file) => file.status !== 'removed');

    // 내용이 실린 파일부터 말한다. 삭제는 건수로 묶어 뒤에 붙인다.
    const ranked = [...rest].sort((a, b) => (b.additions || 0) + (b.deletions || 0) - ((a.additions || 0) + (a.deletions || 0)));

    const notes = ranked.map(describeFile);
    if (removedFiles.length) {
        notes.push(
            removedFiles.length === 1 ? describeFile(removedFiles[0]) : t('pr.changes.phrase.filesRemoved', { count: removedFiles.length })
        );
    }

    // 카드에 놓을 때는 길이로 자른다. 개수로 자르면 "새 문서가 생겼다" 처럼
    // 정작 알아야 할 조각이 "파일 1개 변경" 같은 맹탕에 밀려난다.
    const kept: string[] = [];
    let width = 0;
    for (const note of notes) {
        const next = width + note.length + (kept.length ? 3 : 0);
        if (kept.length && next > maxChars) break;
        kept.push(note);
        width = next;
    }
    const hidden = notes.length - kept.length;
    if (hidden > 0) kept.push(t('pr.changes.phrase.moreItems', { count: hidden }));

    return kept.join(' · ');
}

function toBpmnItems(changes: BpmnChange[]): PrChangeItem[] {
    return changes.map((change) => {
        const category = bpmnCategory(change.elementType);
        let detail = '';
        if (change.type === 'modified') {
            // `Extension fields added: json.description` 같은 개발자 문장은 화면에 내보내지 않는다.
            // 무엇이 바뀌었는지는 속성 이름으로 말한다 — "설명 · 담당 역할 변경".
            const labels = (change.changedKeys || []).map(attrLabel).filter(Boolean);
            detail = labels.length
                ? t('pr.changes.phrase.attrsChanged', { attrs: labels.slice(0, 4).join(' · ') })
                : t('pr.changes.phrase.propertyChanged');
        }
        return {
            kind: change.type,
            // 이름 없는 연결선은 id 대신 "'민원접수' → '사전검토'" 로 부른다 —
            // id 는 무엇이 이어졌는지 말해 주지 않는다.
            name: change.name || (change.flow ? `${change.flow.from} → ${change.flow.to}` : change.id),
            category,
            detail,
            fields: change.fields || [],
            flow: change.flow
        };
    });
}

function toDmnItems(previous: any, current: any): PrChangeItem[] {
    const diff = diffDmn(previous, current);
    const items: PrChangeItem[] = [];

    for (const change of diff.inputChanges || []) {
        const target = change.current || change.previous || {};
        items.push({
            kind: change.type as PrChangeItem['kind'],
            name: target.name || change.key,
            category: 'input',
            detail: ''
        });
    }

    for (const change of diff.decisionChanges || []) {
        const target = change.current || change.previous || {};
        const parts: string[] = [];
        const summary = change.tableDiff?.summary;
        if (summary) {
            if (summary.addedRules) parts.push(t('pr.changes.phrase.rulesAdded', { count: summary.addedRules }));
            if (summary.modifiedRules) parts.push(t('pr.changes.phrase.rulesModified', { count: summary.modifiedRules }));
            if (summary.removedRules) parts.push(t('pr.changes.phrase.rulesRemoved', { count: summary.removedRules }));
        }
        const previousName = change.previous?.name;
        const currentName = change.current?.name;
        if (change.type === 'modified' && previousName && currentName && previousName !== currentName) {
            parts.push(t('pr.changes.phrase.renamed', { before: previousName, after: currentName }));
        }
        items.push({
            kind: change.type as PrChangeItem['kind'],
            name: target.name || change.key,
            category: 'decision',
            detail: parts.join(', '),
            fields:
                change.type === 'modified' && previousName && currentName && previousName !== currentName
                    ? [{ label: t('pr.changes.fieldLabel.name'), before: previousName, after: currentName }]
                    : []
        });
    }

    return items;
}

/**
 * 프로세스·의사결정 병합 요청이 비교해야 할 두 스냅샷을 찾는다.
 *
 * 비교 기준은 base_branch 가 아니라 이 버전이 갈라져 나온 parent_version 이다.
 * 피드백이 자동으로 올리는 요청은 base_branch 에 "다음 메이저"(예: v5.0)를 적어 두는데,
 * 그 버전은 아직 만들어지지 않았으므로 base_branch 로 찾으면 늘 빈손이 된다.
 */
async function loadDefinitionSnapshots(
    backend: any,
    resourceId: string,
    branchName: string,
    baseBranch: string,
    versionCache?: Map<string, Promise<any[]>>
): Promise<{ headXml: string; baseXml: string } | null> {
    // 목록에는 같은 프로세스를 고친 요청이 여러 건 섞여 있다. 같은 정의의 버전 목록을
    // 요청마다 다시 받아 오면 카드 수만큼 왕복이 생기므로 한 번만 받아 나눠 쓴다.
    let pending = versionCache?.get(resourceId);
    if (!pending) {
        pending = Promise.resolve(backend.getDefinitionVersions(resourceId, { orderBy: 'timeStamp', sort: 'desc' }));
        versionCache?.set(resourceId, pending);
    }
    const rows = await pending;
    const versions: any[] = Array.isArray(rows) ? rows : [];
    if (!versions.length) return null;

    const byVersion = new Map<string, any>(versions.map((row) => [String(row.version), row]));
    const headVersion = stripVersionPrefix(branchName);
    const head = byVersion.get(headVersion);
    if (!head) return null;

    // 초안 버전은 `<부모버전>-<난수>` 로 만들어지는데 parent_version 이 비어 있는 행이 많다.
    // 그럴 때는 버전 이름 자체가 부모를 알려 주므로 앞자리를 떼어 되짚는다.
    const derivedParent = headVersion.includes('-') ? headVersion.split('-')[0] : '';
    const base =
        byVersion.get(String(head.parent_version || '')) || byVersion.get(derivedParent) || byVersion.get(stripVersionPrefix(baseBranch));
    return { headXml: head.snapshot || '', baseXml: base?.snapshot || '' };
}

/**
 * 병합 요청 한 건의 변경 내역을 리소스 종류에 맞는 방식으로 계산한다.
 * 스킬은 깃 패치를, 프로세스·의사결정은 두 버전 스냅샷의 구조 비교를 쓴다.
 */
export async function loadPrChanges(
    backend: any,
    pr: any,
    versionCache?: Map<string, Promise<any[]>>,
    options: LoadPrChangesOptions = {}
): Promise<PrChanges> {
    if (!pr) return { ...EMPTY };
    const resourceType = pr.resource_type || 'skill';

    if (resourceType === 'skill') {
        if (!pr.git_pr_number || !pr.resource_id) {
            return { ...EMPTY, shape: 'files', unavailable: t('pr.changes.unavailable.notInGit') };
        }
        const files: PrFileChange[] = (await backend.getSkillPrFiles(pr.resource_id, pr.git_pr_number)) || [];
        return {
            shape: 'files',
            files,
            items: [],
            summary: summarizeFiles(files),
            // 카드는 340px 라 가장 크게 바뀐 파일 하나만 말한다.
            shortSummary: summarizeFiles(files, 60),
            unavailable: files.length ? '' : t('pr.changes.unavailable.noFiles')
        };
    }

    const snapshots = await loadDefinitionSnapshots(backend, pr.resource_id, pr.branch_name, pr.base_branch, versionCache);
    if (!snapshots) {
        return { ...EMPTY, unavailable: t('pr.changes.unavailable.noVersion') };
    }
    if (!snapshots.headXml) {
        return { ...EMPTY, unavailable: t('pr.changes.unavailable.emptySnapshot') };
    }
    if (!snapshots.baseXml) {
        return { ...EMPTY, unavailable: t('pr.changes.unavailable.noBase') };
    }

    // BPMN 은 한 번 계산한 diff 에서 항목과 하이라이트 맵을 함께 얻는다 — 상세 비교에서
    // 다시 돌리면 같은 XML 을 두 번 파싱한다.
    const bpmnDiff = resourceType === 'dmn' ? null : computeBpmnDiff(snapshots.baseXml, snapshots.headXml);
    const items = orderItems(
        bpmnDiff ? toBpmnItems(bpmnDiff.changes) : toDmnItems(parseDmnXml(snapshots.baseXml), parseDmnXml(snapshots.headXml))
    );

    return {
        shape: 'items',
        files: [],
        items,
        snapshots: options.withSnapshots
            ? {
                  baseXml: snapshots.baseXml,
                  headXml: snapshots.headXml,
                  diffActivitiesBase: bpmnDiff?.diffActivitiesB || {},
                  diffActivitiesHead: bpmnDiff?.diffActivitiesA || {}
              }
            : undefined,
        summary: summarizeItems(items),
        shortSummary: shortSummarizeItems(items),
        unavailable: items.length ? '' : t('pr.changes.unavailable.noDiff')
    };
}

/**
 * 두 BPMN 스냅샷의 차이를 한 줄 한국어로 옮긴다.
 * 병합 요청을 만들 때 설명란에 넣어, 검토자가 열어 보기 전에 무엇이 바뀌는지 알게 한다.
 */
export function describeBpmnChanges(beforeXml: string, afterXml: string): string {
    if (!beforeXml || !afterXml) return '';
    try {
        return summarizeItems(toBpmnItems(computeBpmnDiff(beforeXml, afterXml).changes));
    } catch {
        return '';
    }
}

/**
 * 두 DMN 스냅샷의 차이를 한 줄 한국어로 옮긴다.
 * 병합 요청을 만들 때 제목·설명에 넣어, 검토자가 열어 보기 전에 무엇이 바뀌는지 알게 한다.
 */
export function describeDmnChanges(beforeXml: string, afterXml: string): string {
    if (!beforeXml || !afterXml) return '';
    try {
        return summarizeItems(orderItems(toDmnItems(parseDmnXml(beforeXml), parseDmnXml(afterXml))));
    } catch {
        return '';
    }
}

/**
 * 병합 요청 제목에서 검토 판단에 쓸모없는 앞머리를 걷어낸다.
 * 피드백이 자동으로 만드는 제목은 `[Feedback] <uuid> 프로세스 흐름 개선: …` 처럼
 * uuid 가 앞을 차지해, 목록에서 제목이 잘리면 정작 무엇이 바뀌는지가 사라진다.
 */
export function cleanPrTitle(title: string | null | undefined): string {
    let text = String(title || '').trim();
    text = text.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '');
    text = text.replace(/\s{2,}/g, ' ').replace(/\[\s*\]/g, '');
    return text.trim() || String(title || '').trim();
}

/**
 * 요청 설명에서 사람이 읽을 부분만 남긴다.
 * `draft version=4.0-h10y6…`, `(task: <uuid>)` 같은 내부 식별자는 검토자에게 의미가 없고,
 * 짧은 설명 자리를 통째로 차지해 정작 무엇이 바뀌는지를 밀어낸다.
 */
/** 무엇이 바뀌는지는 한 마디도 하지 않는, 자동 생성 설명의 상투구. */
const BOILERPLATE_DESCRIPTION = /^피드백 기반 자동(\s|$)/;

export function cleanPrDescription(description: string | null | undefined): string {
    let text = String(description || '').trim();
    if (!text || BOILERPLATE_DESCRIPTION.test(text)) return '';
    text = text.replace(/\(?\s*task\s*:\s*[0-9a-f-]{8,}\s*\)?/gi, '');
    text = text.replace(/\bdraft\s+version\s*=\s*\S+/gi, '');
    text = text.replace(/[ \t]{2,}/g, ' ').replace(/\s*\.\s*$/, '');
    return text.trim();
}

/**
 * 목록에 걸 요약을 요청별로 채운다.
 *
 * 목록에는 제목만으로는 구분되지 않는 요청이 흔하다 — 같은 스킬을 고친 요청 세 건이
 * 브랜치 해시로만 갈리는 식이다. 그래서 "무엇이 바뀌는가" 를 카드에서 바로 읽을 수
 * 있어야 목록이 고를 수 있는 목록이 된다.
 *
 * 스킬은 요청 한 건마다 깃을 한 번 부르므로, 화면을 막지 않도록 동시 실행 수를 묶고
 * 한 건씩 끝나는 대로 `onSummary` 로 흘려보낸다. 실패한 건은 조용히 건너뛴다 —
 * 요약을 못 얻은 것이 목록을 못 쓰게 만들 이유는 없다.
 */
export async function loadPrSummaries(
    backend: unknown,
    prs: unknown[],
    onSummary: (prId: string, summary: string) => void,
    options: { concurrency?: number; signal?: { aborted: boolean } } = {}
): Promise<void> {
    const concurrency = options.concurrency ?? 4;
    const queue = [...prs];
    const versionCache = new Map<string, Promise<any[]>>();

    const worker = async () => {
        while (queue.length) {
            if (options.signal?.aborted) return;
            const pr = queue.shift() as any;
            if (!pr?.id) continue;
            try {
                const changes = await loadPrChanges(backend, pr, versionCache);
                if (options.signal?.aborted) return;
                if (changes.shortSummary) onSummary(pr.id, changes.shortSummary);
            } catch {
                // 한 건이 실패해도 나머지 요약은 계속 채운다.
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}

/** 설명에 들어 있어도 아무것도 더 말해 주지 않는 낱말들. */
const FILLER_WORDS = new Set([
    '스킬',
    '프로세스',
    '의사결정',
    'dmn',
    '규칙',
    '업데이트',
    '수정',
    '변경',
    '개선',
    '생성',
    '추가',
    '삭제',
    'update',
    'feat',
    'fix'
]);

function words(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^0-9a-z가-힣_-]+/)
        .filter(Boolean);
}

/**
 * 제목을 되풀이할 뿐인 설명은 지운다.
 * 스킬 병합 요청의 설명은 대부분 `스킬 'nda-review' 업데이트` 인데, 제목이 이미
 * `feat: update nda-review` 라 같은 말을 두 번 읽히는 셈이고, 그만큼 정작 읽어야 할
 * 변경 요약이 아래로 밀린다.
 */
export function meaningfulPrDescription(pr: { title?: string; resource_name?: string; description?: string }): string {
    const text = cleanPrDescription(pr?.description);
    if (!text) return '';
    const known = new Set([...words(pr?.title || ''), ...words(pr?.resource_name || '')]);
    const informative = words(text).filter((word) => !FILLER_WORDS.has(word) && !known.has(word));
    return informative.length ? text : '';
}

/**
 * 제목이 무엇이 바뀌는지 말해 주는가.
 * `feat: update nda-review` 처럼 동작 어휘와 리소스 이름만 남는 제목은, 읽어도
 * 이 요청을 열어 볼 이유를 주지 못한다. 그런 제목 자리에는 계산한 변경 요약을 대신 세운다.
 */
/**
 * 예전에 자동으로 붙던 제목 꼴. 무엇이 바뀌는지는 말하지 않고 어디서 출발했는지만 말한다.
 * 뒤에 설명이 이어지는 `… 흐름 개선: 민원 접수 후 게이트웨이를 추가하고…` 는 제 몫을 하므로,
 * 이 문구로 **끝나는** 제목만 골라낸다.
 */
const BOILERPLATE_TITLE = /(에서 시작된 프로세스 개선|프로세스 개선|프로세스 흐름 개선|규칙 개선|변경)\s*$/;

export function isGenericPrTitle(pr: { title?: string; resource_name?: string }): boolean {
    const title = cleanPrTitle(pr?.title);
    if (!title) return true;
    if (BOILERPLATE_TITLE.test(title)) return true;
    const known = new Set(words(pr?.resource_name || ''));
    return !words(title).some((word) => !FILLER_WORDS.has(word) && !known.has(word));
}

/**
 * 목록·상세에 세울 한 줄.
 * 제목과 변경 요약을 나란히 두면 같은 말을 두 번 읽히거나 카드가 네 줄로 번진다.
 * 제목이 제 몫을 하면 제목을, 아니면 요약을 — 어느 쪽이든 한 줄만 남긴다.
 */
export function prHeadline(pr: { title?: string; resource_name?: string }, summary?: string): string {
    if (summary && isGenericPrTitle(pr)) return summary;
    return cleanPrTitle(pr?.title);
}

/**
 * 업무 관점 변경 보기 한 덩어리.
 * 파일 하나의 한 문단에서 무엇이 빠지고 무엇이 들어왔는지를 짝지어 담는다.
 */
export interface PrPlainBlock {
    filename: string;
    /** 검토자가 쓰는 말로 옮긴 파일 이름. (예: '스킬 본문') */
    label: string;
    status: string;
    /** 이 덩어리가 속한 문단 제목. 없으면 빈 문자열. */
    section: string;
    /** 변경 전 문장 */
    before: string[];
    /** 변경 후 문장 */
    after: string[];
}

/**
 * 깃 패치를 "변경 전 ↔ 변경 후" 문장 짝으로 옮긴다.
 *
 * `@@ -12,7 +12,9 @@` 와 `+`/`-` 기호는 이 변경이 업무적으로 무엇을 뜻하는지 말해 주지
 * 않는다. 검토자가 먼저 알아야 하는 것은 **어느 문단의 어떤 문장이 어떻게 바뀌는가** 이므로,
 * 마크다운 장식과 diff 기호를 걷어낸 본문만 문단별로 모아 좌우로 세운다.
 * 실제 패치는 '상세 Diff' 로 따로 둔다.
 */
export function buildPlainFileView(files: PrFileChange[]): PrPlainBlock[] {
    const blocks: PrPlainBlock[] = [];

    for (const file of files || []) {
        const label = fileLabel(file.filename);
        const base = { filename: file.filename, label, status: file.status };

        if (!file.patch) {
            blocks.push({ ...base, section: '', before: [], after: [] });
            continue;
        }

        const { added, removed } = readPatch(file.patch);
        const bySection = new Map<string, PrPlainBlock>();
        const put = (line: PatchLine, side: 'before' | 'after') => {
            let block = bySection.get(line.section);
            if (!block) {
                block = { ...base, section: line.section, before: [], after: [] };
                bySection.set(line.section, block);
                blocks.push(block);
            }
            block[side].push(line.text);
        };

        removed.forEach((line) => put(line, 'before'));
        added.forEach((line) => put(line, 'after'));

        if (!bySection.size) blocks.push({ ...base, section: '', before: [], after: [] });
    }

    return blocks;
}
