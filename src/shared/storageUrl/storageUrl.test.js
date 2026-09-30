import test from 'node:test';
import assert from 'node:assert/strict';

import {
    clearSignedUrlCache,
    createSignedStorageUrl,
    isStorageObjectUrl,
    parseStorageRef,
    resolveStorageUrl,
    SIGNED_URL_TTL_SECONDS
} from './index.js';

const HOST = 'https://abc.supabase.co';

function fakeClient(onSign) {
    return {
        storage: {
            from(bucket) {
                return {
                    createSignedUrl(path, expiresIn, options) {
                        return Promise.resolve(onSign(bucket, path, expiresIn, options));
                    }
                };
            }
        }
    };
}

test('경로만 주면 기본 버킷으로 읽는다', () => {
    assert.deepEqual(parseStorageRef('uploads/1699_ab12.pdf'), { bucket: 'files', path: 'uploads/1699_ab12.pdf' });
    assert.deepEqual(parseStorageRef('a.png', 'chat-images'), { bucket: 'chat-images', path: 'a.png' });
});

test('저장돼 있던 공개 URL 에서 버킷과 경로를 되찾는다', () => {
    assert.deepEqual(parseStorageRef(`${HOST}/storage/v1/object/public/files/uploads/x.pdf`), {
        bucket: 'files',
        path: 'uploads/x.pdf'
    });
    assert.deepEqual(parseStorageRef(`${HOST}/storage/v1/object/public/chat-images/uploads/%EA%B3%84%ED%9A%8D.png`), {
        bucket: 'chat-images',
        path: 'uploads/계획.png'
    });
});

test('만료된 서명 URL 도 되돌려 다시 서명할 수 있다', () => {
    assert.deepEqual(parseStorageRef(`${HOST}/storage/v1/object/sign/files/uploads/x.pdf?token=eyJ.aaa.bbb`), {
        bucket: 'files',
        path: 'uploads/x.pdf'
    });
});

test('서명할 대상이 아닌 값은 걸러 낸다', () => {
    assert.equal(parseStorageRef(''), null);
    assert.equal(parseStorageRef(null), null);
    assert.equal(parseStorageRef('data:image/png;base64,AAAA'), null);
    assert.equal(parseStorageRef('blob:https://app/1-2-3'), null);
    assert.equal(parseStorageRef('/images/defaultUser.png'), null); // 앱이 서비스하는 정적 파일
    assert.equal(parseStorageRef('https://example.com/report.pdf'), null); // 바깥 주소
    assert.equal(parseStorageRef(`${HOST}/storage/v1/object/public/files`), null); // 버킷만으로는 객체가 아니다
});

test('첨부 객체는 bucket·path 를 그대로 쓴다', () => {
    assert.deepEqual(parseStorageRef({ path: 'uploads/x.pdf', bucket: 'files' }), { bucket: 'files', path: 'uploads/x.pdf' });
    assert.deepEqual(parseStorageRef({ file_path: 'p/x.pdf', file_bucket: 'files' }), { bucket: 'files', path: 'p/x.pdf' });
    // 경로 칸에 절대 URL 이 들어 있던 레거시 값
    assert.deepEqual(parseStorageRef({ path: `${HOST}/storage/v1/object/public/chat-images/a.png` }), {
        bucket: 'chat-images',
        path: 'a.png'
    });
});

test('우리 Storage 주소인지 가려낸다', () => {
    assert.equal(isStorageObjectUrl(`${HOST}/storage/v1/object/public/files/a.pdf`), true);
    assert.equal(isStorageObjectUrl('https://example.com/a.pdf'), false);
    assert.equal(isStorageObjectUrl('uploads/a.pdf'), false);
});

test('서명 URL 을 만들고, 같은 파일은 다시 만들지 않는다', async () => {
    clearSignedUrlCache();
    let calls = 0;
    const client = fakeClient((bucket, path, expiresIn) => {
        calls += 1;
        assert.equal(expiresIn, SIGNED_URL_TTL_SECONDS);
        return { data: { signedUrl: `${HOST}/storage/v1/object/sign/${bucket}/${path}?token=t${calls}` }, error: null };
    });

    const a = await createSignedStorageUrl('files', 'uploads/x.pdf', { client });
    const b = await createSignedStorageUrl('files', 'uploads/x.pdf', { client });
    assert.equal(a, b);
    assert.equal(calls, 1);
});

test('동시에 들어온 요청은 한 번만 서명한다', async () => {
    clearSignedUrlCache();
    let calls = 0;
    const client = fakeClient((bucket, path) => {
        calls += 1;
        return { data: { signedUrl: `${HOST}/storage/v1/object/sign/${bucket}/${path}?token=t` }, error: null };
    });

    const [a, b, c] = await Promise.all([
        createSignedStorageUrl('files', 'uploads/y.pdf', { client }),
        createSignedStorageUrl('files', 'uploads/y.pdf', { client }),
        createSignedStorageUrl('files', 'uploads/y.pdf', { client })
    ]);
    assert.equal(a, b);
    assert.equal(b, c);
    assert.equal(calls, 1);
});

test('서명에 실패해도 던지지 않는다 — 첨부 하나가 화면을 멈추면 안 된다', async () => {
    clearSignedUrlCache();
    const client = fakeClient(() => ({ data: null, error: { message: 'not found' } }));
    assert.equal(await createSignedStorageUrl('files', 'uploads/none.pdf', { client }), '');
});

test('옛 공개 URL 을 넣으면 새 서명 URL 이 나온다', async () => {
    clearSignedUrlCache();
    const client = fakeClient((bucket, path) => ({
        data: { signedUrl: `${HOST}/storage/v1/object/sign/${bucket}/${path}?token=fresh` },
        error: null
    }));

    const url = await resolveStorageUrl(`${HOST}/storage/v1/object/public/files/uploads/x.pdf`, { client });
    assert.equal(url, `${HOST}/storage/v1/object/sign/files/uploads/x.pdf?token=fresh`);
});

test('서명할 필요가 없는 값은 그대로 돌려준다', async () => {
    clearSignedUrlCache();
    const client = fakeClient(() => {
        throw new Error('서명하면 안 된다');
    });

    assert.equal(await resolveStorageUrl('', { client }), '');
    assert.equal(await resolveStorageUrl('/images/defaultUser.png', { client }), '/images/defaultUser.png');
    assert.equal(await resolveStorageUrl('https://example.com/a.pdf', { client }), 'https://example.com/a.pdf');
    assert.equal(await resolveStorageUrl('data:image/png;base64,AA', { client }), 'data:image/png;base64,AA');
});

test('Supabase 가 없으면 조용히 빈 주소를 준다', async () => {
    clearSignedUrlCache();
    assert.equal(await createSignedStorageUrl('files', 'uploads/x.pdf', { client: null }), '');
});
