import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AUTO_DISMISS_MS, isSame, toBanner } from './banner.js';

const route = () => '/tasks/t-1';

describe('toBanner', () => {
    it('안드로이드가 주는 모양에서 제목·본문을 꺼낸다', () => {
        const b = toBanner({ title: '휴가 신청서 검토', body: '휴가 신청 프로세스', data: {} }, route);
        assert.equal(b.title, '휴가 신청서 검토');
        assert.equal(b.body, '휴가 신청 프로세스');
        assert.equal(b.route, '/tasks/t-1');
    });

    it('iOS 처럼 notification 안에 들어와도 읽는다', () => {
        const b = toBanner({ notification: { title: '승인 요청', body: '지출결의' } }, route);
        assert.equal(b.title, '승인 요청');
        assert.equal(b.body, '지출결의');
    });

    it('data 에만 담겨 와도 읽는다 — 서버가 그렇게도 보낸다', () => {
        const b = toBanner({ data: { title: '새 업무', body: '휴가신청' } }, route);
        assert.equal(b.title, '새 업무');
    });

    it('보여 줄 글이 없으면 배너를 만들지 않는다. 빈 배너는 방해만 된다', () => {
        assert.equal(toBanner({ data: {} }, route), null);
        assert.equal(toBanner(null, route), null);
    });

    it('제목이 없으면 최소한의 말이라도 붙인다', () => {
        assert.equal(toBanner({ body: '내용만 있음' }, route).title, '새 알림');
    });

    it('같은 알림을 구분할 식별자를 만든다', () => {
        const a = toBanner({ title: 'x', data: { notification_id: 'n-1' } }, route);
        const b = toBanner({ title: 'x', data: { notification_id: 'n-1' } }, route);
        assert.equal(a.id, b.id);
    });
});

describe('isSame', () => {
    it('같은 알림이 두 번 와도 하나로 본다', () => {
        assert.equal(isSame({ id: 'n-1' }, { id: 'n-1' }), true);
        assert.equal(isSame({ id: 'n-1' }, { id: 'n-2' }), false);
        assert.equal(isSame(null, { id: 'n-1' }), false);
    });
});

describe('AUTO_DISMISS_MS', () => {
    it('읽고 누를 시간은 주되 화면을 오래 가리지 않는다', () => {
        assert.ok(AUTO_DISMISS_MS >= 4000 && AUTO_DISMISS_MS <= 10000);
    });
});
