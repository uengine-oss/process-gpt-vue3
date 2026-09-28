import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSimpleInstanceRows, reconcileSimpleInboxReadState } from './simpleInstanceInbox.js';

test('new task is persisted unread and moves its instance to the top', () => {
    const readState = reconcileSimpleInboxReadState({
        currentTaskIds: ['old-task', 'new-task'],
        knownTaskIds: ['old-task'],
        unreadTaskIds: [],
        hasStoredReadState: true
    });

    assert.deepEqual([...readState.unreadTaskIds], ['new-task']);

    const rows = buildSimpleInstanceRows({
        instances: [
            { instId: 'old-instance', name: '기존 인스턴스' },
            { instId: 'new-instance', name: '새 업무 인스턴스' }
        ],
        tasks: [
            { taskId: 'old-task', rootInstId: 'old-instance', updatedAt: '2026-09-21T01:00:00Z' },
            { taskId: 'new-task', rootInstId: 'new-instance', updatedAt: '2026-09-21T02:00:00Z' }
        ],
        unreadTaskIds: readState.unreadTaskIds
    });

    assert.equal(rows[0].instId, 'new-instance');
    assert.equal(rows[0].unreadCount, 1);
    assert.equal(rows[0].latestTask.taskId, 'new-task');
});

test('first visit establishes a baseline instead of marking every existing task new', () => {
    const state = reconcileSimpleInboxReadState({
        currentTaskIds: ['existing-task'],
        knownTaskIds: [],
        unreadTaskIds: [],
        hasStoredReadState: false
    });

    assert.deepEqual([...state.knownTaskIds], ['existing-task']);
    assert.deepEqual([...state.unreadTaskIds], []);
});
