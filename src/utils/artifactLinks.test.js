/**
 * 산출물 링크가 만료된 뒤에도 파일을 받을 수 있는가.
 *
 * 주소만 저장하던 때는 새로고침 한 번, 하루 지난 방 한 번에 파일이 사라졌다.
 * 여기서 지키는 것은 그 반대다 — 주소는 죽어도 파일은 살아 있다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactIdOf, artifactUrlOf, isArtifactUrlFresh, reissueArtifactUrl, usableArtifactUrl } from './artifactLinks.js';

// 실제 시계를 기준으로 삼는다 — usableArtifactUrl 은 지금 시각으로 만료를 본다.
const NOW = Date.now();

function fresh(url = 'https://signed.test/a.docx?token=1') {
    return {
        name: 'a.docx',
        url,
        file_id: 'artifacts/a.docx',
        url_expires_at: new Date(NOW + 3600 * 1000).toISOString()
    };
}

function expired() {
    return {
        name: 'a.docx',
        url: 'https://signed.test/a.docx?token=old',
        file_id: 'artifacts/a.docx',
        url_expires_at: new Date(NOW - 60 * 1000).toISOString()
    };
}

function issuer(url = 'https://signed.test/a.docx?token=new') {
    const calls = [];
    const request = async (fileId) => {
        calls.push(fileId);
        return { file_url: url, url_expires_at: new Date(NOW + 3600 * 1000).toISOString() };
    };
    return { calls, request };
}

test('만료되지 않은 주소는 그대로 쓴다', async () => {
    const file = fresh();
    const { calls, request } = issuer();

    assert.equal(isArtifactUrlFresh(file, NOW), true);
    assert.equal(await usableArtifactUrl(file, request), file.url);
    assert.deepEqual(calls, [], '살아 있는 주소로는 다시 묻지 않는다');
});

test('만료된 주소는 file_id 로 다시 발급받는다', async () => {
    const file = expired();
    const { calls, request } = issuer();

    assert.equal(isArtifactUrlFresh(file, NOW), false);
    assert.equal(await usableArtifactUrl(file, request), 'https://signed.test/a.docx?token=new');
    assert.deepEqual(calls, ['artifacts/a.docx']);
});

test('받은 주소를 레코드에 반영해 다음에 또 묻지 않는다', async () => {
    const file = expired();
    const { calls, request } = issuer();

    await usableArtifactUrl(file, request);
    await usableArtifactUrl(file, request);

    assert.equal(file.url, 'https://signed.test/a.docx?token=new');
    assert.equal(file.fileUrl, 'https://signed.test/a.docx?token=new');
    assert.deepEqual(calls, ['artifacts/a.docx'], '한 번만 묻는다');
});

test('곧 죽을 주소는 미리 바꾼다', () => {
    const file = fresh();
    file.url_expires_at = new Date(NOW + 5 * 1000).toISOString();

    assert.equal(isArtifactUrlFresh(file, NOW), false, '내려받는 데도 시간이 걸린다');
});

test('만료 시각이 없으면 만료가 없다는 뜻이다', async () => {
    // 옛 공개 버킷에 있던 산출물. 기존 대화의 레코드가 이 모양이다.
    const file = { name: 'old.pdf', url: 'https://public.test/old.pdf' };
    const { calls, request } = issuer();

    assert.equal(isArtifactUrlFresh(file, NOW), true);
    assert.equal(await usableArtifactUrl(file, request), 'https://public.test/old.pdf');
    assert.deepEqual(calls, []);
});

test('열쇠가 없으면 지금 주소가 전부다', async () => {
    const file = { name: 'old.pdf', url: 'https://public.test/old.pdf', url_expires_at: new Date(NOW - 1).toISOString() };
    const { calls, request } = issuer();

    assert.equal(artifactIdOf(file), '');
    assert.equal(await usableArtifactUrl(file, request), 'https://public.test/old.pdf');
    assert.deepEqual(calls, [], 'file_id 가 없으면 물어볼 곳이 없다');
});

test('발급에 실패해도 지어낸 주소를 돌려주지 않는다', async () => {
    const file = expired();
    const failing = async () => {
        throw new Error('502');
    };

    assert.equal(await reissueArtifactUrl(file, failing), '');
    // 손대지 않았으므로 옛 주소로라도 한 번 더 해 볼 수 있다.
    assert.equal(artifactUrlOf(file), 'https://signed.test/a.docx?token=old');
});

test('주소 없이 file_id 만 저장된 레코드도 받을 수 있다', async () => {
    // 방을 다시 열어 불러온 옛 메시지가 이렇게 남기도 한다.
    const file = { name: 'a.docx', file_id: 'artifacts/a.docx' };
    const { calls, request } = issuer();

    assert.equal(await usableArtifactUrl(file, request), 'https://signed.test/a.docx?token=new');
    assert.deepEqual(calls, ['artifacts/a.docx']);
});
