import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNoticeDates, sortNotices } from '../src/utils/noticePresentation.js';

test('dates display single days, ranges and cross-year ranges', () => {
    assert.equal(formatNoticeDates({ start_date: '2026-10-05', end_date: '2026-10-05' }), '10/05（一）');
    assert.equal(formatNoticeDates({ start_date: '2026-10-05', end_date: '2026-10-09' }), '10/05（一）～10/09（五）');
    assert.equal(formatNoticeDates({ start_date: '2026-10-05', end_date: null }), '10/05（一）');
    assert.equal(formatNoticeDates({ start_date: '2026-12-31', end_date: '2027-01-01' }), '2026/12/31（四）～2027/01/01（五）');
    assert.match(formatNoticeDates({ start_date: '2026-10-05' }, 'vi'), /Th 2/);
    assert.match(formatNoticeDates({ start_date: '2026-10-05' }, 'id'), /Sen/);
});

test('unread precedes read, each group sorts newest first without changing input', () => {
    const notices = [
        { start_date: '2026-10-05', id: 'read-new' },
        { start_date: '2026-10-01', id: 'unread-old' },
        { start_date: '2026-10-04', id: 'unread-new' },
        { start_date: '2026-09-30', id: 'read-old' },
    ];
    const entryReadIds = ['read-new', 'read-old'];
    const unreadOnEntry = notice => !entryReadIds.includes(notice.id);
    const expected = ['unread-new', 'unread-old', 'read-new', 'read-old'];
    assert.deepEqual(sortNotices(notices, unreadOnEntry).map(n => n.id), expected);
    assert.equal(notices[0].id, 'read-new');
    const nextEntryReadIds = [...entryReadIds, 'unread-new'];
    assert.deepEqual(sortNotices(notices, unreadOnEntry).map(n => n.id), expected);
    assert.deepEqual(sortNotices(notices, n => !nextEntryReadIds.includes(n.id)).map(n => n.id),
        ['unread-old', 'read-new', 'unread-new', 'read-old']);
});
