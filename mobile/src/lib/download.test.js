import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { download, downloadName, downloadUrl, reasonText } from './download.js';

describe('downloadUrl', () => {
    it('서버가 어떤 이름으로 주소를 주든 찾아낸다', () => {
        for (const key of ['url', 'fileUrl', 'publicUrl', 'fullPath', 'path']) {
            assert.equal(downloadUrl({ [key]: 'https://u/a.pdf' }), 'https://u/a.pdf', key);
        }
        assert.equal(downloadUrl({}), '');
    });
});

describe('downloadName', () => {
    it('이름이 있으면 그대로', () => {
        assert.equal(downloadName({ fileName: '보고서.pdf' }), '보고서.pdf');
    });

    it('없으면 주소 끝을 쓴다', () => {
        assert.equal(downloadName({ url: 'https://u/files/%EA%B3%84%ED%9A%8D.pdf?x=1' }), '계획.pdf');
    });

    it('아무것도 없으면 대체 이름', () => {
        assert.equal(downloadName({}), '첨부파일');
    });
});

describe('download', () => {
    it('앱에서는 기기 브라우저로 넘긴다 — 내부 서버는 그 파일을 모른다', () => {
        const opened = [];
        const win = { Capacitor: { Plugins: { Browser: { open: (o) => opened.push(o.url) } } } };
        assert.deepEqual(download({ url: 'https://u/a.pdf' }, win), { ok: true });
        assert.deepEqual(opened, ['https://u/a.pdf']);
    });

    it('브라우저에서는 새 탭으로 연다', () => {
        const opened = [];
        const win = { open: (url) => opened.push(url) };
        assert.deepEqual(download({ fileUrl: 'https://u/b.pdf' }, win), { ok: true });
        assert.deepEqual(opened, ['https://u/b.pdf']);
    });

    it('주소가 없으면 누를 수 있는 버튼을 만들지 않는다', () => {
        assert.deepEqual(download({}, {}), { ok: false, reason: 'no-url' });
        assert.match(reasonText('no-url'), /주소가 없습니다/);
    });
});
