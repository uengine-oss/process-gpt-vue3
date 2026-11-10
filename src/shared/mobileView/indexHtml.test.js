/**
 * index.html 의 화면 폭 규칙(window.__pgptViewport)이 배포 뒤에도 살아 있는가.
 *
 * 지키려는 것: 운영 컨테이너의 run.sh 는 `sed '/<head>/a ...'` 로 <head> 가 든 **모든 줄** 뒤에
 * window._env_ 스크립트를 끼워 넣는다. 주석에라도 그 글자가 있으면 인라인 스크립트 한가운데에
 * <script> 가 들어가 문법 오류가 나고, 휴대폰 화면 규칙이 통째로 사라진다(2026-11-11 설치본에서 실제로 겪음).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../index.html'), 'utf8');

/** run.sh 가 하는 일과 같게 <head> 가 든 줄마다 뒤에 한 줄을 끼운다 */
function injectLikeRunSh(src) {
    return src
        .split('\n')
        .flatMap((line) => (line.includes('<head>') ? [line, '<script>window._env_ = {};</script>'] : [line]))
        .join('\n');
}

function viewportScript(src) {
    const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    return scripts.find((s) => s.includes('__pgptViewport'));
}

test('<head> 글자는 head 태그 한 줄에만 있다', () => {
    assert.equal(html.split('\n').filter((l) => l.includes('<head>')).length, 1);
});

test('run.sh 가 환경 변수를 끼운 뒤에도 화면 폭 스크립트가 문법 오류 없이 남는다', () => {
    const script = viewportScript(injectLikeRunSh(html));
    assert.ok(script, '화면 폭 스크립트를 찾지 못했다');
    assert.doesNotThrow(() => new Function(script));
});
