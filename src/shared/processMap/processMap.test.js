import test from 'node:test';
import assert from 'node:assert/strict';

import { filterGroups, toGroups, ungrouped } from './index.js';

const MAP = {
    mega_proc_list: [
        {
            id: '1',
            name: '국민권익위원회',
            major_proc_list: [
                {
                    id: 'complain_process',
                    name: '민원',
                    sub_proc_list: [
                        { id: 'p1', name: '국민신문고 프로세스' },
                        { id: 'p2', label: '옛 이름 칸' }
                    ]
                },
                { id: 'empty', name: '빈 분류', sub_proc_list: [] }
            ]
        }
    ]
};

test('대분류 › 중분류 를 한 줄 제목으로 편다', () => {
    const groups = toGroups(MAP);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].title, '국민권익위원회 › 민원');
    assert.deepEqual(groups[0].items.map((i) => i.name), ['국민신문고 프로세스', '옛 이름 칸']);
});

test('빈 분류는 만들지 않는다 — 눌러도 아무것도 없는 줄이 된다', () => {
    assert.equal(toGroups(MAP).some((g) => g.title.includes('빈 분류')), false);
});

test('자료가 없어도 깨지지 않는다', () => {
    assert.deepEqual(toGroups(null), []);
    assert.deepEqual(toGroups({}), []);
});

test('체계도에 없는 정의도 시작할 수 있어야 한다', () => {
    const out = ungrouped(MAP, [{ id: 'p1', name: '이미 있음' }, { id: 'p9', name: '분류 안 됨' }]);
    assert.deepEqual(out, [{ id: 'p9', name: '분류 안 됨' }]);
});

test('이름으로 걸러 낸다 — 수백 개를 훑을 수는 없다', () => {
    assert.equal(filterGroups(toGroups(MAP), '신문고')[0].items.length, 1);
    assert.deepEqual(filterGroups(toGroups(MAP), '없는이름'), []);
    assert.equal(filterGroups(toGroups(MAP), '').length, 1);
});

test('분류 이름으로도 찾을 수 있다', () => {
    assert.equal(filterGroups(toGroups(MAP), '민원')[0].items.length, 2);
});

test('식별자로도 찾는다 — 이름을 모르고 id 만 아는 경우가 흔하다', () => {
    const map = {
        mega_proc_list: [
            { name: 'A', major_proc_list: [{ name: 'B', sub_proc_list: [{ id: 'leave_request_process', name: '휴가 신청' }] }] }
        ]
    };
    assert.equal(filterGroups(toGroups(map), 'leave')[0].items.length, 1);
});
