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

/**
 * 받아쓴 글을 지금 쓰고 있던 글 뒤에 잇는다.
 *
 * 덮어쓰면 이미 적어 둔 것이 사라진다. 말로 덧붙이는 쓰임이 더 흔하다.
 */
export function appendTranscript(current, text) {
    const before = (current || '').toString().trimEnd();
    const added = (text || '').toString().trim();
    if (!added) return current || '';
    return before ? `${before} ${added}` : added;
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

/** LLM 에 넘길 칸 설명. 지금 값과 고를 수 있는 값까지 — 이름만 주면 엉뚱한 칸에 넣는다. */
function fieldSpec(field) {
    const spec = { name: field.name, label: field.label || field.name, type: field.type };
    if (field.inputType) spec.inputType = field.inputType;
    if (Array.isArray(field.options) && field.options.length) spec.options = field.options;
    return spec;
}

/**
 * 받아쓴 말로 양식 칸을 채워 달라는 요청 글.
 *
 * 규칙은 예전 「음성 에이전트」 창의 지침을 그대로 옮겼다 — 스키마에 없는 칸 금지, 모르면 비워 둠.
 * 다른 점: 창은 대화하며 되물었지만 여기서는 한 번에 끝나므로, 말하지 않은 칸은 아예 돌려주지 않게 한다.
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
        '- 이미 값이 있는 칸은 말한 내용이 그 칸을 바꾸거나 덧붙이라는 뜻일 때만 돌려준다. 덧붙일 때는 기존 값 뒤에 이어 쓴 전체 값을 돌려준다.',
        '- 말한 내용을 부풀리거나 다시 쓰지 않는다. 맞춤법과 띄어쓰기만 고친다.',
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

/**
 * 말로 들은 날짜 · 시간을 칸 모양으로. 예전 「음성 에이전트」 창(WorkItem.handleAssistantApply)의 규칙.
 * 칸 이름이 아니라 칸 종류로 판단한다 — 이름에 date 가 없는 날짜 칸이 흔하다.
 */
export function normalizeSpokenValue(field, value, now = new Date()) {
    if (typeof value !== 'string') return value;
    const raw = value.trim();
    const type = field?.type;
    if (type === 'date-field') {
        if (/오늘/.test(raw)) return isoDate(now);
        if (/내일/.test(raw)) {
            const d = new Date(now);
            d.setDate(d.getDate() + 1);
            return isoDate(d);
        }
        const ymd = raw.match(/(\d{4})\s*[./년-]\s*(\d{1,2})\s*[./월-]\s*(\d{1,2})/);
        if (ymd) return `${ymd[1]}-${pad(Number(ymd[2]))}-${pad(Number(ymd[3]))}`;
        const md = raw.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
        if (md) return `${now.getFullYear()}-${pad(Number(md[1]))}-${pad(Number(md[2]))}`;
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
