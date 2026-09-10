/**
 * 패널 종류를 정하는 규칙 검증.
 *
 * 여기서 지키려는 것은 하나다: **승인해야 할 것이 체크박스로 뜨지 않는 것.**
 * 실제로 났던 버그이고(2026-07), 화면마다 규칙을 따로 두면 반드시 다시 난다.
 *
 * 실행: node --test src/shared/hitl/
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHitlPanel,
    isCandidateCategory,
    parseAskUser,
    parseHumanInputQuestion,
    parseMultiProcessHitl,
    shouldRestoreFromAssistantContent
} from './index.js';

// ---------------------------------------------------------------------------
// 승인이냐 선택이냐 — 이 파일의 요점
// ---------------------------------------------------------------------------

test('컨설팅 초안이 [제목] 머리글을 써도 승인으로 본다', () => {
    // 모델이 초안을 이렇게 포맷하는 일이 간헐적으로 있었고, 그때마다 승인 버튼이
    // 사라지고 체크박스가 떴다. 사용자는 진행시킬 방법을 잃는다.
    const draft = [
        '휴가 신청 프로세스 초안입니다. 이대로 진행할까요?',
        '',
        '[진행 단계]',
        '• 신청서 작성: 신청자가 기간과 사유를 입력',
        '• 팀장 승인: 팀장이 승인 또는 반려',
        '• 인사 등록: 인사팀이 연차를 차감'
    ].join('\n');

    const panel = buildHitlPanel({ question: '이대로 진행할까요?', context: draft });

    assert.equal(panel.kind, 'approve_reject_with_edit');
    assert.ok(panel.context.includes('팀장 승인'), '초안 본문이 패널에 담겨야 한다');
});

test('알려진 후보 카테고리가 있으면 선택으로 본다', () => {
    const text = [
        '추가할 항목을 골라주세요',
        '',
        '[스킬]',
        '• 연차관리: 구글 시트에서 잔여 연차를 조회',
        '',
        '[에이전트]',
        '• 인사담당: 인사 규정을 아는 에이전트'
    ].join('\n');

    const panel = buildHitlPanel({ question: text });

    assert.equal(panel.kind, 'select_items');
    assert.equal(panel.items.length, 2);
    assert.ok(panel.items[0].label.startsWith('[스킬]'));
});

test('후보가 하나도 없으면 승인으로 본다', () => {
    const panel = buildHitlPanel({ question: '이 내용으로 진행할까요?', context: '평범한 문장입니다.' });

    assert.equal(panel.kind, 'approve_reject_with_edit');
    assert.deepEqual(panel.items, []);
});

test('불릿만 있고 카테고리가 없으면 선택지가 아니라 본문이다', () => {
    // 번호나 불릿은 초안의 서술일 뿐이다. 이것을 선택지로 오인하면 승인이 사라진다.
    const panel = buildHitlPanel({
        question: '검토 부탁드립니다',
        context: '• 첫째 단계\n• 둘째 단계\n• 셋째 단계'
    });

    assert.equal(panel.kind, 'approve_reject_with_edit');
});

// ---------------------------------------------------------------------------
// 구조화된 options 가 프로즈보다 우선
// ---------------------------------------------------------------------------

test('options 가 오면 문자열 규칙을 지키지 않아도 선택으로 본다', () => {
    const panel = buildHitlPanel({
        question: '무엇을 추가할까요?',
        options: [
            { label: '연차관리', description: '시트 연동' },
            { label: '전자결재' }
        ],
        multiSelect: true
    });

    assert.equal(panel.kind, 'select_items');
    assert.equal(panel.items.length, 2);
    assert.equal(panel.allowMultiple, true);
});

test('options 의 다중선택 여부는 호출자가 정한다', () => {
    const panel = buildHitlPanel({
        question: '하나만 고르세요',
        options: [{ label: 'A' }, { label: 'B' }],
        multiSelect: false
    });

    assert.equal(panel.allowMultiple, false);
});

test('라벨이 없는 option 은 버린다', () => {
    const panel = buildHitlPanel({
        question: '고르세요',
        options: [{ label: '쓸 수 있는 것' }, { description: '라벨이 없다' }]
    });

    assert.equal(panel.items.length, 1);
});

test('프로즈 후보는 항상 다중선택이다', () => {
    const panel = buildHitlPanel({ question: '고르세요\n\n[스킬]\n• 하나: 설명' });

    assert.equal(panel.allowMultiple, true);
});

// ---------------------------------------------------------------------------
// 파싱 세부
// ---------------------------------------------------------------------------

test('이름이 같은 후보도 서로 다른 것으로 다룬다', () => {
    // id 가 같으면 하나를 고를 때 같은 이름이 한꺼번에 선택된다.
    const parsed = parseHumanInputQuestion('제목\n\n[스킬]\n• 승인: 첫 번째\n• 승인: 두 번째');

    assert.equal(parsed.items.length, 2);
    assert.notEqual(parsed.items[0].id, parsed.items[1].id);
});

test('머리글의 콜론과 꼬리말은 카테고리에서 떼어낸다', () => {
    const parsed = parseHumanInputQuestion('[에이전트] :\n• 담당자: 설명');

    assert.equal(parsed.items[0].category, '에이전트');
});

test('첫 일반 줄이 제목이 된다', () => {
    const parsed = parseHumanInputQuestion('무엇을 추가할까요?\n[스킬]\n• 하나: 설명');

    assert.equal(parsed.question, '무엇을 추가할까요?');
});

test('알려진 카테고리 판별', () => {
    assert.equal(isCandidateCategory('스킬'), true);
    assert.equal(isCandidateCategory('DMN'), true);
    assert.equal(isCandidateCategory('Agent'), true);
    assert.equal(isCandidateCategory('진행 단계'), false);
    assert.equal(isCandidateCategory(''), false);
    assert.equal(isCandidateCategory(null), false);
});

// ---------------------------------------------------------------------------
// 여러 프로세스를 한 번에
// ---------------------------------------------------------------------------

const MULTI = JSON.stringify({
    multi_process: true,
    stage: 'consult',
    processes: [
        { name: '휴가 신청', draft: '초안 A' },
        { name: '지출 결의', draft: '초안 B' }
    ]
});

test('여러 프로세스 초안은 페이지 넘기는 패널이 된다', () => {
    const panel = buildHitlPanel({ question: '검토해 주세요', context: MULTI });

    assert.equal(panel.kind, 'multi_process');
    assert.equal(panel.stage, 'consult');
    assert.equal(panel.questions.length, 2);
    assert.equal(panel.questions[0].feedback_type, 'approve_reject_with_edit');
});

test('앞뒤에 다른 글이 섞여 있어도 JSON 을 찾아낸다', () => {
    const panel = buildHitlPanel({ question: '확인 부탁드립니다', context: `설명 문장\n${MULTI}\n뒤에 붙은 말` });

    assert.equal(panel.kind, 'multi_process');
});

test('프로세스가 하나뿐이면 여러 개가 아니다', () => {
    const one = JSON.stringify({ multi_process: true, processes: [{ name: '하나', draft: 'x' }] });

    assert.equal(parseMultiProcessHitl(one), null);
});

test('후보 단계는 종류별로 질문이 나뉜다', () => {
    const text = JSON.stringify({
        multi_process: true,
        stage: 'candidates',
        processes: [
            { name: '휴가', skills: ['연차관리'], agents: [{ label: '인사담당', desc: '설명' }] },
            { name: '지출', dmn: ['한도판정'] }
        ]
    });

    const panel = buildHitlPanel({ context: text });

    assert.equal(panel.kind, 'multi_process');
    assert.equal(panel.stage, 'candidates');
    const kinds = panel.questions.map((q) => q.target_type);
    assert.deepEqual(kinds, ['skills', 'agents', 'dmn']);
});

test('깨진 JSON 은 조용히 무시한다', () => {
    assert.equal(parseMultiProcessHitl('{"multi_process": true, "processes": ['), null);
});

test('multi_process 라는 말이 없으면 파싱을 시도하지 않는다', () => {
    assert.equal(parseMultiProcessHitl('그냥 평범한 문장'), null);
});

// ---------------------------------------------------------------------------
// 새로고침 후 복원
// ---------------------------------------------------------------------------

test('컨설팅 승인 요청은 새로고침해도 되살린다', () => {
    assert.equal(shouldRestoreFromAssistantContent('초안입니다. 이대로 진행할까요?'), true);
});

test('후보 선택 요청은 새로고침해도 되살린다', () => {
    assert.equal(
        shouldRestoreFromAssistantContent('[스킬]\n• 연차관리: 설명\n\n무엇을 추가할지 선택해 주세요'),
        true
    );
});

test('평범한 답변은 되살리지 않는다', () => {
    // 아무 글에서나 패널을 띄우면 답할 것도 없는 자리에 버튼이 생긴다.
    assert.equal(shouldRestoreFromAssistantContent('조회 결과는 다음과 같습니다.'), false);
    assert.equal(shouldRestoreFromAssistantContent(''), false);
    assert.equal(shouldRestoreFromAssistantContent(null), false);
});

test('카테고리만 있고 요청하는 말이 없으면 되살리지 않는다', () => {
    assert.equal(shouldRestoreFromAssistantContent('[스킬] 목록을 정리했습니다.'), false);
});

// ---------------------------------------------------------------------------
// 빈 입력
// ---------------------------------------------------------------------------

test('아무것도 없어도 물어볼 것은 만든다', () => {
    const panel = buildHitlPanel({});

    assert.equal(panel.kind, 'approve_reject_with_edit');
    assert.equal(panel.question, '이대로 진행할까요?');
});

describe('parseAskUser', () => {
    const ask = JSON.stringify({
        user_request_type: 'ask_user',
        question: '첨부 문서로 어떤 작업을 원하시나요?',
        context: '첨부된 파일: testdoc.txt',
        suggestions: ['요약해줘', '프로세스 만들어줘', '  ', 5]
    });

    it('질문·맥락·제안을 꺼낸다 — 그대로 두면 중괄호 덩어리가 보인다', () => {
        const out = parseAskUser(ask);
        assert.equal(out.question, '첨부 문서로 어떤 작업을 원하시나요?');
        assert.equal(out.context, '첨부된 파일: testdoc.txt');
        assert.deepEqual(out.suggestions, ['요약해줘', '프로세스 만들어줘']);
    });

    it('앞뒤에 다른 글이 섞여 있어도 읽는다', () => {
        const out = parseAskUser(`잠시만요.\n${ask}\n감사합니다`);
        assert.equal(out.question, '첨부 문서로 어떤 작업을 원하시나요?');
    });

    it('waiting_for_user_input 만 있어도 되묻는 것으로 본다', () => {
        const out = parseAskUser(JSON.stringify({ waiting_for_user_input: true, question: '계속할까요?' }));
        assert.equal(out.question, '계속할까요?');
    });

    it('되묻는 것이 아니면 손대지 않는다', () => {
        assert.equal(parseAskUser('그냥 평범한 답변입니다'), null);
        assert.equal(parseAskUser(JSON.stringify({ user_request_type: 'ask_user' })), null);
        assert.equal(parseAskUser(JSON.stringify({ result: 'ok' })), null);
        assert.equal(parseAskUser('{망가진 json'), null);
    });
});
