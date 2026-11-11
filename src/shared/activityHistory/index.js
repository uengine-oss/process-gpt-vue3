/**
 * 업무 화면 「액티비티」 표(ProcessInstanceTable)의 읽기 도움말.
 *
 * 표는 '완료된 업무 → 다음 업무' 한 줄씩이라, 검토 → 반려 → 재작성 → 다시 검토처럼 흐름이 되돌아가면
 * 같은 이름이 여러 번 나오고 왜 다시 나오는지 알 수 없었다(2026-11-11 검토 「이 뒤로 다시 돌아왔구나 …
 * 이것도 좀 헷갈리는데」). 그래서 줄마다 세 가지를 덧붙인다.
 *   - 회차: 같은 단계를 몇 번째 하는가(2회차부터 표시)
 *   - 되돌아감: 흐름을 앞 단계로 돌려보낸 줄. 정의의 갈림길 이름(「반려인 경우」)을 알면 함께 보인다.
 *     모르면 다시 하게 된 줄에 「다시 진행」 만 붙인다.
 *   - 지금 단계: 아직 끝나지 않은 다음 업무
 *
 * 화면에서 떼어 둔 까닭은 회차 · 되돌아감을 가르는 규칙이 틀리기 쉬워 따로 시험해야 해서다.
 */

/** 여러 갈래 중 하나를 고르는 게이트웨이. 병렬은 모든 갈래로 가니 '고른 이유' 가 없다. */
const CHOOSING_GATEWAYS = new Set(['exclusiveGateway', 'inclusiveGateway', 'eventBasedGateway']);

/** 갈래 이름이 너무 길면 표의 칸을 넘친다. */
const MAX_LABEL = 24;

const textOf = (v) => String(v ?? '').trim();

function clip(label) {
    const t = textOf(label);
    return t.length > MAX_LABEL ? `${t.slice(0, MAX_LABEL)}…` : t;
}

/**
 * 갈래 이름. 화면에 보일 이름(name)을 먼저 쓰고, 없으면 조건 글을 쓴다.
 * 조건이 식(`review_result == 'reject'`)이면 사람이 읽을 이름이 아니므로 쓰지 않는다.
 */
function branchLabelOf(seq) {
    const name = textOf(seq && seq.name);
    if (name) return name;
    const cond = textOf(seq && seq.condition);
    if (!cond || /[=<>!&|()]/.test(cond)) return '';
    return cond;
}

/**
 * 정의에서 '한 단계 → 다음 단계' 사이를 잇는 길을 찾아, 그 길에서 갈래를 골랐는지와 마지막으로 고른 갈래 이름.
 * 사이에는 게이트웨이 · 중간 이벤트만 있을 수 있다(다른 업무를 지나면 그 길이 아니다).
 *
 * 「골랐는가」 를 이름과 따로 돌려주는 까닭: 이름 없는 갈래(조건만 있는 흐름)로 되돌아간 줄도 그 줄이 고른 것이다.
 * 이름만 보면 그 줄을 지나쳐 앞의 다른 갈래 이름을 가져와 엉뚱한 줄에 표시하게 된다.
 *
 * @returns {{chose: boolean, label: string}} 갈림길을 지나지 않았으면 chose=false. 고른 갈래에 이름이 없으면 label=''.
 */
export function branchChoiceBetween(definition, fromId, toId) {
    const none = { chose: false, label: '' };
    if (!definition || !fromId || !toId) return none;
    const sequences = Array.isArray(definition.sequences) ? definition.sequences : [];
    if (!sequences.length) return none;

    const gatewayType = new Map();
    (Array.isArray(definition.gateways) ? definition.gateways : []).forEach((g) => {
        if (g && g.id) gatewayType.set(String(g.id), textOf(g.type));
    });
    const passable = new Set(gatewayType.keys());
    (Array.isArray(definition.events) ? definition.events : []).forEach((e) => {
        const type = textOf(e && e.type).toLowerCase();
        if (e && e.id && !type.includes('start') && !type.includes('end')) passable.add(String(e.id));
    });

    const out = new Map();
    sequences.forEach((s) => {
        if (!s || !s.source || !s.target) return;
        const src = String(s.source);
        if (!out.has(src)) out.set(src, []);
        out.get(src).push(s);
    });

    // 너비 우선. 사이 마디는 게이트웨이 · 중간 이벤트만 지난다. 지나며 고른 갈래(이름이 없어도)를 쌓는다.
    const queue = [{ id: String(fromId), choices: [] }];
    const seen = new Set([String(fromId)]);
    while (queue.length) {
        const { id, choices } = queue.shift();
        for (const seq of out.get(id) || []) {
            const target = String(seq.target);
            const nextChoices = CHOOSING_GATEWAYS.has(gatewayType.get(id)) ? [...choices, branchLabelOf(seq)] : choices;
            if (target === String(toId)) {
                return nextChoices.length ? { chose: true, label: clip(nextChoices[nextChoices.length - 1]) } : none;
            }
            if (!passable.has(target) || seen.has(target)) continue;
            seen.add(target);
            queue.push({ id: target, choices: nextChoices });
        }
    }
    return none;
}

/**
 * '한 단계 → 다음 단계' 사이에서 고른 갈래 이름. 갈림길을 지나지 않았거나 고른 갈래에 이름이 없으면 ''.
 */
export function branchLabelBetween(definition, fromId, toId) {
    return branchChoiceBetween(definition, fromId, toId).label;
}

/**
 * 표의 줄마다 회차 · 되돌아감 · 지금 단계를 붙인다.
 *
 * @param {Array<{completedActivityId?: string, nextActivityId?: string}>} rows  시간순 줄
 * @param {object} [opts]
 * @param {object} [opts.definition]  프로세스 정의(JSON). 갈래 이름을 찾는 데만 쓴다.
 * @param {string[]} [opts.currentActivityIds]  인스턴스의 지금 단계들. 없으면(undefined) 마지막 줄의 다음 업무를 지금 단계로 본다.
 * @param {boolean} [opts.finished]  인스턴스가 끝났는가. 끝났으면 지금 단계가 없다.
 * @returns {Array<{completedRound: number, nextRound: number, loop: null | {label: string}, current: boolean}>}
 */
export function annotateHistory(rows, opts = {}) {
    const list = Array.isArray(rows) ? rows : [];
    const { definition = null, currentActivityIds, finished = false } = opts;
    const notes = list.map(() => ({ completedRound: 0, nextRound: 0, loop: null, current: false }));

    // 1) 회차. 같은 단계를 마친 횟수를 세어 둔다.
    const doneCount = new Map();
    // 단계 → 그 단계를 마지막으로 마친 줄 번호
    const lastDoneAt = new Map();
    list.forEach((row, i) => {
        const c = row && row.completedActivityId;
        if (c) {
            const n = (doneCount.get(c) || 0) + 1;
            doneCount.set(c, n);
            notes[i].completedRound = n;
        }
        const nx = row && row.nextActivityId;
        if (nx) notes[i].nextRound = (doneCount.get(nx) || 0) + 1;

        // 2) 되돌아감. 다음 업무의 회차가 지금 마친 단계의 회차보다 앞서 나가면 흐름이 앞 단계로 돌아온 것이다.
        //    (재작성 1회차 → 작성 2회차). 같은 회차끼리 이어지는 줄(작성 2회차 → 검토 2회차)은 고리를 한 번 더
        //    도는 중일 뿐이라 표시하지 않는다 — 그 줄마다 붙이면 표 전체가 「다시 진행」 이 된다.
        //    제자리로 돌아오는 고리(검토 → 「보완 요청」 → 검토)는 이 줄에서 마친 단계가 곧 다음 업무다.
        if (nx && notes[i].nextRound > (notes[i].completedRound || 1) && (lastDoneAt.has(nx) || nx === c)) {
            // 돌려보낸 결정은 돌아온 단계를 떠난 뒤 이 줄까지 사이에서 가장 늦게 갈래를 고른 줄이다
            // (검토 → 「반려」 → 재작성 → 다시 작성 이면 검토 줄). 갈래를 고른 줄을 만나면 이름이 없어도 거기서 멈춘다 —
            // 이름 있는 갈래만 찾으면 이름 없는 흐름으로 되돌아간 줄을 지나쳐, 돌아온 단계에서 앞으로 나간 줄
            // (작성 → 「검토 필요」 → 검토)에 표시가 붙었다. 돌아온 단계를 떠난 줄 자체는 앞으로 나간 줄이라 보지 않는다.
            const stop = nx === c ? i : lastDoneAt.get(nx) + 1;
            let decided = i;
            let label = '';
            for (let k = i; k >= stop; k -= 1) {
                const r = list[k];
                const choice = branchChoiceBetween(definition, r && r.completedActivityId, r && r.nextActivityId);
                if (choice.chose) {
                    decided = k;
                    label = choice.label;
                    break;
                }
            }
            // 이름이 없으면 「다시 진행」 으로 보인다(label '')
            notes[decided].loop = { label };
        }
        if (c) lastDoneAt.set(c, i);
    });

    // 3) 지금 단계. 지금 단계를 가리킨 마지막 줄 — 그 뒤에 그 단계를 마친 줄이 없어야 한다.
    if (!finished && list.length) {
        const ids = Array.isArray(currentActivityIds) ? currentActivityIds : null;
        const targets = ids ? ids : [list[list.length - 1] && list[list.length - 1].nextActivityId].filter(Boolean);
        targets.forEach((id) => {
            for (let i = list.length - 1; i >= 0; i -= 1) {
                const row = list[i];
                if (row && row.completedActivityId === id) break; // 그 뒤로 이미 마쳤다
                if (row && row.nextActivityId === id) {
                    notes[i].current = true;
                    break;
                }
            }
        });
    }
    return notes;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * 표의 시간 — 한 줄로 「11.11 20:05」. 올해가 아니면 연도를 붙인다.
 * 전에는 오늘이면 「오후 08:02:16」, 아니면 「11월 10일 오후 10:59」 라 좁은 칸에서 세 줄로 접혔다.
 *
 * @returns {{short: string, full: string}}  full 은 툴팁용(「2026.11.11 20:05:56」)
 */
export function formatHistoryTime(timeStamp, now = new Date()) {
    if (timeStamp === null || timeStamp === undefined || timeStamp === '') return { short: '-', full: '' };
    const d = new Date(typeof timeStamp === 'string' && /^\d+$/.test(timeStamp) ? Number(timeStamp) : timeStamp);
    if (Number.isNaN(d.getTime())) return { short: '-', full: '' };
    const md = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const full = `${d.getFullYear()}.${md} ${hm}:${pad(d.getSeconds())}`;
    const short = d.getFullYear() === now.getFullYear() ? `${md} ${hm}` : `${d.getFullYear()}.${md} ${hm}`;
    return { short, full };
}
