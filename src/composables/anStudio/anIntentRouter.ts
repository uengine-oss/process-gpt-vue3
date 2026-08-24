/**
 * anIntentRouter — 챗 입력에서 AN Transformation 단계 명령을 해석한다.
 *
 * 실행 트리거는 슬래시 명령(`/partition` 등, parseSlashCommand)이 정식 경로다.
 * detectAnIntent 의 자연어 감지는 순서도 AI Copilot 에서 "이 작업은 /xxx 명령으로 실행할 수
 * 있어요" 힌트를 띄우는 용도로만 쓰며(자동 실행 안 함), AN Studio 의 PiCopilotPanel 은
 * isModularizeIntent 자연어 트리거(ANStudio.md Task 3-1 스펙)를 그대로 유지한다.
 * 여러 단계가 한 문장에 섞이면 앞 단계(partition → gap → orchestrator → roadmap) 우선.
 * 동사 없는 단순 언급("파티셔닝이 뭐야?")은 의도로 보지 않고 null 을 반환한다.
 *
 * /executable(실행형) 계열은 execFeatureGate 허용 사용자에게만 존재하는 명령으로 취급한다
 * — 파싱·자동완성·자연어 감지 모두 이 파일에서 게이트되므로 UI 는 visibleSlashCommands() 만 쓰면 된다.
 */
import { canUseExecFeatures } from '@/utils/execFeatureGate';

export type AnIntentKind =
    | 'partition'
    | 'gap'
    | 'orchestrator'
    | 'roadmap'
    | 'modularize'
    | 'executable'
    | 'show-partition'
    | 'show-gap'
    | 'show-orchestrator'
    | 'show-roadmap'
    | 'show-executable';

export interface AnIntent {
    kind: AnIntentKind;
}

/** 슬래시 명령 1건의 메타데이터 — 파서와 자동완성 메뉴 UI 가 공유한다. */
export interface AnSlashCommand {
    /** 대표 표기 (예: '/partition') */
    command: string;
    /** 추가 인식 토큰 (예: '/파티셔닝') */
    aliases: string[];
    /** 실행 intent */
    kind: AnIntentKind;
    /** "view" 인자가 붙었을 때의 열람 intent (없으면 항상 실행) */
    showKind?: AnIntentKind;
    label: string;
    description: string;
    icon: string;
}

export const AN_SLASH_COMMANDS: AnSlashCommand[] = [
    {
        command: '/partition',
        aliases: ['/partion', '/파티셔닝', '/블록'],
        kind: 'partition',
        showKind: 'show-partition',
        label: 'As-Is 파티셔닝',
        description: 'As-Is 도면을 eTOM L3 블록으로 분할하고 To-Be Studio 에서 확인',
        icon: 'mdi-vector-rectangle'
    },
    {
        command: '/gap',
        aliases: ['/갭'],
        kind: 'gap',
        showKind: 'show-gap',
        label: 'Gap 진단',
        description: 'PI Flag 를 근거로 Process/Data/Automation Gap 도출 (속성 패널에서 트리아지)',
        icon: 'mdi-magnify-scan'
    },
    {
        command: '/tobe',
        aliases: ['/투비', '/orchestrator'],
        kind: 'orchestrator',
        showKind: 'show-orchestrator',
        label: 'To-Be 설계',
        description: 'Master Orchestrator 설계 — 스윔레인 · ROI · Skill Shift',
        icon: 'mdi-sitemap-outline'
    },
    {
        command: '/roadmap',
        aliases: ['/로드맵'],
        kind: 'roadmap',
        showKind: 'show-roadmap',
        label: '로드맵 생성',
        description: '분기 기반 전환 로드맵(Gantt) 생성',
        icon: 'mdi-layers-triple-outline'
    },
    {
        command: '/modularize',
        aliases: ['/모듈화', '/ca'],
        kind: 'modularize',
        label: 'Call Activity 모듈화',
        description: '확정된 블록을 Call Activity 자식 프로세스로 변환',
        icon: 'mdi-puzzle-outline'
    },
    {
        command: '/executable',
        aliases: ['/실행형', '/exec'],
        kind: 'executable',
        showKind: 'show-executable',
        label: '실행형 변환',
        description: '순서도를 실행 엔진용 프로세스 정의(역할·분기 조건·자동화)로 AI 변환',
        icon: 'mdi-play-circle-outline'
    }
];

const VIEW_ARGS = ['view', 'show', 'open', '보기', '열기', '결과'];

/** 현재 사용자에게 노출되는 슬래시 명령 목록 (executable 계열은 허용 사용자 전용). */
export function visibleSlashCommands(): AnSlashCommand[] {
    if (canUseExecFeatures()) return AN_SLASH_COMMANDS;
    return AN_SLASH_COMMANDS.filter((c) => c.kind !== 'executable');
}

/** "/partition", "/gap view" 류의 슬래시 명령 파싱. 슬래시로 시작하지 않거나 미지원 명령이면 null. */
export function parseSlashCommand(text: string): AnIntent | null {
    const trimmed = String(text || '').trim();
    if (!trimmed.startsWith('/')) return null;
    const [head, ...rest] = trimmed.split(/\s+/);
    const token = head.toLowerCase();
    const cmd = visibleSlashCommands().find((c) => c.command === token || c.aliases.includes(token));
    if (!cmd) return null;
    const wantsView = rest.some((a) => VIEW_ARGS.includes(a.toLowerCase()));
    if (wantsView && cmd.showKind) return { kind: cmd.showKind };
    return { kind: cmd.kind };
}

/** 입력 프리픽스에 맞는 명령 자동완성 후보 (메뉴 UI 용). '/' 단독 입력이면 전체 반환. */
export function filterSlashCommands(input: string): AnSlashCommand[] {
    const t = String(input || '')
        .trim()
        .toLowerCase();
    if (!t.startsWith('/')) return [];
    const commands = visibleSlashCommands();
    if (t === '/') return commands;
    const head = t.split(/\s+/)[0];
    return commands.filter((c) => c.command.startsWith(head) || c.aliases.some((a) => a.startsWith(head)));
}

const RUN_VERB = /실행|진행|돌려|시작|수행|해줘|해주|해봐|하자|다시|재진단|재분석|재생성|재설계|재분할|run/;
const SHOW_VERB = /보여|열어|조회|확인|꺼내|띄워|오픈|open/;
const MAKE_VERB = /생성|만들|작성|수립|뽑|그려|설계|진단|분석|도출|분할|나눠|나누/;

const PARTITION_KW = /파티셔닝|파티션|블록(분할|분리|나누|나눠|을나눠)|partition|etom.{0,6}(그룹핑|그룹|분류|블록)/;
const GAP_KW = /(갭|gap).{0,8}(진단|분석|도출|추출|트리아지|triage|카드)/;
const ORCHESTRATOR_KW = /오케스트레이터|orchestrat|(to-?be|투비).{0,8}(설계|디자인|design)|마스터.{0,4}오케스트/;
const ROADMAP_KW = /로드맵|roadmap/;
const EXECUTABLE_KW = /실행형|실행가능(한)?(프로세스|형태)|executable/;

function norm(text: string): string {
    return (
        String(text || '')
            .toLowerCase()
            .replace(/\s+/g, '')
            // 팀챗 /agent 래퍼("현재 프로세스 순서도에서 다음 요청을 수행해줘: …")가 주입하는
            // 동사(수행해줘)가 사용자 원문의 show/run 판별을 오염시키지 않도록 제거.
            .replace(/^현재프로세스순서도에서다음요청을수행해줘[:：]?/, '')
    );
}

/** "…call activity 로 저장/변환해줘", "모듈화해줘" 류의 모듈화 트리거 여부. (Task 3-1) */
export function isModularizeIntent(text: string): boolean {
    const t = norm(text);
    const hasCallActivity = /callactivity|콜액티비티/.test(t);
    const hasAction = /저장|변환|생성|만들|분리|추출|바꿔|전환/.test(t);
    if (hasCallActivity && hasAction) return true;
    if (/모듈화(해|하|시켜|로)/.test(t) || /모듈로(저장|변환|만들|생성|분리|추출)/.test(t)) return true;
    return false;
}

function resolve(t: string, runKind: AnIntentKind, showKind: AnIntentKind, keywordHasAction = false): AnIntent | null {
    const show = SHOW_VERB.test(t) && !RUN_VERB.test(t);
    if (show) return { kind: showKind };
    if (RUN_VERB.test(t) || MAKE_VERB.test(t) || keywordHasAction) return { kind: runKind };
    return null;
}

/**
 * 챗 텍스트에서 AN 단계 명령을 감지한다. 명령이 아니면 null.
 * show-* 는 실행 없이 결과 화면만 열라는 의도.
 */
export function detectAnIntent(text: string): AnIntent | null {
    const t = norm(text);
    if (!t) return null;

    if (isModularizeIntent(text)) return { kind: 'modularize' };
    if (PARTITION_KW.test(t)) return resolve(t, 'partition', 'show-partition');
    // GAP_KW 자체에 진단/분석 동사가 포함되므로 매치 시 동사 조건은 충족된 것으로 본다.
    if (GAP_KW.test(t)) return resolve(t, 'gap', 'show-gap', true);
    if (ORCHESTRATOR_KW.test(t)) return resolve(t, 'orchestrator', 'show-orchestrator');
    if (ROADMAP_KW.test(t)) return resolve(t, 'roadmap', 'show-roadmap');
    if (EXECUTABLE_KW.test(t) && canUseExecFeatures()) return resolve(t, 'executable', 'show-executable');
    return null;
}
