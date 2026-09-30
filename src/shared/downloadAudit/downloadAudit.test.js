import test from 'node:test';
import assert from 'node:assert/strict';

import { DOWNLOAD_ACTIONS, recordFileDownload } from './index.js';

function fakeClient(onRpc) {
    const calls = [];
    return {
        calls,
        rpc(name, params) {
            calls.push({ name, params });
            return Promise.resolve(onRpc ? onRpc(name, params) : { error: null });
        }
    };
}

test('RPC 에 파일 정보만 보낸다 — 사용자/IP 는 서버가 채운다', async () => {
    const client = fakeClient();
    const ok = await recordFileDownload({
        bucket: 'files',
        path: 'uploads/1_a.pdf',
        fileName: '보고서.pdf',
        action: DOWNLOAD_ACTIONS.DOWNLOAD,
        metadata: { source: 'test' },
        client
    });

    assert.equal(ok, true);
    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].name, 'record_file_download');
    assert.deepEqual(client.calls[0].params, {
        p_bucket: 'files',
        p_path: 'uploads/1_a.pdf',
        p_file_name: '보고서.pdf',
        p_action: 'download',
        p_metadata: { source: 'test' }
    });
    // 위조 가능한 값을 보내지 않는다
    const keys = Object.keys(client.calls[0].params);
    for (const forbidden of ['p_user_id', 'p_email', 'p_ip_address', 'p_user_agent']) {
        assert.ok(!keys.includes(forbidden), `${forbidden} 을 보내면 안 된다`);
    }
});

test('액션 기본값은 download, 파일명이 없으면 null', async () => {
    const client = fakeClient();
    await recordFileDownload({ bucket: 'files', path: 'uploads/x.pdf', client });
    assert.equal(client.calls[0].params.p_action, 'download');
    assert.equal(client.calls[0].params.p_file_name, null);
    assert.deepEqual(client.calls[0].params.p_metadata, {});
});

test('버킷이나 경로가 없으면 부르지 않는다', async () => {
    const client = fakeClient();
    assert.equal(await recordFileDownload({ path: 'uploads/x.pdf', client }), false);
    assert.equal(await recordFileDownload({ bucket: 'files', client }), false);
    assert.equal(await recordFileDownload({ client }), false);
    assert.equal(client.calls.length, 0);
});

test('클라이언트가 없으면 조용히 넘어간다 (다운로드를 막지 않는다)', async () => {
    assert.equal(await recordFileDownload({ bucket: 'files', path: 'x', client: null }), false);
    assert.equal(await recordFileDownload(), false);
});

test('RPC 오류/예외를 밖으로 던지지 않는다', async () => {
    const failing = fakeClient(() => ({ error: { message: 'function does not exist' } }));
    assert.equal(await recordFileDownload({ bucket: 'files', path: 'x', client: failing }), false);

    const throwing = {
        rpc() {
            throw new Error('network down');
        }
    };
    assert.equal(await recordFileDownload({ bucket: 'files', path: 'x', client: throwing }), false);
});
