import test from 'node:test';
import assert from 'node:assert/strict';
import { isSectionLabel, looksLikeMarkdown, markdownToHtml, normalizeMarkdown } from './index.js';

// 2026-11-11 녹화(t098)에 나온 에이전트 검토 글의 모양 그대로
const REVIEW = [
    '검토 결과: 조건부 적합입니다.',
    '적합한 점:',
    '- 핵심 요구사항을 반영했습니다.',
    '- 시범 적용 범위가 타당합니다.',
    '보완이 필요한 사항:',
    '1. 설비 연동 방식을 구체화해야 합니다.',
    '2. 입력 담당자를 명시해야 합니다.',
    '권고 후속 조치:',
    '- 미팅에서 확정합니다.',
    '참고 근거: 이전 요구사항과 대조했습니다.'
].join('\n');

test('콜론으로 끝나는 짧은 줄만 줄 머리다', () => {
    assert.equal(isSectionLabel('적합한 점:'), true);
    assert.equal(isSectionLabel('보완이 필요한 사항：'), true);
    assert.equal(isSectionLabel('검토 결과: 조건부 적합입니다.'), false);
    assert.equal(isSectionLabel('- 항목:'), false);
    assert.equal(isSectionLabel('## 제목:'), false);
    assert.equal(isSectionLabel('**이미 굵게:**'), false);
    assert.equal(isSectionLabel('가'.repeat(41) + ':'), false);
});

test('줄 머리 다음 줄 머리가 앞 목록 항목 안으로 빨려 들어가지 않는다', () => {
    const html = markdownToHtml(REVIEW);
    const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    assert.equal(items.length, 5);
    assert.ok(
        items.every((li) => !/보완이 필요한|권고 후속/.test(li)),
        '줄 머리가 li 안에 있다: ' + items.join(' | ')
    );
    assert.match(html, /<p class="md-section"><strong>적합한 점:<\/strong><\/p>/);
    assert.match(html, /<p class="md-section"><strong>보완이 필요한 사항:<\/strong><\/p>/);
    assert.match(html, /<p class="md-section"><strong>권고 후속 조치:<\/strong><\/p>/);
    assert.equal((html.match(/<ul>/g) || []).length, 2);
    assert.equal((html.match(/<ol>/g) || []).length, 1);
    // 내용이 있는 콜론 줄은 그냥 문단 글
    assert.match(html, /<p>검토 결과: 조건부 적합입니다.<\/p>/);
    assert.match(html, /<p>참고 근거: 이전 요구사항과 대조했습니다.<\/p>/);
});

test('2. 로 시작해도 문단 다음의 번호 목록이 목록으로 그려진다', () => {
    const html = markdownToHtml('앞 문단입니다.\n2. 둘째\n3. 셋째');
    assert.match(html, /<ol start="2">/);
    assert.equal((html.match(/<li>/g) || []).length, 2);
});

test('들여 쓴 하위 목록과 이어 쓰기는 앞 항목에 남는다', () => {
    const html = markdownToHtml('- 위\n  - 아래\n  이어서\n다음 문단');
    assert.match(html, /<li>위[\s\S]*<ul>\s*<li>아래/);
    assert.match(html, /<p>다음 문단<\/p>/);
});

test('• 글머리도 목록으로, 코드 블록 안은 그대로', () => {
    assert.equal(normalizeMarkdown('메모\n• 하나\n• 둘'), '메모\n\n- 하나\n- 둘');
    const fenced = '```\n적합한 점:\n- x\n```';
    assert.equal(normalizeMarkdown(fenced), fenced);
});

test('여러 줄 줄 머리 글이나 마크다운 표시가 있을 때만 마크다운으로 그린다', () => {
    assert.equal(looksLikeMarkdown('접수했습니다.'), false);
    assert.equal(looksLikeMarkdown('검토 결과: 적합'), false);
    assert.equal(looksLikeMarkdown('요약:\n문제 없음'), true);
    assert.equal(looksLikeMarkdown('- 하나'), true);
    assert.equal(looksLikeMarkdown(''), false);
});

test('줄바꿈은 전역 marked 설정과 상관없이 늘 살린다', () => {
    assert.match(markdownToHtml('첫 줄\n둘째 줄'), /첫 줄<br>\s*둘째 줄/);
});
