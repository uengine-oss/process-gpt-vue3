/**
 * 업무 화면의 받아쓰기 — 받아쓴 글을 어디에 어떻게 넣는가.
 *
 * 지키려는 것
 *   - 자유 입력(글 칸 하나)에는 말한 그대로, 적어 둔 글 뒤에 잇는다. LLM 이 다시 쓰지 않는다.
 *   - 칸이 여럿이면 말한 칸만 채운다. 말하지 않은 칸 · 양식에 없는 칸 · 읽기 전용 칸은 건드리지 않는다.
 *   - 말하는 동안 미리 받아쓰기는 쌓이지 않고, 길어지면 멈춘다.
 *   - 녹음 중에도 지금까지의 소리를 꺼낼 수 있다(미리 보기).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PARTIAL_EVERY_MS,
    PARTIAL_UNTIL_MS,
    appendTranscript,
    buildFillMessages,
    dictationTarget,
    formatElapsed,
    isOnAttr,
    normalizeSpokenValue,
    parseFillResponse,
    parseItemsAttr,
    partialDue,
    startRecording,
    tailText
} from './index.js';

// 기본 자유 입력 폼(FormWorkItem 이 만들어 두는 defaultform)
const FREE_INPUT = [{ name: 'free_input', label: '자유입력', type: 'textarea-field' }];

// 한빛물산 「고객 요청사항 입력」 양식
const REQUEST_FORM = [
    { name: 'customer_name', label: '고객명', type: 'text-field' },
    { name: 'contact', label: '연락처', type: 'text-field' },
    { name: 'request_title', label: '제안 제목', type: 'text-field' },
    { name: 'request_detail', label: '요청 상세 내용', type: 'textarea-field' },
    { name: 'attachment', label: '첨부 파일', type: 'file-field' }
];

// ---------------------------------------------------------------------------
// 어디에 넣을까
// ---------------------------------------------------------------------------

test('글 칸 하나짜리 자유 입력 폼이면 그 칸 뒤에 잇는다', () => {
    assert.deepEqual(dictationTarget(FREE_INPUT), { mode: 'append', name: 'free_input', label: '자유입력' });
});

test('글 칸 하나 + 파일 칸이면 글 칸에 잇는다 — 파일 칸은 말로 채울 수 없다', () => {
    const fields = [
        { name: 'memo', label: '메모', type: 'text-field' },
        { name: 'file', label: '첨부', type: 'file-field' }
    ];
    assert.deepEqual(dictationTarget(fields), { mode: 'append', name: 'memo', label: '메모' });
});

test('칸이 여럿이면 말한 내용을 칸에 나눠 넣는다', () => {
    const target = dictationTarget(REQUEST_FORM);
    assert.equal(target.mode, 'fill');
    assert.deepEqual(target.names, ['customer_name', 'contact', 'request_title', 'request_detail']);
});

test('읽기 전용 칸은 세지 않는다 — 검토 의견(읽기 전용) + 메모 칸이면 메모에 잇는다', () => {
    const fields = [
        { name: 'review_comment', label: '검토 의견', type: 'textarea-field', readonly: true },
        { name: 'note', label: '메모', type: 'textarea-field' }
    ];
    assert.deepEqual(dictationTarget(fields), { mode: 'append', name: 'note', label: '메모' });
});

test('칸 하나라도 글 칸이 아니면(날짜 · 숫자 · 선택) 그대로 붙이지 않고 채우기로 보낸다', () => {
    assert.equal(dictationTarget([{ name: 'due', type: 'date-field' }]).mode, 'fill');
    assert.equal(dictationTarget([{ name: 'qty', type: 'text-field', inputType: 'number' }]).mode, 'fill');
    assert.equal(dictationTarget([{ name: 'ok', type: 'select-field', options: [{ label: '예', value: 'y' }] }]).mode, 'fill');
});

test('말로 채울 칸이 없으면 그렇다고 한다', () => {
    assert.deepEqual(dictationTarget([]), { mode: 'none' });
    assert.deepEqual(dictationTarget(null), { mode: 'none' });
    assert.deepEqual(dictationTarget([{ name: 'f', type: 'file-field' }]), { mode: 'none' });
    assert.deepEqual(dictationTarget([{ name: 'r', type: 'textarea-field', disabled: true }]), { mode: 'none' });
});

test('같은 이름이 두 번 잡혀도 한 칸으로 센다', () => {
    assert.equal(dictationTarget([...FREE_INPUT, ...FREE_INPUT]).mode, 'append');
});

test('자유 입력 칸에는 적어 둔 글 뒤에 말한 그대로 잇는다', () => {
    assert.equal(appendTranscript('기존 메모', '검토 결과 조건부 적합입니다.'), '기존 메모 검토 결과 조건부 적합입니다.');
    assert.equal(appendTranscript('', '검토 결과 조건부 적합입니다.'), '검토 결과 조건부 적합입니다.');
});

// ---------------------------------------------------------------------------
// 칸이 여럿일 때 — LLM 에 보내는 글
// ---------------------------------------------------------------------------

test('요청 글에 받아쓴 말 · 칸 이름 · 지금 값이 들어간다', () => {
    const messages = buildFillMessages({
        fields: REQUEST_FORM,
        values: { contact: '010-1234-5678', customer_name: '' },
        transcript: ' 고객명은 한빛물산입니다 ',
        processName: '영업 제안서 작성',
        activityName: '고객 요청사항 입력',
        now: new Date(2026, 10, 11)
    });
    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, 'system');
    assert.match(messages[0].content, /"name":"customer_name"/);
    assert.match(messages[0].content, /"label":"고객명"/);
    assert.match(messages[0].content, /현재 값\(JSON\): \{"contact":"010-1234-5678"\}/);
    assert.match(messages[0].content, /오늘은 2026-11-11/);
    assert.match(messages[0].content, /말하지 않은 칸은 돌려주지 않는다/);
    assert.equal(messages[1].content, '받아쓴 글: "고객명은 한빛물산입니다"');
});

test('파일 칸 · 읽기 전용 칸은 LLM 에 알려 주지 않는다', () => {
    const fields = [...REQUEST_FORM, { name: 'reviewer', type: 'text-field', readonly: true }];
    const [system] = buildFillMessages({ fields, transcript: 'x' });
    assert.doesNotMatch(system.content, /"attachment"/);
    assert.doesNotMatch(system.content, /"reviewer"/);
});

// ---------------------------------------------------------------------------
// LLM 답을 칸 값으로
// ---------------------------------------------------------------------------

test('fields 모양의 답을 칸 값으로 바꾼다', () => {
    const reply = '{"fields":[{"name":"customer_name","value":"한빛물산"},{"name":"request_title","value":"회의실 가구 교체"}]}';
    assert.deepEqual(parseFillResponse(reply, REQUEST_FORM), { customer_name: '한빛물산', request_title: '회의실 가구 교체' });
});

test('```json 묶음이나 앞뒤 말이 붙어도 읽는다', () => {
    const reply = '채웠습니다.\n```json\n{"fields":[{"name":"contact","value":"02-123-4567"}]}\n```';
    assert.deepEqual(parseFillResponse(reply, REQUEST_FORM), { contact: '02-123-4567' });
});

test('양식에 없는 칸 · 파일 칸 · 읽기 전용 칸 · 빈 값은 버린다', () => {
    const fields = [...REQUEST_FORM, { name: 'reviewer', type: 'text-field', readonly: true }];
    const reply = JSON.stringify({
        fields: [
            { name: 'customer-name', value: '변형 이름' },
            { name: 'attachment', value: 'a.pdf' },
            { name: 'reviewer', value: '김민지' },
            { name: 'contact', value: '   ' },
            { name: 'request_title', value: null },
            { name: 'customer_name', value: '한빛물산' }
        ]
    });
    assert.deepEqual(parseFillResponse(reply, fields), { customer_name: '한빛물산' });
});

test('formValues 모양이나 평평한 모양도 받는다', () => {
    assert.deepEqual(parseFillResponse('{"formValues":{"contact":"1"}}', REQUEST_FORM), { contact: '1' });
    assert.deepEqual(parseFillResponse('{"contact":"2","nope":"x"}', REQUEST_FORM), { contact: '2' });
});

test('JSON 이 아니면 아무것도 채우지 않는다', () => {
    assert.deepEqual(parseFillResponse('잘 모르겠습니다', REQUEST_FORM), {});
    assert.deepEqual(parseFillResponse('', REQUEST_FORM), {});
    assert.deepEqual(parseFillResponse('{"fields":[', REQUEST_FORM), {});
});

test('말로 들은 날짜 · 시간을 칸 모양으로 바꾼다', () => {
    const now = new Date(2026, 10, 11);
    const date = { type: 'date-field' };
    const time = { type: 'time-field' };
    assert.equal(normalizeSpokenValue(date, '오늘', now), '2026-11-11');
    assert.equal(normalizeSpokenValue(date, '내일', now), '2026-11-12');
    assert.equal(normalizeSpokenValue(date, '2026년 12월 3일', now), '2026-12-03');
    assert.equal(normalizeSpokenValue(date, '12월 3일', now), '2026-12-03');
    assert.equal(normalizeSpokenValue(time, '오후 3시 30분', now), '15:30');
    assert.equal(normalizeSpokenValue(time, '9:5', now), '09:05');
    assert.equal(normalizeSpokenValue({ type: 'text-field' }, ' 그대로 ', now), '그대로');
});

test('날짜 칸은 답을 받을 때 바로 맞춘다', () => {
    const fields = [{ name: 'visit', label: '방문일', type: 'date-field' }, ...REQUEST_FORM];
    const reply = '{"fields":[{"name":"visit","value":"내일"}]}';
    assert.deepEqual(parseFillResponse(reply, fields, { now: new Date(2026, 10, 11) }), { visit: '2026-11-12' });
});

// ---------------------------------------------------------------------------
// 말하는 동안
// ---------------------------------------------------------------------------

test('미리 받아쓰기는 일정 간격으로, 앞 요청이 끝난 뒤에만 한다', () => {
    assert.equal(partialDue({ elapsedMs: 1000, sinceLastMs: 1000, inFlight: false }), false, '너무 이르다');
    assert.equal(partialDue({ elapsedMs: PARTIAL_EVERY_MS, sinceLastMs: PARTIAL_EVERY_MS, inFlight: false }), true);
    assert.equal(partialDue({ elapsedMs: 9000, sinceLastMs: 9000, inFlight: true }), false, '앞 요청이 아직이다');
    assert.equal(partialDue({ elapsedMs: 9000, sinceLastMs: 1000, inFlight: false }), false, '방금 보냈다');
});

test('길게 말하면 더는 미리 받아쓰지 않는다 — 같은 소리를 계속 다시 보내지 않게', () => {
    assert.equal(partialDue({ elapsedMs: PARTIAL_UNTIL_MS + 1, sinceLastMs: 10000, inFlight: false }), false);
});

test('녹음 시간과 한 줄 미리 보기', () => {
    assert.equal(formatElapsed(0), '0:00');
    assert.equal(formatElapsed(5400), '0:05');
    assert.equal(formatElapsed(65000), '1:05');
    assert.equal(tailText('짧은 말'), '짧은 말');
    assert.equal(tailText('가'.repeat(100), 10), `…${'가'.repeat(10)}`);
});

test('녹음 중에도 지금까지의 소리를 꺼낼 수 있다', async () => {
    let startedWith;
    class Recorder {
        constructor() {
            this.state = 'recording';
        }
        start(slice) {
            startedWith = slice;
            setTimeout(() => this.ondataavailable?.({ data: 'chunk-1' }), 0);
        }
        stop() {
            this.state = 'inactive';
            setTimeout(() => this.onstop?.(), 0);
        }
    }
    const win = {
        MediaRecorder: Recorder,
        Blob: class {
            constructor(parts) {
                this.parts = parts;
            }
        }
    };
    const nav = { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) } };
    const rec = await startRecording({ nav, win, timeslice: 1000 });
    assert.equal(startedWith, 1000);
    assert.equal(rec.peek(), null, '아직 조각이 없다');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(rec.peek().parts, ['chunk-1']);
    const blob = await rec.stop();
    assert.deepEqual(blob.parts, ['chunk-1']);
});

// ---------------------------------------------------------------------------
// 폼 속성 읽기
// ---------------------------------------------------------------------------

test("readonly · disabled 는 'false' 라고 적혀 있으면 꺼진 것이다", () => {
    assert.equal(isOnAttr(null), false);
    assert.equal(isOnAttr('false'), false);
    assert.equal(isOnAttr('true'), true);
    assert.equal(isOnAttr(''), true, '값 없이 속성만 있으면 켜진 것(HTML 방식)');
    assert.equal(isOnAttr('readonly'), true);
});

test('선택 칸의 items 속성을 고를 수 있는 값으로 읽는다', () => {
    assert.deepEqual(parseItemsAttr("[{'pass':'적합'},{'conditional':'조건부 적합'}]"), [
        { label: '적합', value: 'pass' },
        { label: '조건부 적합', value: 'conditional' }
    ]);
    assert.deepEqual(parseItemsAttr(''), []);
    assert.deepEqual(parseItemsAttr('깨진 값'), []);
});

test('녹음기를 못 만들면 실패로 알리고 받은 마이크는 놓는다', async () => {
    const stopped = [];
    const nav = { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped.push('track') }] }) } };
    const win = {
        MediaRecorder: class {
            constructor() {
                throw new Error('NotSupportedError');
            }
        }
    };
    const result = await startRecording({ nav, win });
    assert.deepEqual(result, { ok: false, reason: 'failed' });
    assert.deepEqual(stopped, ['track']);
});
