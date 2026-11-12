/* global globalThis */
/**
 * 받아쓰기 — 내 말을 글로 옮겨 입력 칸에 넣는다.
 *
 * 포털과 휴대폰 웹이 같은 경로를 쓴다 — 녹음한 소리를 `/completion/upload` 로 보내면
 * 받아쓴 글이 돌아온다. 다른 방법을 쓰면 인식 품질이 화면마다 달라진다.
 * (휴대폰 웹의 mobile/src/lib/voice.js 는 이 파일을 그대로 다시 내보낸다.)
 *
 * 업무 화면에서는 받아쓴 글을 **어디에 넣을지**도 여기서 정한다.
 *   - 글 칸 하나짜리 양식(자유 입력)이면 그 칸 뒤에 잇는다. 말한 그대로 넣는다 — LLM 을 거치면
 *     "조건부 적합입니다" 한 줄이 세 문장짜리 보고서로 바뀌어 돌아온다(2026-11-11 VM 에서 확인).
 *   - 칸이 여럿이면 말한 내용을 칸에 나눠 넣는다. 예전 「음성 에이전트」 창이 update_form_fields 로
 *     하던 일을, 창 없이 서버 LLM 한 번으로 한다. 말하지 않은 칸은 건드리지 않는다.
 *     LLM 답을 기다리는 동안(최대 60초) 사람이 계속 쓸 수 있으므로, 넣기 직전에 칸마다 요청 때 값과
 *     견줘 그새 바뀐 칸은 건너뛴다(mergeFill). 여러 줄 글 칸은 LLM 이 다시 쓰지 못하게 새로 넣을 말만
 *     받아 우리가 뒤에 잇고, 한 줄 칸 · 날짜 · 선택 칸은 말한 값으로 바꾼다.
 */

// ---------------------------------------------------------------------------
// 녹음과 받아쓰기
// ---------------------------------------------------------------------------

/** 이 기기에서 녹음이 가능한가. */
export function canRecord(nav = globalThis.navigator, win = globalThis) {
    return Boolean(nav?.mediaDevices?.getUserMedia && win?.MediaRecorder);
}

/**
 * 왜 안 되는지 사용자가 할 수 있는 일로 바꿔 말한다.
 *
 * "NotAllowedError" 를 그대로 보여 주면 무엇을 해야 할지 알 수 없다.
 */
export function reasonText(reason) {
    if (reason === 'denied') return '마이크 사용을 허용해 주세요.';
    if (reason === 'unsupported') return '이 기기에서는 음성 입력을 쓸 수 없습니다.';
    if (reason === 'empty') return '소리가 녹음되지 않았습니다. 다시 시도해 주세요.';
    if (reason === 'failed') return '받아쓰지 못했습니다. 다시 시도해 주세요.';
    return '음성 입력에 실패했습니다.';
}

/** 권한 거부인가. 그 밖의 실패와 안내가 달라야 한다. */
export function isDenied(error) {
    const name = (error?.name || '').toString();
    return name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError';
}

/**
 * 녹음을 시작한다. 멈추는 함수를 돌려준다.
 *
 * 멈추면 녹음된 소리 덩어리가 나온다. 마이크는 반드시 놓아 준다 — 놓지 않으면
 * 안드로이드 상단에 녹음 표시가 계속 남아 사용자가 불안해한다.
 *
 * `timeslice`(ms)를 주면 녹음 중에도 조각이 쌓이고 `peek()` 로 지금까지의 소리를 꺼낼 수 있다.
 * 업무 화면은 이것으로 말하는 동안 받아쓴 글을 미리 보여 준다(첫 조각에 머리가 들어 있어
 * 지금까지의 조각을 이으면 그대로 하나의 소리 파일이 된다).
 */
export async function startRecording({ nav = globalThis.navigator, win = globalThis, timeslice } = {}) {
    if (!canRecord(nav, win)) return { ok: false, reason: 'unsupported' };

    let stream;
    try {
        stream = await nav.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        return { ok: false, reason: isDenied(e) ? 'denied' : 'failed' };
    }

    const chunks = [];
    let recorder;
    try {
        recorder = new win.MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
            if (e?.data) chunks.push(e.data);
        };
        if (timeslice) recorder.start(timeslice);
        else recorder.start();
    } catch (_e) {
        // 녹음기를 못 만들어도 받은 마이크는 놓는다 — 녹음 표시가 남지 않게
        try {
            stream.getTracks().forEach((t) => t.stop());
        } catch (_e2) {
            // 이미 놓은 마이크
        }
        return { ok: false, reason: 'failed' };
    }

    return {
        ok: true,
        peek: () => (chunks.length ? new win.Blob(chunks.slice(), { type: 'audio/wav' }) : null),
        stop: () =>
            new Promise((resolve) => {
                const finish = () => {
                    // 마이크를 놓지 않으면 녹음 표시가 계속 남는다.
                    try {
                        stream.getTracks().forEach((t) => t.stop());
                    } catch (_e) {
                        // 이미 놓은 마이크
                    }
                    resolve(chunks.length ? new win.Blob(chunks, { type: 'audio/wav' }) : null);
                };
                if (recorder.state === 'recording') {
                    recorder.onstop = finish;
                    recorder.stop();
                } else {
                    finish();
                }
            })
    };
}

/**
 * 받아쓴다.
 *
 * @param {Blob} blob
 * @param {{post: Function}} deps  axios 같은 것
 */
export async function transcribe(blob, { post }) {
    if (!blob) return { ok: false, reason: 'empty' };

    const form = new FormData();
    form.append('audio', blob);

    try {
        const response = await post('/completion/upload', form);
        const text = (response?.data?.transcript || '').toString().trim();
        if (!text) return { ok: false, reason: 'empty' };
        return { ok: true, text };
    } catch (_e) {
        return { ok: false, reason: 'failed' };
    }
}

/** 마지막 줄이 마크다운 목록 · 번호 · 제목 · 인용 줄인가. 그 뒤에 띄어 이으면 말이 그 항목 안으로 들어간다. */
const BLOCK_LINE = /^\s*(?:[-*+•·]\s+|\d{1,3}[.)]\s+|#{1,6}\s+|>\s*)/;

/**
 * 받아쓴 글을 지금 쓰고 있던 글 뒤에 잇는다.
 *
 * 덮어쓰면 이미 적어 둔 것이 사라진다. 말로 덧붙이는 쓰임이 더 흔하다.
 * 한 줄 글이면 띄어 잇고, 여러 줄 글이거나 목록 · 제목 줄로 끝나면 빈 줄을 두고 새 문단으로 잇는다 —
 * 띄어 이으면 말한 내용이 마지막 글머리 항목 안으로 들어갔다(2026-11-11 VM, 에이전트 초안 뒤에 말한 글).
 * 줄바꿈 하나만 두면 마크다운에서는 여전히 앞 항목에 이어 붙으므로 빈 줄을 둔다.
 */
export function appendTranscript(current, text) {
    const before = (current || '').toString().trimEnd();
    const added = (text || '').toString().trim();
    if (!added) return current || '';
    if (!before) return added;
    const lines = before.split(/\r?\n/);
    const block = lines.length > 1 || BLOCK_LINE.test(lines[lines.length - 1]);
    return block ? `${before}\n\n${added}` : `${before} ${added}`;
}

// ---------------------------------------------------------------------------
// 말하는 동안 미리 보기
// ---------------------------------------------------------------------------

/** 미리 받아쓰는 간격. 받아쓰기 서버는 한 번에 끝까지 받아쓰므로 지금까지의 소리를 다시 보낸다. */
export const PARTIAL_EVERY_MS = 3000;
/**
 * 이보다 길게 말하면 더는 미리 받아쓰지 않는다. 매번 처음부터 다시 받아쓰므로 길어질수록
 * 같은 소리를 여러 번 보내게 된다 — 미리 보기는 "듣고 있다" 는 확인이면 충분하다.
 */
export const PARTIAL_UNTIL_MS = 45000;

/** 지금 미리 받아쓸 차례인가. 앞 요청이 아직 안 끝났으면 쌓지 않는다. */
export function partialDue({ elapsedMs, sinceLastMs, inFlight }) {
    if (inFlight) return false;
    if (!(elapsedMs >= PARTIAL_EVERY_MS)) return false;
    if (elapsedMs > PARTIAL_UNTIL_MS) return false;
    return sinceLastMs >= PARTIAL_EVERY_MS;
}

/** 녹음한 시간 m:ss */
export function formatElapsed(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/** 한 줄 막대에는 끝부분만 보인다 — 지금 하는 말이 끝에 있다. */
export function tailText(text, max = 80) {
    const t = (text || '').toString().trim();
    return t.length > max ? `…${t.slice(t.length - max)}` : t;
}

// ---------------------------------------------------------------------------
// 받아쓴 글을 어디에 넣을까
// ---------------------------------------------------------------------------

/** 말로 채울 수 있는 칸. 파일 · 폴더 · 프로세스 · 슬라이드 칸은 말로 채울 수 없다. */
const FILLABLE_TYPES = new Set([
    'text-field',
    'textarea-field',
    'select-field',
    'checkbox-field',
    'radio-field',
    'boolean-field',
    'user-select-field',
    'date-field',
    'time-field',
    'datetime-field',
    'report-field'
]);

/**
 * 폼 칸의 readonly · disabled 속성이 켜져 있는가.
 * 이 저장소의 폼은 `disabled='false'` 처럼 글자로 꺼 두므로 속성이 있다고 켜진 것이 아니다.
 */
export function isOnAttr(value) {
    if (value === null || value === undefined) return false;
    const v = String(value).trim().toLowerCase();
    return v === '' || v === 'true' || v === 'readonly' || v === 'disabled';
}

/**
 * 선택 칸의 `items="[{'python':'파이썬'}]"` 를 고를 수 있는 값으로.
 * 예전 「음성 에이전트」 창(enrichFormSchema)과 같은 읽기 — 값만 주면 LLM 이 "파이썬" 을 그대로 넣는다.
 */
export function parseItemsAttr(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(String(raw).replace(/'/g, '"'));
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
                const key = Object.keys(item)[0];
                return { label: item[key], value: key };
            })
            .filter((o) => o.value !== undefined);
    } catch (_e) {
        return [];
    }
}

/** 글을 그대로 받는 칸인가. 숫자 · 이메일처럼 모양이 정해진 칸은 아니다. */
function isFreeText(field) {
    if (field.type === 'textarea-field') return true;
    if (field.type !== 'text-field') return false;
    const t = (field.inputType || '').toLowerCase();
    return !t || t === 'text';
}

/**
 * 이미 적힌 글을 고쳐 쓰지 않고 뒤에 잇기만 하는 칸인가 — 여러 줄 글 칸(textarea · 자유 입력)과 문서 칸.
 *
 * 2026-11-11 결정(위임, 리뷰 반영): 한 줄 칸(<input> — 고객명 · 제안 제목)은 말한 값으로 **바꾼다**.
 * 「고객명은 한빛물산」 은 「그 값으로 해 달라」 는 뜻이라, 뒤에 이으면 「홍길동 한빛물산」 이 된다.
 * 여러 줄 칸만 「새로 넣을 말만 받아 뒤에 잇기」 를 지킨다(초안 · 사람이 쓴 긴 글을 LLM 이 다시 쓰지 못하게).
 * 날짜 · 선택 · 예/아니오 · 숫자 칸도 말한 값으로 바꾼다. 어느 쪽이든 답을 기다리는 사이 사람이 고친 칸은
 * 건너뛴다(mergeFill).
 */
function isAppendOnly(field) {
    return field.type === 'textarea-field' || field.type === 'report-field';
}

function editableFields(fields) {
    const seen = new Set();
    return (Array.isArray(fields) ? fields : []).filter((f) => {
        if (!f || !f.name || f.readonly || f.disabled) return false;
        if (seen.has(f.name)) return false;
        seen.add(f.name);
        return true;
    });
}

/**
 * 받아쓴 글을 어디에 넣을지 정한다.
 *
 * - `append`: 말로 채울 칸이 글 칸 하나뿐이다(자유 입력). 그 칸 뒤에 말한 그대로 잇는다.
 * - `fill`: 칸이 여럿이다. 말한 내용을 칸에 나눠 넣는다(서버 LLM).
 * - `none`: 말로 채울 칸이 없다(모두 읽기 전용이거나 파일 칸뿐).
 *
 * @param {Array<{name:string,type:string,inputType?:string,label?:string,readonly?:boolean,disabled?:boolean}>} fields
 */
export function dictationTarget(fields) {
    const fillable = editableFields(fields).filter((f) => FILLABLE_TYPES.has(f.type));
    if (fillable.length === 0) return { mode: 'none' };
    if (fillable.length === 1 && isFreeText(fillable[0])) {
        return { mode: 'append', name: fillable[0].name, label: fillable[0].label || fillable[0].name };
    }
    return { mode: 'fill', names: fillable.map((f) => f.name) };
}

// ---------------------------------------------------------------------------
// 칸이 여럿일 때 — 서버 LLM 한 번
// ---------------------------------------------------------------------------

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * LLM 에 넘길 칸 설명. 지금 값과 고를 수 있는 값까지 — 이름만 주면 엉뚱한 칸에 넣는다.
 * 칸마다 fill: "append"(여러 줄 — 새 말만) 또는 "replace"(값 전체)를 적는다 — 칸 종류로 짐작하게 두면
 * 한 줄 글 칸과 여러 줄 글 칸을 헷갈린다.
 */
function fieldSpec(field) {
    const spec = { name: field.name, label: field.label || field.name, type: field.type };
    if (field.inputType) spec.inputType = field.inputType;
    if (Array.isArray(field.options) && field.options.length) spec.options = field.options;
    spec.fill = isAppendOnly(field) ? 'append' : 'replace';
    return spec;
}

/**
 * 받아쓴 말로 양식 칸을 채워 달라는 요청 글.
 *
 * 규칙은 예전 「음성 에이전트」 창의 지침을 그대로 옮겼다 — 스키마에 없는 칸 금지, 모르면 비워 둠.
 * 다른 점: 창은 대화하며 되물었지만 여기서는 한 번에 끝나므로, 말하지 않은 칸은 아예 돌려주지 않게 한다.
 *
 * 여러 줄 글 칸은 「새로 넣을 말만」 받는다. 전에는 「기존 값 + 새 말」 전체를 받아 그대로 덮어써서, LLM 이
 * 맞춤법을 고친다며 이미 적힌 글을 다시 쓰면 그대로 바뀌었다. 잇는 일은 mergeFill 이 한다.
 * (전체 값을 받아 앞부분이 기존 값과 같은지 보는 방법도 있지만, 앞부분이 한 글자라도 고쳐지면 새 말만
 * 떼어 낼 수 없어 기존 글이 두 번 들어간다. 새 말만 받으면 그런 경우가 없다.)
 */
export function buildFillMessages({
    fields,
    values = {},
    transcript,
    processName = '',
    activityName = '',
    instruction = '',
    now = new Date()
}) {
    const fillable = editableFields(fields).filter((f) => FILLABLE_TYPES.has(f.type));
    const current = {};
    fillable.forEach((f) => {
        const v = values ? values[f.name] : undefined;
        if (v !== undefined && v !== null && v !== '') current[f.name] = v;
    });
    const rules = [
        '너는 업무 입력 양식을 사용자의 말로 채우는 도우미다. 사용자가 방금 말한 것을 받아쓴 글이 주어진다.',
        '규칙:',
        '- 받아쓴 글에 담긴 내용만 칸에 넣는다. 말하지 않은 칸은 돌려주지 않는다. 값을 지어내지 않는다.',
        '- name 은 아래 양식 칸의 name 만 쓴다. 칸을 새로 만들지 않는다.',
        '- options 가 있는 칸은 options 의 value 중에서 고른다.',
        `- 날짜는 YYYY-MM-DD, 시간은 HH:mm 로 쓴다. 오늘은 ${isoDate(now)} 이다.`,
        '- 이미 값이 있는 칸은 말한 내용이 그 칸에 대한 것일 때만 돌려준다.',
        '- fill 이 "append" 인 칸(여러 줄 글 칸)은 새로 넣을 말만 value 로 돌려준다. 현재 값을 되풀이하거나 고쳐 쓰지 않는다 — 현재 값 뒤에 잇는 것은 화면이 한다.',
        '- fill 이 "replace" 인 칸(한 줄 글 · 날짜 · 시간 · 선택 · 예/아니오 · 숫자 등)은 말한 값으로 그 칸에 들어갈 값 전체를 돌려준다. 현재 값은 그 값으로 바뀐다.',
        '- 말한 내용을 부풀리거나 다시 쓰지 않는다. 새로 넣을 말의 맞춤법과 띄어쓰기만 고친다. append 칸의 현재 값은 고치지 않는다.',
        '- 답은 JSON 하나만 쓴다: {"fields":[{"name":"칸 name","value":"값"}]}. 넣을 칸이 없으면 {"fields":[]}.',
        `프로세스: ${processName || '없음'} / 활동: ${activityName || '없음'}`,
        instruction ? `활동 지침: ${instruction}` : '',
        `양식 칸(JSON): ${JSON.stringify(fillable.map(fieldSpec))}`,
        `현재 값(JSON): ${JSON.stringify(current)}`
    ]
        .filter(Boolean)
        .join('\n');
    return [
        { role: 'system', content: rules },
        { role: 'user', content: `받아쓴 글: "${(transcript || '').toString().trim()}"` }
    ];
}

/** 답에서 JSON 을 꺼낸다. ```json 묶음이든 앞뒤에 말이 붙었든. */
function extractJson(text) {
    if (!text) return null;
    if (typeof text === 'object') return text;
    const s = text.toString();
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : s;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(body.slice(start, end + 1));
    } catch (_e) {
        return null;
    }
}

/** 말로 하는 상대 날짜. 「내일모레」 는 모레와 같은 날이다. */
const RELATIVE_DAYS = { 오늘: 0, 내일: 1, 모레: 2, 내일모레: 2 };
const RELATIVE_DAY = /^(오늘|내일모레|내일|모레)\s*(?:까지|에|요|이요|이에요|예요|입니다|로|으로|부터)?\s*[.!]?$/;

/**
 * 말로 들은 날짜 · 시간을 칸 모양으로. 예전 「음성 에이전트」 창(WorkItem.handleAssistantApply)의 규칙.
 * 칸 이름이 아니라 칸 종류로 판단한다 — 이름에 date 가 없는 날짜 칸이 흔하다.
 */
export function normalizeSpokenValue(field, value, now = new Date()) {
    if (typeof value !== 'string') return value;
    const raw = value.trim();
    const type = field?.type;
    if (type === 'date-field') {
        // 적힌 날짜가 먼저다 — 「2026-11-20 (오늘부터 9일 뒤)」 처럼 설명에 「오늘」 이 섞여도 적힌 날짜를 쓴다
        const ymd = raw.match(/(\d{4})\s*[./년-]\s*(\d{1,2})\s*[./월-]\s*(\d{1,2})/);
        if (ymd) return `${ymd[1]}-${pad(Number(ymd[2]))}-${pad(Number(ymd[3]))}`;
        const md = raw.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
        if (md) return `${now.getFullYear()}-${pad(Number(md[1]))}-${pad(Number(md[2]))}`;
        // 상대 날짜는 값 전체가 그 말일 때만 — 「내일모레」 에서 「내일」 만 읽으면 하루가 틀린다
        const rel = raw.match(RELATIVE_DAY);
        if (rel) {
            const d = new Date(now);
            d.setDate(d.getDate() + RELATIVE_DAYS[rel[1]]);
            return isoDate(d);
        }
        return raw;
    }
    if (type === 'time-field') {
        const hhmm = raw.match(/^\s*(\d{1,2}):(\d{1,2})/);
        if (hhmm) return `${pad(Math.min(23, Number(hhmm[1])))}:${pad(Math.min(59, Number(hhmm[2])))}`;
        const ko = raw.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/);
        if (ko) {
            let h = Number(ko[2]);
            const m = ko[3] ? Number(ko[3]) : 0;
            if (ko[1] === '오후' && h < 12) h += 12;
            if (ko[1] === '오전' && h === 12) h = 0;
            return `${pad(h)}:${pad(m)}`;
        }
        return raw;
    }
    return raw;
}

/**
 * LLM 답을 칸 값으로. 양식에 없는 칸 · 읽기 전용 칸 · 빈 값은 버린다.
 *
 * 예전 창은 칸 이름의 변형(customer-name · customerName)까지 함께 넣어 제출 값에 쓰레기 키가
 * 섞였다. 여기서는 양식의 name 과 정확히 같은 것만 남긴다.
 *
 * @returns {Record<string, any>}
 */
export function parseFillResponse(text, fields, { now = new Date() } = {}) {
    const parsed = extractJson(text);
    if (!parsed || typeof parsed !== 'object') return {};
    const byName = new Map(
        editableFields(fields)
            .filter((f) => FILLABLE_TYPES.has(f.type))
            .map((f) => [f.name, f])
    );
    let pairs = [];
    if (Array.isArray(parsed.fields)) {
        pairs = parsed.fields.filter((f) => f && typeof f === 'object').map((f) => [f.name, f.value]);
    } else if (parsed.formValues && typeof parsed.formValues === 'object') {
        pairs = Object.entries(parsed.formValues);
    } else {
        pairs = Object.entries(parsed);
    }
    const patch = {};
    pairs.forEach(([name, value]) => {
        const field = byName.get(name);
        if (!field) return;
        if (value === null || value === undefined) return;
        if (typeof value === 'string' && !value.trim()) return;
        patch[name] = normalizeSpokenValue(field, value, now);
    });
    return patch;
}

// ---------------------------------------------------------------------------
// 답을 넣을 때 — 기다리는 사이 사람이 쓴 글을 지킨다
// ---------------------------------------------------------------------------

/** 빈 값끼리는 같다(null · undefined · '' · 빈 배열). 폼은 빈 칸을 이 넷 중 아무것으로나 둔다. */
function isBlank(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
}

function sameValue(a, b) {
    if (isBlank(a) && isBlank(b)) return true;
    if (a === b) return true;
    if (typeof a === 'object' || typeof b === 'object') {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch (_e) {
            return false;
        }
    }
    return String(a) === String(b);
}

function copyValue(v) {
    if (v && typeof v === 'object') {
        try {
            return JSON.parse(JSON.stringify(v));
        } catch (_e) {
            return v;
        }
    }
    return v;
}

/**
 * 요청을 보낼 때의 칸 값(복사본). 폼 값 객체는 사람이 쓰는 대로 그 자리에서 바뀌므로 복사해 둬야
 * 답이 왔을 때 「그새 바뀌었나」 를 알 수 있다.
 */
export function snapshotValues(fields, values) {
    const snap = {};
    editableFields(fields)
        .filter((f) => FILLABLE_TYPES.has(f.type))
        .forEach((f) => {
            snap[f.name] = copyValue(values ? values[f.name] : undefined);
        });
    return snap;
}

/**
 * 글 칸에 넣을 새 말. LLM 에게 새 말만 달라고 해도 기존 값을 앞에 그대로 붙여 오기도 한다 —
 * 그 앞부분은 떼어 낸다. 기존 값의 끝과 같으면(이미 적힌 말) 넣을 것이 없다.
 */
function additionTo(existing, value) {
    const before = String(existing).trim();
    let added = String(value).trim();
    if (added.startsWith(before)) added = added.slice(before.length).trim();
    if (!added || before.endsWith(added)) return '';
    return added;
}

/**
 * LLM 답(parseFillResponse)을 지금 폼에 넣을 값으로 바꾼다.
 *
 * - 요청 때 값(snapshot)과 지금 값(current)이 다른 칸은 건너뛴다. 답을 기다리는 동안(최대 60초) 사람이 그 칸에
 *   쓴 글을 덮어쓰지 않는다. 건너뛴 칸은 skipped 로 알려 화면이 말해 준다.
 * - 이미 글이 있는 여러 줄 글 칸(isAppendOnly)은 기존 글을 한 글자도 바꾸지 않고 새 말만 뒤에 잇는다.
 * - 한 줄 글 · 날짜 · 선택처럼 값 하나를 갖는 칸은 말한 값으로 바꾼다(isAppendOnly 의 2026-11-11 결정).
 *
 * @param {Record<string, any>} patch  칸 → LLM 이 준 값
 * @param {{fields: Array, snapshot: Record<string, any>, current: Record<string, any>}} p
 * @returns {{values: Record<string, any>, applied: string[], skipped: string[]}}
 */
export function mergeFill(patch, { fields, snapshot = {}, current = {} } = {}) {
    const byName = new Map(editableFields(fields).map((f) => [f.name, f]));
    const values = {};
    const applied = [];
    const skipped = [];
    Object.keys(patch || {}).forEach((name) => {
        const field = byName.get(name);
        if (!field) return;
        const now = current ? current[name] : undefined;
        if (!sameValue(now, snapshot ? snapshot[name] : undefined)) {
            skipped.push(name);
            return;
        }
        let next = patch[name];
        if (isAppendOnly(field) && typeof now === 'string' && now.trim() && typeof next === 'string') {
            const added = additionTo(now, next);
            if (!added) return;
            next = appendTranscript(now, added);
        }
        if (sameValue(now, next)) return;
        values[name] = next;
        applied.push(name);
    });
    return { values, applied, skipped };
}

// ---------------------------------------------------------------------------
// LLM 요청 하나를 약속(Promise)으로
// ---------------------------------------------------------------------------

/** 이 시간 안에 답이 없으면 실패로 본다 — 멈춤을 누른 사람이 막연히 기다리지 않게. */
export const FORM_FILL_TIMEOUT_MS = 60000;

/**
 * 생성기(AIGenerator 꼴: generate · stop, client.onGenerationFinished · onError 로 답한다)를 돌려 답을 기다린다.
 * 생성기를 밖에서 받는 까닭은 이 판단을 node 시험으로 확인하기 위해서다(AIGenerator 는 '@/…' 를 읽어 node 에서 못 연다).
 *
 * generate() 는 async 라 XHR 을 열기 전에 던지면(설정 읽기 · 메시지 만들기) 거부된 약속만 남는다.
 * 그 거부를 받아 바로 실패로 돌린다 — 받지 않으면 막대가 60초 동안 「채우는 중」 에 머물고
 * 처리 안 된 거부가 콘솔에 남는다.
 *
 * @param {(client: {onGenerationFinished: Function, onError: Function}) => {generate: Function, stop?: Function}} createGenerator
 * @returns {Promise<string>}
 */
export function awaitGeneration(createGenerator, { timeoutMs = FORM_FILL_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let generator = null;
        let timer = null;
        const settle = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn(value);
        };
        const fail = (error, fallback) => settle(reject, new Error((error && error.message) || fallback));
        const client = {
            // 빈 답은 서버 문제다 — 「말한 내용에서 못 찾았다」 로 알리면 사용자가 말을 바꿔 다시 하게 된다
            onGenerationFinished: (model) => (model ? settle(resolve, model) : settle(reject, new Error('empty reply'))),
            onError: (error) => fail(error, 'form fill failed')
        };
        timer = setTimeout(() => {
            try {
                if (generator && generator.stop) generator.stop();
            } catch (_e) {
                // 이미 끝난 요청
            }
            settle(reject, new Error('timeout'));
        }, timeoutMs);
        try {
            generator = createGenerator(client);
            Promise.resolve(generator.generate()).catch((e) => fail(e, 'form fill failed'));
        } catch (e) {
            fail(e, 'form fill failed');
        }
    });
}
