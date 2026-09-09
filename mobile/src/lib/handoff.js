/**
 * 화면과 화면 사이로 파일을 넘긴다.
 *
 * 새 대화 화면에서 사진을 붙이고 보내면, 방을 먼저 만들고 방 화면으로 옮긴 뒤
 * 거기서 실제로 보낸다. 그런데 주소(query)로는 파일을 실을 수 없다 — 주소는
 * 글자만 담는다. 그래서 여기에 잠깐 맡겨 두고 방 화면이 찾아간다.
 *
 * 한 번 찾아가면 비운다. 남겨 두면 다음 대화에 지난 사진이 딸려 붙는다.
 */

let pending = [];

export function stash(files) {
    pending = Array.isArray(files) ? [...files] : [];
}

export function take() {
    const out = pending;
    pending = [];
    return out;
}

export function clear() {
    pending = [];
}
