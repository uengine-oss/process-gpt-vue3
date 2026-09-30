/**
 * 저장 오류가 원인을 message 에 싣는가.
 *
 * 실제 사고: 저장 실패로 채팅이 멎었는데 화면에 보여 줄 원인이 'error in putObject'
 * 한 줄뿐이었다. 원인은 `cause` 속성에만 있었고, 번들된 코드에서는 그 값이 남지
 * 않았다. 사용자는 무엇 때문에 실패했는지도, 무엇을 해야 하는지도 알 수 없었다.
 *
 * 그래서 message 에도 적는다. 속성이 사라져도 원인은 남는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// 파일에서 클래스 정의만 꺼내 쓴다 — 모듈 전체는 supabase 전역에 의존한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'StorageBaseSupabase.js'), 'utf8');
const start = source.indexOf('class StorageBaseError');
const end = source.indexOf('\n}', source.indexOf('static describeCause')) + 2;
// eslint-disable-next-line no-eval
const StorageBaseError = (0, eval)(`(${source.slice(start, end)})`);

test('Error 원인이 message 에 실린다', () => {
    const e = new StorageBaseError('error in putObject', new Error('net::ERR_INSUFFICIENT_RESOURCES'), []);
    assert.match(e.message, /error in putObject/);
    assert.match(e.message, /ERR_INSUFFICIENT_RESOURCES/, 'cause 속성이 사라져도 원인이 남아야 한다');
});

test('PostgREST 가 주는 평범한 객체도 풀어 쓴다', () => {
    const e = new StorageBaseError('error in putObject', { message: 'permission denied', code: '42501' }, []);
    assert.match(e.message, /permission denied/);
    assert.match(e.message, /42501/);
});

test('원인이 없으면 message 를 건드리지 않는다', () => {
    assert.equal(new StorageBaseError('error in putObject', null, []).message, 'error in putObject');
    assert.equal(new StorageBaseError('error in putObject', undefined, []).message, 'error in putObject');
});

test('이미 들어 있는 원인을 두 번 적지 않는다', () => {
    const e = new StorageBaseError('error in putObject: permission denied', { message: 'permission denied' }, []);
    assert.equal(e.message.match(/permission denied/g).length, 1);
});

test('내용 없는 객체로 [object Object] 를 붙이지 않는다', () => {
    const e = new StorageBaseError('error in putObject', {}, []);
    assert.equal(e.message, 'error in putObject');
});

test('cause 속성도 그대로 둔다', () => {
    const inner = new Error('inner');
    assert.equal(new StorageBaseError('x', inner, []).cause, inner);
});

test('args 는 계속 보존된다', () => {
    const e = new StorageBaseError('x', new Error('y'), ['a', 'b']);
    assert.deepEqual(e.args, ['a', 'b']);
});
