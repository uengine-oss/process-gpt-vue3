import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { authHeaders, isRelative, isSelfOrigin, resolveUrl } from './http.js';

describe('isSelfOrigin', () => {
    it('앱 내부 주소를 알아본다 — 여기로 보내면 화면 HTML 이 돌아온다', () => {
        assert.equal(isSelfOrigin('https://localhost'), true);
        assert.equal(isSelfOrigin('http://localhost'), true);
        assert.equal(isSelfOrigin('http://localhost:8100'), true);
        assert.equal(isSelfOrigin(''), true);
    });

    it('진짜 서버 주소는 그대로 쓴다', () => {
        assert.equal(isSelfOrigin('https://acme.process-gpt.io'), false);
        assert.equal(isSelfOrigin('http://localhost.10.0.2.2.nip.io:8088'), false);
    });
});

describe('resolveUrl', () => {
    it('상대 경로 앞에 서버 주소를 붙인다', () => {
        assert.equal(
            resolveUrl('/memento/documents/list', 'https://acme.process-gpt.io'),
            'https://acme.process-gpt.io/memento/documents/list'
        );
    });

    it('절대 주소는 건드리지 않는다 — 부른 쪽이 이미 정한 것이다', () => {
        assert.equal(resolveUrl('https://x.test/a', 'https://acme.test'), 'https://x.test/a');
    });

    it('프로토콜 없는 //호스트 도 건드리지 않는다', () => {
        assert.equal(resolveUrl('//cdn.test/a', 'https://acme.test'), '//cdn.test/a');
    });

    it('서버 주소를 모르면 그대로 둔다', () => {
        assert.equal(resolveUrl('/a', ''), '/a');
    });

    it('끝의 빗금이 겹치지 않는다', () => {
        assert.equal(resolveUrl('/a', 'https://x.test/'), 'https://x.test/a');
    });
});

describe('isRelative', () => {
    it('구분한다', () => {
        assert.equal(isRelative('/a'), true);
        assert.equal(isRelative('a'), false);
        assert.equal(isRelative('https://x/a'), false);
    });
});

describe('authHeaders', () => {
    it('토큰과 조직을 싣는다 — 없으면 앞단이 401 로 끊는다', () => {
        assert.deepEqual(authHeaders({ token: 't', tenant: 'acme' }), {
            Authorization: 'Bearer t',
            'X-Tenant-Id': 'acme'
        });
    });

    it('토큰이 없으면 빈 Bearer 를 보내지 않는다 — 잘못된 토큰으로 취급된다', () => {
        assert.deepEqual(authHeaders({ token: '', tenant: 'acme' }), { 'X-Tenant-Id': 'acme' });
        assert.deepEqual(authHeaders({}), {});
    });
});
