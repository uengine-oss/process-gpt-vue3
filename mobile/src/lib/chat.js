/**
 * 대화 내용을 화면이 그릴 수 있는 모양으로 바꾼다.
 *
 * `chats` 한 행의 `messages` 컬럼에는 여러 모양이 섞여 들어온다. 사람이 쓴 것,
 * 에이전트가 쓴 것, 배열로 묶여 온 것, 도구 호출 기록까지. 화면에서 그때그때
 * 풀면 한 종류만 처리하고 나머지는 조용히 사라진다 — 대화가 중간부터 비어 보인다.
 */

import {
    buildHitlPanel,
    parseAskUser,
    shouldRestoreFromAssistantContent
} from '../../../src/shared/hitl/index.js';
import { toArtifact } from '../../../src/shared/artifacts/index.js';
import { parseToolResult } from './agentResult.js';
import { messageAttachments } from './attachments.js';

/** 사람이 쓴 것으로 볼 역할 이름. */
const USER_ROLES = ['user', 'human'];

function textOf(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    // 도구 결과 같은 구조화된 내용. 그대로 찍으면 [object Object] 가 된다.
    try {
        return JSON.stringify(value);
    } catch (_e) {
        return '';
    }
}

/**
 * 행 하나에서 메시지들을 꺼낸다.
 *
 * `messages` 는 객체 하나일 때도, 배열일 때도 있다. 한쪽만 처리하면 다른 쪽
 * 대화가 통째로 안 보인다.
 */
export function messagesFromRow(row) {
    const raw = row?.messages;
    if (!raw) return [];

    const list = Array.isArray(raw) ? raw : [raw];
    return list
        .map((m, index) => {
            if (!m || typeof m !== 'object') return null;
            const content = textOf(m.content);
            const role = (m.role || '').toString().toLowerCase();
            const { images, files } = messageAttachments(m);

            // 내용이 없는 기록(도구 호출만 있는 것 등)은 말풍선으로 만들지 않는다.
            // 다만 사진이나 파일만 보낸 메시지는 글이 없어도 보여야 한다 —
            // 안 그러면 사진만 보낸 것이 대화에서 통째로 사라진다.
            if (!content.trim() && !images.length && !files.length) return null;

            return {
                id: `${row.uuid || row.id || 'msg'}-${index}`,
                mine: USER_ROLES.includes(role),
                name: (m.name || '').toString(),
                content,
                // 화면에 그릴 글. 되묻는 JSON 은 질문만, 도구 결과는 안의 말만 남는다.
                text: displayText({ content }),
                // 결과를 따라갈 곳이 있으면(만들어진 업무 등) 함께 준다.
                follow: parseToolResult(content)?.follow || null,
                // 만들어진 산출물(슬라이드·문서 등). 있으면 카드로 보여 준다.
                artifact: toArtifact(content),
                // 대화 속 입력 양식(OpenUI). 포털과 같은 칸에서 꺼낸다 —
                // 저장된 행에는 openui_lang, 화면에서는 openuiLang 으로 쓰인다.
                openuiLang: openuiLangOf(m),
                images,
                files,
                at: m.timeStamp || m.time || row.created_at || null
            };
        })
        .filter(Boolean);
}

/**
 * 저장된 메시지에서 입력 양식(OpenUI)을 꺼낸다.
 *
 * 포털(hydrateMessageOpenUiFromDb)과 같은 규칙이다. 한쪽만 읽으면 웹에서는
 * 폼이 뜨고 앱에서는 빈 말풍선이 된다.
 */
export function openuiLangOf(message) {
    const direct = message?.openuiLang ?? message?.openui_lang;
    if (typeof direct === 'string' && direct.trim()) return direct;

    const run = message?.runState ?? message?.run_state;
    const fromRun = run && typeof run === 'object' ? run.openui_lang : null;
    return typeof fromRun === 'string' && fromRun.trim() ? fromRun : '';
}

/** 여러 행을 시간순 한 줄기로 편다. */
export function toConversation(rows) {
    const all = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        all.push(...messagesFromRow(row));
    }
    return all.sort((a, b) => {
        const ta = a.at ? new Date(a.at).getTime() : 0;
        const tb = b.at ? new Date(b.at).getTime() : 0;
        return ta - tb;
    });
}

/**
 * 고를 만한 제안만 남긴다.
 *
 * 에이전트는 "역할/담당자를 조정해줘" 처럼 **무엇을 어떻게 바꿀지 사용자가
 * 직접 적어야만 뜻이 통하는** 제안을 함께 준다. 그것을 그냥 누르면 에이전트는
 * 무엇을 조정할지 모른 채 되묻게 된다. 그런 것은 목록에서 빼고, 대신 직접
 * 적는 칸(기타 의견)으로 받는다.
 */
const NEEDS_DETAIL = /(조정|수정|변경|바꿔)/;

export function usefulSuggestions(suggestions) {
    return (Array.isArray(suggestions) ? suggestions : []).filter((s) => !NEEDS_DETAIL.test(String(s)));
}

/**
 * 화면에 보여 줄 글.
 *
 * 에이전트가 되물을 때는 JSON 으로 온다. 그대로 내면 중괄호와 따옴표 덩어리가
 * 보인다 — 실제로 그렇게 보였다. 질문만 꺼내고, 맥락이 있으면 한 줄 덧붙인다.
 */
export function displayText(message) {
    const raw = (message?.content || '').toString();

    // 산출물 JSON 은 카드로 따로 보여 준다. 본문에 중괄호 덩어리를 남기지 않는다.
    if (toArtifact(raw)) return '';

    // 도구 실행 결과가 통째로 JSON 으로 오는 경우. 안의 말만 남긴다.
    const tool = parseToolResult(raw);
    if (tool) return tool.text;

    const ask = parseAskUser(raw);
    if (!ask) return raw;
    return [ask.question, ask.context].filter(Boolean).join('\n\n');
}

/**
 * 이 메시지가 사람의 답을 기다리는가.
 *
 * 판단 규칙은 @/shared/hitl 에 있다. 여기서 다시 만들면 포털과 갈라지고,
 * 갈라지면 승인해야 할 것이 체크박스로 뜨거나 답할 곳이 아예 사라진다.
 */
export function pendingPanel(message) {
    if (!message || message.mine) return null;

    // 에이전트가 JSON 으로 되물은 경우. 제안을 그대로 누를 수 있게 만든다 —
    // 폰에서 긴 문장을 다시 치는 것보다 누르는 편이 훨씬 빠르다.
    const ask = parseAskUser(message.content);
    if (ask) {
        return {
            kind: 'select_items',
            question: ask.question,
            context: ask.context,
            // 패널은 {id,label} 모양을 기대한다. 문자열을 그대로 넘기면
            // 동그라미만 있고 글자가 없는 선택지가 된다 — 실제로 그렇게 보였다.
            items: usefulSuggestions(ask.suggestions).map((label, index) => ({
                id: `ask::${index}`,
                label,
                description: '',
                category: ''
            })),
            allowMultiple: false,
            minSelect: 0,
            // 제안에 없는 것을 원할 수도 있다. 직접 쓸 길을 남긴다.
            allowOther: true
        };
    }

    if (!shouldRestoreFromAssistantContent(message.content)) return null;

    const firstLine = message.content.split(/\r?\n/).find((l) => l.trim()) || '';
    return buildHitlPanel({ question: firstLine.trim(), context: message.content });
}

/**
 * 보낼 메시지 한 줄. 포털이 저장하는 모양과 같아야 대화가 이어진다.
 *
 * 사진은 한 장일 때 `image`, 여러 장일 때 `images` 에 담는다 — 포털이 옛 대화를
 * 그렇게 읽으므로 두 칸을 모두 채워 둔다.
 */
export function outgoingMessage({
    text,
    name,
    email,
    images = [],
    files = [],
    at = new Date().toISOString()
}) {
    const content = (text || '').toString().trim();
    const pics = Array.isArray(images) ? images.filter(Boolean) : [];
    const docs = Array.isArray(files) ? files.filter(Boolean) : [];

    // 글도 첨부도 없으면 보낼 것이 없다.
    if (!content && !pics.length && !docs.length) return null;

    return {
        name: name || email || '',
        role: 'user',
        email: email || '',
        image: pics.length === 1 ? pics[0].url : '',
        images: pics.map((p) => ({ url: p.url })),
        files: docs,
        content,
        timeStamp: at
    };
}
