/**
 * 말로 입력하기.
 *
 * 지키려는 것
 *   - 마이크를 반드시 놓아 주는 것 (안 놓으면 녹음 표시가 계속 남는다)
 *   - 이미 적어 둔 글을 지우지 않는 것
 *   - 왜 안 되는지 할 수 있는 일로 말해 주는 것
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { appendTranscript, canRecord, isDenied, reasonText, startRecording, transcribe } from './voice.js';

function fakeWin({ stopped } = {}) {
    class Recorder {
        constructor() {
            this.state = 'recording';
            this.ondataavailable = null;
            this.onstop = null;
        }
        start() {
            setTimeout(() => this.ondataavailable?.({ data: 'chunk' }), 0);
        }
        stop() {
            this.state = 'inactive';
            setTimeout(() => this.onstop?.(), 0);
        }
    }
    return {
        MediaRecorder: Recorder,
        Blob: class {
            constructor(parts, opts) {
                this.parts = parts;
                this.type = opts?.type;
            }
        }
    };
}

function fakeNav(behaviour = {}) {
    return {
        mediaDevices: {
            getUserMedia: async () => {
                if (behaviour.error) throw behaviour.error;
                return { getTracks: () => [{ stop: () => behaviour.stopped?.push('track') }] };
            }
        }
    };
}

test('녹음 가능 여부를 본다', () => {
    assert.equal(canRecord(fakeNav(), fakeWin()), true);
    assert.equal(canRecord({}, fakeWin()), false);
    assert.equal(canRecord(fakeNav(), {}), false);
});

test('권한 거부를 다른 실패와 구분한다', () => {
    assert.equal(isDenied({ name: 'NotAllowedError' }), true);
    assert.equal(isDenied({ name: 'SecurityError' }), true);
    assert.equal(isDenied({ name: 'NotFoundError' }), false);
});

test('지원하지 않으면 그렇다고 말한다', async () => {
    const result = await startRecording({ nav: {}, win: {} });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unsupported');
});

test('권한을 거부하면 거부라고 말한다', async () => {
    const err = new Error('nope');
    err.name = 'NotAllowedError';

    const result = await startRecording({ nav: fakeNav({ error: err }), win: fakeWin() });

    assert.equal(result.reason, 'denied');
});

test('멈추면 마이크를 놓는다', async () => {
    // 놓지 않으면 안드로이드 상단에 녹음 표시가 계속 남아 사용자가 불안해한다.
    const stopped = [];
    const rec = await startRecording({ nav: fakeNav({ stopped }), win: fakeWin() });

    await rec.stop();

    assert.deepEqual(stopped, ['track']);
});

test('녹음된 소리를 덩어리로 돌려준다', async () => {
    const rec = await startRecording({ nav: fakeNav(), win: fakeWin() });
    await new Promise((r) => setTimeout(r, 5));

    const blob = await rec.stop();

    assert.ok(blob, '소리가 있어야 한다');
});

// ---------------------------------------------------------------------------
// 받아쓰기
// ---------------------------------------------------------------------------

test('받아쓴 글을 돌려준다', async () => {
    const result = await transcribe({}, { post: async () => ({ data: { transcript: '  안녕하세요  ' } }) });

    assert.deepEqual(result, { ok: true, text: '안녕하세요' });
});

test('소리가 없으면 보내지 않는다', async () => {
    let called = false;
    await transcribe(null, { post: async () => { called = true; return {}; } });

    assert.equal(called, false);
});

test('빈 결과는 실패로 본다', async () => {
    // 빈 글을 넣으면 사용자는 인식이 된 줄 알고 그대로 보낸다.
    const result = await transcribe({}, { post: async () => ({ data: { transcript: '   ' } }) });

    assert.equal(result.reason, 'empty');
});

test('서버 오류는 실패로 본다', async () => {
    const result = await transcribe({}, { post: async () => { throw new Error('500'); } });

    assert.equal(result.reason, 'failed');
});

// ---------------------------------------------------------------------------
// 이어 쓰기
// ---------------------------------------------------------------------------

test('적어 둔 글 뒤에 잇는다', () => {
    // 덮어쓰면 이미 적은 것이 사라진다.
    assert.equal(appendTranscript('먼저 쓴 글', '말한 내용'), '먼저 쓴 글 말한 내용');
});

test('빈 칸이면 그대로 넣는다', () => {
    assert.equal(appendTranscript('', '말한 내용'), '말한 내용');
    assert.equal(appendTranscript(null, '말한 내용'), '말한 내용');
});

test('받아쓴 것이 없으면 건드리지 않는다', () => {
    assert.equal(appendTranscript('먼저 쓴 글', ''), '먼저 쓴 글');
    assert.equal(appendTranscript('먼저 쓴 글', '   '), '먼저 쓴 글');
});

test('안내 문구는 할 수 있는 일을 말한다', () => {
    assert.match(reasonText('denied'), /허용/);
    assert.match(reasonText('unsupported'), /쓸 수 없/);
    assert.match(reasonText('empty'), /다시/);
});
