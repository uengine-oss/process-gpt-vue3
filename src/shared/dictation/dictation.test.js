/**
 * 업무 화면의 받아쓰기 — 받아쓴 글을 어디에 어떻게 넣는가.
 *
 * 지키려는 것
 *   - 자유 입력(글 칸 하나)에는 말한 그대로, 적어 둔 글 뒤에 잇는다. LLM 이 다시 쓰지 않는다.
 *   - 칸이 여럿이면 말한 칸만 채운다. 말하지 않은 칸 · 양식에 없는 칸 · 읽기 전용 칸은 건드리지 않는다.
 *   - LLM 답을 기다리는 동안 사람이 쓴 칸은 덮어쓰지 않는다.
 *   - 여러 줄 글 칸의 이미 적힌 글은 한 글자도 바꾸지 않고 뒤에 잇기만 한다. 한 줄 칸은 말한 값으로 바꾼다.
 *   - 말하는 동안 미리 받아쓰기는 쌓이지 않고, 길어지면 멈춘다.
 *   - 녹음 중에도 지금까지의 소리를 꺼낼 수 있다(미리 보기).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PARTIAL_EVERY_MS,
    PARTIAL_UNTIL_MS,
    appendTranscript,
    awaitGeneration,
    buildFillMessages,
    dictationTarget,
    formatElapsed,
    isOnAttr,
    mergeFill,
    normalizeSpokenValue,
    parseFillResponse,
    parseItemsAttr,
    partialDue,
    snapshotValues,
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

test('여러 줄 글이나 목록으로 끝나는 글 뒤에는 빈 줄을 두고 새 문단으로 잇는다 — 마지막 글머리 항목 안으로 들어가지 않게', () => {
    const draft = ['반영 계획:', '1. 설비 연동 방식을 부록 A에 정리합니다.', '', '남은 확인 사항:', '- 견적과 일정은 10월 23일 미팅 뒤 확정합니다.'].join('\n');
    const out = appendTranscript(`${draft}\n`, '검토 결과 조건부 적합입니다.');
    assert.equal(out, `${draft}\n\n검토 결과 조건부 적합입니다.`);
    // 마크다운으로 읽어도 말한 글이 목록 밖의 새 문단이다(마지막 줄이 글머리로 시작하지 않고 앞에 빈 줄)
    const lines = out.split('\n');
    assert.equal(lines[lines.length - 2], '');
    assert.equal(lines[lines.length - 1], '검토 결과 조건부 적합입니다.');
    // 한 줄이지만 글머리 항목이면 같은 까닭으로 새 문단
    assert.equal(appendTranscript('- 첫 항목', '덧붙인 말'), '- 첫 항목\n\n덧붙인 말');
    // 평범한 한 줄은 띄어 잇는다
    assert.equal(appendTranscript('1차 검토 완료.', '덧붙인 말'), '1차 검토 완료. 덧붙인 말');
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

test('여러 줄 글 칸에는 새로 넣을 말만, 한 줄 칸 · 날짜 칸에는 값 전체를 달라고 칸마다 적는다', () => {
    const fields = [...REQUEST_FORM, { name: 'visit', label: '방문일', type: 'date-field' }];
    const [system] = buildFillMessages({ fields, values: { request_detail: '기존 메모' }, transcript: 'x' });
    assert.match(system.content, /"name":"request_detail","label":"요청 상세 내용","type":"textarea-field","fill":"append"/);
    assert.match(system.content, /"name":"customer_name","label":"고객명","type":"text-field","fill":"replace"/, '한 줄 칸은 바꾼다');
    assert.match(system.content, /"name":"visit","label":"방문일","type":"date-field","fill":"replace"\}/, '날짜 칸은 바꾼다');
    assert.match(system.content, /새로 넣을 말만/);
    assert.match(system.content, /현재 값은 고치지 않는다/);
    assert.doesNotMatch(system.content, /이어 쓴 전체 값을 돌려준다/);
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

test('적힌 날짜가 먼저고, 상대 날짜는 값 전체가 그 말일 때만 읽는다', () => {
    const now = new Date(2026, 10, 11);
    const date = { type: 'date-field' };
    // 「내일」 이 들어 있지만 「내일모레」 다 — 하루가 틀리면 안 된다
    assert.equal(normalizeSpokenValue(date, '내일모레', now), '2026-11-13');
    assert.equal(normalizeSpokenValue(date, '모레', now), '2026-11-13');
    // 설명에 「오늘」 이 섞여도 적힌 날짜를 쓴다
    assert.equal(normalizeSpokenValue(date, '2026-11-20 (오늘부터 9일 뒤)', now), '2026-11-20');
    assert.equal(normalizeSpokenValue(date, '12월 3일, 내일 말고', now), '2026-12-03');
    // 조사가 붙은 상대 날짜
    assert.equal(normalizeSpokenValue(date, '내일까지', now), '2026-11-12');
    assert.equal(normalizeSpokenValue(date, '오늘이요.', now), '2026-11-11');
    // 상대 날짜가 문장 속에 섞여 있으면 짐작하지 않는다
    assert.equal(normalizeSpokenValue(date, '오늘 말고 다음 주', now), '오늘 말고 다음 주');
});

test('날짜 칸은 답을 받을 때 바로 맞춘다', () => {
    const fields = [{ name: 'visit', label: '방문일', type: 'date-field' }, ...REQUEST_FORM];
    const reply = '{"fields":[{"name":"visit","value":"내일"}]}';
    assert.deepEqual(parseFillResponse(reply, fields, { now: new Date(2026, 10, 11) }), { visit: '2026-11-12' });
});

// ---------------------------------------------------------------------------
// 답을 넣을 때 — 기다리는 사이 사람이 쓴 글을 지킨다
// ---------------------------------------------------------------------------

test('답을 기다리는 동안 사람이 고친 칸은 덮어쓰지 않고 건너뛴다', () => {
    const snapshot = snapshotValues(REQUEST_FORM, { customer_name: '', request_title: '', request_detail: '' });
    // 요청을 보낸 뒤 사람이 제안 제목을 직접 쓰기 시작했다
    const current = { customer_name: '', request_title: '사람이 쓰던 제목', request_detail: '' };
    const patch = { customer_name: '한빛물산', request_title: '회의실 가구 교체' };
    const merged = mergeFill(patch, { fields: REQUEST_FORM, snapshot, current });
    assert.deepEqual(merged.values, { customer_name: '한빛물산' });
    assert.deepEqual(merged.applied, ['customer_name']);
    assert.deepEqual(merged.skipped, ['request_title']);
});

test('요청 때 값은 복사본이다 — 같은 폼 객체가 그 자리에서 바뀌어도 「바뀌었다」 를 안다', () => {
    const formData = { request_detail: '처음 글', contact: '' };
    const snapshot = snapshotValues(REQUEST_FORM, formData);
    formData.request_detail = '처음 글 그리고 사람이 더 쓴 글';
    const merged = mergeFill({ request_detail: '말한 글' }, { fields: REQUEST_FORM, snapshot, current: formData });
    assert.deepEqual(merged.values, {});
    assert.deepEqual(merged.skipped, ['request_detail']);
    assert.equal(formData.request_detail, '처음 글 그리고 사람이 더 쓴 글');
});

test('이미 글이 있는 글 칸은 기존 글을 그대로 두고 새 말만 뒤에 잇는다', () => {
    const values = { request_detail: '회의실 의자 12개 교체.' };
    const snapshot = snapshotValues(REQUEST_FORM, values);
    const merged = mergeFill({ request_detail: '책상도 4개 함께 바꿔 주세요.' }, { fields: REQUEST_FORM, snapshot, current: values });
    assert.equal(merged.values.request_detail, '회의실 의자 12개 교체. 책상도 4개 함께 바꿔 주세요.');
    assert.deepEqual(merged.applied, ['request_detail']);
});

test('LLM 이 기존 글을 앞에 붙여 돌려줘도 기존 글은 한 번만, 고쳐 쓴 글은 기존 글을 바꾸지 못한다', () => {
    const values = { request_detail: '회의실 의자 12개 교채.' };
    const snapshot = snapshotValues(REQUEST_FORM, values);
    // 기존 글을 그대로 앞에 붙여 왔다 → 뒷부분만 잇는다
    const echoed = mergeFill({ request_detail: '회의실 의자 12개 교채. 책상도요.' }, { fields: REQUEST_FORM, snapshot, current: values });
    assert.equal(echoed.values.request_detail, '회의실 의자 12개 교채. 책상도요.');
    // 맞춤법을 고친다며 기존 글을 다시 써 왔다 → 기존 글(「교채」)은 그대로 남는다
    const rewritten = mergeFill({ request_detail: '회의실 의자 12개 교체. 책상도요.' }, { fields: REQUEST_FORM, snapshot, current: values });
    assert.ok(rewritten.values.request_detail.startsWith('회의실 의자 12개 교채.'), rewritten.values.request_detail);
    // 이미 적힌 말을 그대로 돌려줬다 → 넣을 것이 없다
    const same = mergeFill({ request_detail: '회의실 의자 12개 교채.' }, { fields: REQUEST_FORM, snapshot, current: values });
    assert.deepEqual(same, { values: {}, applied: [], skipped: [] });
});

test('한 줄 칸은 이미 값이 있어도 말한 값으로 바꾼다 — 「고객명은 한빛물산」 이 「홍길동 한빛물산」 이 되지 않게', () => {
    const values = { customer_name: '홍길동', request_title: '신제품 공급 제안 요청', request_detail: '기존 상세' };
    const snapshot = snapshotValues(REQUEST_FORM, values);
    const merged = mergeFill(
        { customer_name: '한빛물산', request_title: '회의실 가구 교체' },
        { fields: REQUEST_FORM, snapshot, current: values }
    );
    assert.deepEqual(merged.values, { customer_name: '한빛물산', request_title: '회의실 가구 교체' });
    // 바꾸는 칸도 답을 기다리는 사이 사람이 고쳤으면 건너뛴다
    const typing = { ...values, request_title: '신제품 공급 제안 요청 (사람이 고쳐 씀)' };
    const guarded = mergeFill({ request_title: '회의실 가구 교체' }, { fields: REQUEST_FORM, snapshot, current: typing });
    assert.deepEqual(guarded, { values: {}, applied: [], skipped: ['request_title'] });
});

test('여러 줄 칸에 이을 때 기존 글이 목록으로 끝나면 새 문단으로 잇는다', () => {
    const values = { request_detail: '요청 사항:\n- 의자 12개 교체' };
    const snapshot = snapshotValues(REQUEST_FORM, values);
    const merged = mergeFill({ request_detail: '책상도 4개 함께 바꿔 주세요.' }, { fields: REQUEST_FORM, snapshot, current: values });
    assert.equal(merged.values.request_detail, '요청 사항:\n- 의자 12개 교체\n\n책상도 4개 함께 바꿔 주세요.');
});

test('빈 글 칸은 받은 값을 그대로, 날짜 · 선택 칸은 말한 값으로 바꾼다', () => {
    const fields = [
        ...REQUEST_FORM,
        { name: 'visit', label: '방문일', type: 'date-field' },
        { name: 'grade', label: '등급', type: 'select-field', options: [{ label: 'A', value: 'a' }] },
        { name: 'qty', label: '수량', type: 'text-field', inputType: 'number' }
    ];
    const values = { customer_name: null, visit: '2026-11-12', grade: 'b', qty: '3' };
    const snapshot = snapshotValues(fields, values);
    const merged = mergeFill(
        { customer_name: '한빛물산', visit: '2026-11-20', grade: 'a', qty: '5' },
        { fields, snapshot, current: values }
    );
    assert.deepEqual(merged.values, { customer_name: '한빛물산', visit: '2026-11-20', grade: 'a', qty: '5' });
    assert.deepEqual(merged.skipped, []);
});

test('빈 값의 모양이 달라도(null · \'\' · undefined) 바뀐 것으로 보지 않는다', () => {
    const snapshot = snapshotValues(REQUEST_FORM, { customer_name: null });
    const merged = mergeFill({ customer_name: '한빛물산' }, { fields: REQUEST_FORM, snapshot, current: { customer_name: '' } });
    assert.deepEqual(merged.applied, ['customer_name']);
    // 여러 값 칸(배열)은 안까지 견준다
    const fields = [{ name: 'tags', type: 'checkbox-field' }];
    const snap = snapshotValues(fields, { tags: ['a'] });
    assert.deepEqual(mergeFill({ tags: ['b'] }, { fields, snapshot: snap, current: { tags: ['a'] } }).applied, ['tags']);
    assert.deepEqual(mergeFill({ tags: ['b'] }, { fields, snapshot: snap, current: { tags: ['a', 'c'] } }).skipped, ['tags']);
});

// ---------------------------------------------------------------------------
// LLM 요청 하나를 기다린다
// ---------------------------------------------------------------------------

test('generate() 가 XHR 을 열기 전에 던지면 바로 실패로 돌린다 — 60초 기다리지 않는다', async () => {
    const started = Date.now();
    const unhandled = [];
    const onUnhandled = (e) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
        await assert.rejects(
            awaitGeneration(
                () => ({
                    generate: async () => {
                        throw new Error('config read failed');
                    }
                }),
                { timeoutMs: 60000 }
            ),
            /config read failed/
        );
        // 동기로 던져도 같다
        await assert.rejects(
            awaitGeneration(() => {
                throw new Error('constructor failed');
            }),
            /constructor failed/
        );
        await new Promise((r) => setTimeout(r, 10));
    } finally {
        process.off('unhandledRejection', onUnhandled);
    }
    assert.ok(Date.now() - started < 1000, '시간 초과까지 기다리지 않았다');
    assert.deepEqual(unhandled, [], '처리 안 된 거부가 남지 않는다');
});

test('답 · 빈 답 · 오류 · 시간 초과', async () => {
    const reply = (fn) => (client) => ({ generate: async () => fn(client), stop: () => undefined });
    assert.equal(await awaitGeneration(reply((c) => c.onGenerationFinished('{"fields":[]}'))), '{"fields":[]}');
    await assert.rejects(awaitGeneration(reply((c) => c.onGenerationFinished(''))), /empty reply/);
    await assert.rejects(awaitGeneration(reply((c) => c.onError({ message: '502' }))), /502/);
    let stopped = false;
    await assert.rejects(
        awaitGeneration(() => ({ generate: async () => undefined, stop: () => (stopped = true) }), { timeoutMs: 20 }),
        /timeout/
    );
    assert.equal(stopped, true, '시간이 지나면 요청을 멈춘다');
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
