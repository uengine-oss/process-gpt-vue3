import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    dedupe,
    imagesFromClipboard,
    isImage,
    isUsable,
    messageAttachments,
    sizeText,
    storagePath,
    toFailedFileInfo,
    toFileInfo,
    tooBig,
    uploadAll
} from './attachments.js';

const file = (over = {}) => ({ name: 'a.png', size: 10, type: 'image/png', lastModified: 1, ...over });

describe('isImage', () => {
    it('사진과 그 밖의 것을 가른다', () => {
        assert.equal(isImage(file()), true);
        assert.equal(isImage(file({ type: 'application/pdf' })), false);
        assert.equal(isImage(null), false);
    });
});

describe('dedupe', () => {
    it('같은 파일을 두 번 고르면 하나로 본다', () => {
        const a = file();
        const same = file();
        assert.equal(dedupe([a, same]).length, 1);
    });

    it('이름이 같아도 크기가 다르면 다른 파일이다', () => {
        assert.equal(dedupe([file(), file({ size: 20 })]).length, 2);
    });
});

describe('tooBig / sizeText', () => {
    it('한도를 넘는 것을 걸러 낸다', () => {
        assert.equal(tooBig(file({ size: 100 }), 50), true);
        assert.equal(tooBig(file({ size: 10 }), 50), false);
    });

    it('사람이 읽는 크기로 바꾼다', () => {
        assert.equal(sizeText(512), '512 B');
        assert.equal(sizeText(2048), '2 KB');
        assert.equal(sizeText(3 * 1024 * 1024), '3.0 MB');
        assert.equal(sizeText(undefined), '');
    });
});

describe('storagePath', () => {
    it('안전한 이름은 그대로 쓴다', () => {
        assert.equal(storagePath('report_1.pdf', 'ID'), 'uploads/report_1.pdf');
    });

    it('한글·공백이 있으면 확장자만 남기고 바꾼다 — 저장소가 400 으로 거절한다', () => {
        assert.equal(storagePath('휴가 신청서.pdf', 'ID'), 'uploads/ID.pdf');
        assert.equal(storagePath('a b.png', 'ID'), 'uploads/ID.png');
    });

    it('확장자가 수상하면 붙이지 않는다', () => {
        assert.equal(storagePath('한글.p df', 'ID'), 'uploads/ID');
    });
});

describe('toFileInfo', () => {
    it('서버가 어떤 이름으로 주소를 주든 찾아낸다', () => {
        for (const key of ['public_url', 'publicUrl', 'fullPath', 'fileUrl', 'url', 'path']) {
            const info = toFileInfo(file({ name: 'x.pdf' }), { [key]: 'https://u/x' });
            assert.equal(info.fileUrl, 'https://u/x', key);
        }
    });

    it('포털이 읽는 칸을 모두 채운다', () => {
        const info = toFileInfo(file({ name: 'x.pdf', size: 7, type: 'application/pdf' }), { publicUrl: 'u' });
        assert.equal(info.fileName, 'x.pdf');
        assert.equal(info.name, 'x.pdf');
        assert.equal(info.fileType, 'application/pdf');
        assert.equal(info.fileSize, 7);
    });
});

describe('isUsable', () => {
    it('주소가 없는 첨부는 보내지 않는다 — 상대가 열 수 없다', () => {
        assert.equal(isUsable(toFileInfo(file(), null)), false);
        assert.equal(isUsable(toFailedFileInfo(file(), '실패')), false);
        assert.equal(isUsable(toFileInfo(file(), { publicUrl: 'u' })), true);
    });
});

describe('imagesFromClipboard', () => {
    it('붙여넣은 것 중 사진만 꺼낸다', () => {
        const png = file();
        const data = {
            items: [
                { kind: 'file', type: 'image/png', getAsFile: () => png },
                { kind: 'string', type: 'text/plain', getAsFile: () => null },
                { kind: 'file', type: 'application/pdf', getAsFile: () => file({ type: 'application/pdf' }) }
            ]
        };
        assert.deepEqual(imagesFromClipboard(data), [png]);
    });

    it('붙여넣은 것이 없으면 빈 목록', () => {
        assert.deepEqual(imagesFromClipboard(null), []);
    });
});

describe('messageAttachments', () => {
    it('한 장(image)과 여러 장(images) 을 모두 읽는다', () => {
        const { images } = messageAttachments({ image: 'a', images: [{ url: 'b' }] });
        assert.deepEqual(images, [{ url: 'a' }, { url: 'b' }]);
    });

    it('같은 사진이 두 칸에 있어도 한 번만 보인다', () => {
        const { images } = messageAttachments({ image: 'a', images: ['a'] });
        assert.deepEqual(images, [{ url: 'a' }]);
    });

    it('파일은 이름과 주소로 편다', () => {
        const { files } = messageAttachments({
            files: [{ fileName: '계획.pdf', publicUrl: 'https://u/p', fileSize: 5 }]
        });
        assert.deepEqual(files, [{ name: '계획.pdf', url: 'https://u/p', size: 5 }]);
    });

    it('첨부가 없으면 빈 목록', () => {
        assert.deepEqual(messageAttachments({}), { images: [], files: [] });
        assert.deepEqual(messageAttachments(null), { images: [], files: [] });
    });
});

describe('uploadAll', () => {
    const deps = () => ({
        uuid: () => 'ID',
        uploadImage: async (path) => ({ path }),
        getImageUrl: async (p) => `https://cdn/${p}`,
        uploadFileToStorage: async (f) => ({ publicUrl: `https://memento/${f.name}` })
    });

    it('사진은 저장소로, 파일은 memento 로 간다', async () => {
        const seen = [];
        const d = deps();
        d.uploadImage = async (p, f) => {
            seen.push(['image', f.name]);
            return { path: p };
        };
        d.uploadFileToStorage = async (f) => {
            seen.push(['file', f.name]);
            return { publicUrl: 'u' };
        };

        const out = await uploadAll([file({ name: 'p.png' }), file({ name: 'd.pdf', type: 'application/pdf', size: 2 })], d);
        assert.deepEqual(seen, [
            ['image', 'p.png'],
            ['file', 'd.pdf']
        ]);
        assert.equal(out.images.length, 1);
        assert.equal(out.files.length, 1);
        assert.deepEqual(out.errors, []);
    });

    it('파일은 방 번호를 함께 보낸다 — 그래야 그 대화의 문서로 붙는다', async () => {
        let options = null;
        const d = { ...deps(), roomId: 'R1' };
        d.uploadFileToStorage = async (_f, o) => {
            options = o;
            return { publicUrl: 'u' };
        };
        await uploadAll([file({ name: 'd.pdf', type: 'application/pdf' })], d);
        assert.deepEqual(options, { room_id: 'R1' });
    });

    it('너무 큰 것은 올리지 않고 이유를 말한다', async () => {
        const d = { ...deps(), maxBytes: 5 };
        const out = await uploadAll([file({ size: 100 })], d);
        assert.equal(out.images.length, 0);
        assert.match(out.errors[0], /너무 큽니다/);
    });

    it('하나가 실패해도 나머지는 올린다', async () => {
        const d = deps();
        d.uploadImage = async (p, f) => {
            if (f.name === 'bad.png') throw new Error('거절됨');
            return { path: p };
        };
        const out = await uploadAll([file({ name: 'bad.png' }), file({ name: 'ok.png', size: 3 })], d);
        assert.equal(out.images.length, 1);
        assert.equal(out.errors.length, 1);
        assert.match(out.errors[0], /bad.png/);
    });

    it('주소를 못 받은 사진은 보내지 않는다 — 깨진 그림이 남는다', async () => {
        const d = deps();
        d.getImageUrl = async () => '';
        const out = await uploadAll([file()], d);
        assert.equal(out.images.length, 0);
        assert.equal(out.errors.length, 1);
    });
});

describe('isUsable — 주소 칸 이름', () => {
    it('저장된 메시지에서 꺼낸 모양(url)도 보낼 수 있다', () => {
        // messageAttachments 는 {name, url, size} 로 돌려준다. 이것을 놓치면
        // 지난 대화의 파일이 전부 걸러져 에이전트가 문서를 잊는다.
        assert.equal(isUsable({ name: 'a.pdf', url: 'https://u/a' }), true);
    });

    it('서버가 준 모양(fileUrl 계열)도 그대로 보낸다', () => {
        assert.equal(isUsable({ fileName: 'a.pdf', fileUrl: 'https://u/a' }), true);
        assert.equal(isUsable({ fileName: 'a.pdf', publicUrl: 'https://u/a' }), true);
    });

    it('주소가 어디에도 없으면 보내지 않는다', () => {
        assert.equal(isUsable({ name: 'a.pdf' }), false);
    });
});
