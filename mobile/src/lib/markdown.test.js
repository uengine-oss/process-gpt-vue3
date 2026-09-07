import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { externalLinks, isBlank, normalizeSource, render } from './markdown.js';

// 파서·소독기는 브라우저에서만 돈다. 여기서는 이 파일이 정한 규칙만 본다.
const deps = { parse: (t) => `<p>${t}</p>`, sanitize: (h) => h };

describe('normalizeSource', () => {
    it('문자열은 그대로 쓴다', () => {
        assert.equal(normalizeSource('**요약**'), '**요약**');
    });

    it('{ msg } 로 싸인 것은 안의 글을 꺼낸다', () => {
        assert.equal(normalizeSource({ msg: '안녕하세요' }), '안녕하세요');
        assert.equal(normalizeSource({ text: '안녕' }), '안녕');
        assert.equal(normalizeSource({ content: '반가워' }), '반가워');
    });

    it('꺼낼 글이 없으면 빈 글이다 — [object Object] 를 보이지 않는다', () => {
        assert.equal(normalizeSource({ a: 1 }), '');
        assert.equal(normalizeSource(null), '');
        assert.equal(normalizeSource(undefined), '');
    });
});

describe('externalLinks', () => {
    it('링크를 바깥 창으로 연다', () => {
        const out = externalLinks('<a href="https://x.test">x</a>');
        assert.match(out, /target="_blank"/);
        assert.match(out, /rel="noopener noreferrer"/);
    });

    it('링크가 없으면 건드리지 않는다', () => {
        assert.equal(externalLinks('<p>hi</p>'), '<p>hi</p>');
    });
});

describe('render', () => {
    it('빈 글은 아무것도 만들지 않는다 — 빈 말풍선이 생기면 답이 온 것처럼 보인다', () => {
        assert.equal(render('   ', deps), '');
        assert.equal(render(null, deps), '');
    });

    it('마크다운을 파서에 넘기고 소독기를 거친다', () => {
        const seen = [];
        const out = render('# 제목', {
            parse: (t) => {
                seen.push(['parse', t]);
                return '<h1>제목</h1>';
            },
            sanitize: (h) => {
                seen.push(['sanitize', h]);
                return h;
            }
        });
        assert.deepEqual(seen, [
            ['parse', '# 제목'],
            ['sanitize', '<h1>제목</h1>']
        ]);
        assert.equal(out, '<h1>제목</h1>');
    });

    it('소독은 링크 손질 뒤에 온다 — 우리가 붙인 것도 검사를 받아야 한다', () => {
        let sanitized = '';
        render('link', {
            parse: () => '<a href="x">x</a>',
            sanitize: (h) => {
                sanitized = h;
                return h;
            }
        });
        assert.match(sanitized, /target="_blank"/);
    });
});

describe('isBlank', () => {
    it('공백뿐인 글은 비어 있다', () => {
        assert.equal(isBlank('  \n '), true);
        assert.equal(isBlank({ msg: '' }), true);
        assert.equal(isBlank('가'), false);
    });
});
