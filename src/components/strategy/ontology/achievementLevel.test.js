import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementLevel, levelColor } from './achievementLevel.js';

test('달성률 단계 — 기본 기준(달성 100 · 주의 50)', () => {
    assert.equal(achievementLevel(108.3), 'ok');
    assert.equal(achievementLevel(100), 'ok');
    assert.equal(achievementLevel(80.8), 'warn');
    assert.equal(achievementLevel(50), 'warn');
    assert.equal(achievementLevel(44), 'risk');
    assert.equal(achievementLevel(null), null);
    assert.equal(achievementLevel(70, { green: 100, amber: 70 }), 'warn');
    assert.equal(levelColor('risk'), '#dc2626');
    assert.equal(levelColor(null), '#6b7280');
});
