// CFB(OLE2) 리더/라이터 — 브라우저·Node 공용 (Uint8Array + DataView, Buffer 비의존).
// HWP 5.0 컨테이너를 뜯고 다시 조립하는 데 필요한 최소 기능만 구현한다.
const SEC = 512;
const MINI = 64;
const CUTOFF = 4096;
const FREE = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;

const dv = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

export function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function utf16le(u8) {
  let s = '';
  const d = dv(u8);
  for (let i = 0; i + 1 < u8.length; i += 2) s += String.fromCharCode(d.getUint16(i, true));
  return s;
}

export function latin1(u8) {
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return s;
}

export function readCfb(buf) {
  const d = dv(buf);
  if (d.getUint32(0, true) !== 0xe011cfd0 || d.getUint32(4, true) !== 0xe11ab1a1) {
    throw new Error('CFB 시그니처 아님');
  }
  const secSize = 1 << d.getUint16(0x1e, true);
  const miniSize = 1 << d.getUint16(0x20, true);
  const numFat = d.getUint32(0x2c, true);
  const firstDir = d.getUint32(0x30, true);
  const firstMiniFat = d.getUint32(0x3c, true);
  const firstDifat = d.getUint32(0x44, true);
  const numDifat = d.getUint32(0x48, true);
  const off = (s) => (s + 1) * secSize;

  const difat = [];
  for (let i = 0; i < 109; i++) {
    const v = d.getUint32(0x4c + i * 4, true);
    if (v <= 0xfffffffa) difat.push(v);
  }
  let ds = firstDifat;
  for (let n = 0; n < numDifat && ds <= 0xfffffffa; n++) {
    const base = off(ds);
    for (let i = 0; i < secSize / 4 - 1; i++) {
      const v = d.getUint32(base + i * 4, true);
      if (v <= 0xfffffffa) difat.push(v);
    }
    ds = d.getUint32(base + secSize - 4, true);
  }

  const fat = [];
  for (const s of difat.slice(0, numFat || difat.length)) {
    const base = off(s);
    for (let i = 0; i < secSize / 4; i++) fat.push(d.getUint32(base + i * 4, true));
  }

  const chain = (start) => {
    const out = [];
    let s = start;
    while (s <= 0xfffffffa && out.length < 200000) { out.push(s); s = fat[s]; }
    return out;
  };
  const readChain = (start, size) => {
    const all = concat(chain(start).map((s) => buf.subarray(off(s), off(s) + secSize)));
    return size == null ? all : all.subarray(0, size);
  };

  const dirBuf = readChain(firstDir);
  const dd = dv(dirBuf);
  const all = [];
  for (let i = 0; i * 128 < dirBuf.length; i++) {
    const o = i * 128;
    const nameLen = dd.getUint16(o + 64, true);
    all.push(nameLen === 0 ? null : {
      id: i,
      name: utf16le(dirBuf.subarray(o, o + Math.max(0, nameLen - 2))),
      type: dd.getUint8(o + 66),
      left: dd.getUint32(o + 68, true),
      right: dd.getUint32(o + 72, true),
      child: dd.getUint32(o + 76, true),
      start: dd.getUint32(o + 116, true),
      size: Number(dd.getBigUint64(o + 120, true)),
    });
  }

  // 디렉터리는 red-black 트리다. child에서 시작해 left/right를 순회해야 실제 계층이 나온다.
  const entries = [];
  (function walk(id, prefix) {
    if (id === FREE || !all[id]) return;
    const e = all[id];
    walk(e.left, prefix);
    e.path = prefix + e.name;
    entries.push(e);
    if (e.type === 1 && e.child !== FREE) walk(e.child, e.path + '/');
    walk(e.right, prefix);
  })(all.find((e) => e && e.type === 5)?.child ?? FREE, '');

  const root = all.find((e) => e && e.type === 5);
  if (root) { root.path = '<root>'; entries.unshift(root); }

  const miniFatBuf = readChain(firstMiniFat);
  const mfd = dv(miniFatBuf);
  const miniFat = [];
  for (let i = 0; i * 4 < miniFatBuf.length; i++) miniFat.push(mfd.getUint32(i * 4, true));
  const miniStream = root ? readChain(root.start, root.size) : new Uint8Array(0);

  const read = (entry) => {
    if (entry.size >= CUTOFF) return readChain(entry.start, entry.size);
    const parts = [];
    let s = entry.start;
    while (s <= 0xfffffffa) {
      parts.push(miniStream.subarray(s * miniSize, (s + 1) * miniSize));
      s = miniFat[s];
    }
    return concat(parts).subarray(0, entry.size);
  };

  return { entries, read, secSize };
}

/** CFB 정렬 규칙: 이름 길이 우선, 그다음 대문자 비교 */
function cmpName(a, b) {
  if (a.length !== b.length) return a.length - b.length;
  const ua = a.toUpperCase();
  const ub = b.toUpperCase();
  for (let i = 0; i < ua.length; i++) {
    const diff = ua.charCodeAt(i) - ub.charCodeAt(i);
    if (diff) return diff;
  }
  return 0;
}

function buildTree(ids, entries) {
  if (!ids.length) return FREE;
  const mid = ids.length >> 1;
  const id = ids[mid];
  entries[id].left = buildTree(ids.slice(0, mid), entries);
  entries[id].right = buildTree(ids.slice(mid + 1), entries);
  return id;
}

/** @param {Array<{path:string,name:string,type:number,data?:Uint8Array}>} items */
export function writeCfb(items) {
  const entries = [{ name: 'Root Entry', type: 5, left: FREE, right: FREE, child: FREE, start: 0, size: 0 }];
  const byPath = new Map();
  for (const it of items) {
    byPath.set(it.path, entries.length);
    entries.push({ ...it, left: FREE, right: FREE, child: FREE, start: ENDOFCHAIN, size: it.data?.length ?? 0 });
  }

  const childrenOf = new Map([['', []]]);
  for (const [path, id] of byPath) {
    const i = path.lastIndexOf('/');
    const parent = i < 0 ? '' : path.slice(0, i);
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(id);
  }
  for (const [parent, ids] of childrenOf) {
    ids.sort((a, b) => cmpName(entries[a].name, entries[b].name));
    entries[parent === '' ? 0 : byPath.get(parent)].child = buildTree(ids, entries);
  }

  const miniParts = [];
  let miniSectors = 0;
  const bigChains = [];
  for (let id = 1; id < entries.length; id++) {
    const e = entries[id];
    if (e.type !== 2) { e.start = 0; e.size = 0; continue; }
    if (e.size === 0) { e.start = ENDOFCHAIN; continue; }
    if (e.size < CUTOFF) {
      e.start = miniSectors;
      const padded = new Uint8Array(Math.ceil(e.size / MINI) * MINI);
      padded.set(e.data);
      miniParts.push(padded);
      miniSectors += padded.length / MINI;
    } else {
      bigChains.push({ entryId: id, data: e.data });
    }
  }
  const miniStream = concat(miniParts);

  const miniFat = [];
  for (let id = 1; id < entries.length; id++) {
    const e = entries[id];
    if (e.type !== 2 || e.size === 0 || e.size >= CUTOFF) continue;
    const n = Math.ceil(e.size / MINI);
    for (let k = 0; k < n; k++) miniFat.push(k === n - 1 ? ENDOFCHAIN : e.start + k + 1);
  }
  const miniFatBuf = new Uint8Array(Math.ceil(Math.max(1, miniFat.length) * 4 / SEC) * SEC).fill(0xff);
  const mfd = dv(miniFatBuf);
  miniFat.forEach((v, i) => mfd.setUint32(i * 4, v >>> 0, true));

  const pad = (b) => {
    const out = new Uint8Array(Math.ceil(b.length / SEC) * SEC);
    out.set(b);
    return out;
  };

  const blocks = [];
  for (const c of bigChains) blocks.push({ kind: 'big', id: c.entryId, buf: pad(c.data) });
  if (miniStream.length) blocks.push({ kind: 'mini', buf: pad(miniStream) });
  if (miniFat.length) blocks.push({ kind: 'minifat', buf: miniFatBuf });

  const dirCount = Math.ceil(entries.length / 4) * 4;
  const dirBuf = new Uint8Array(dirCount * 128);
  blocks.push({ kind: 'dir', buf: dirBuf });

  let cursor = 0;
  for (const b of blocks) { b.first = cursor; b.count = b.buf.length / SEC; cursor += b.count; }
  const dataSectors = cursor;

  let numFat = 1;
  for (;;) {
    const need = Math.ceil((dataSectors + numFat) / (SEC / 4));
    if (need === numFat) break;
    numFat = need;
  }

  const fat = new Array(dataSectors + numFat).fill(FREE);
  for (const b of blocks) {
    for (let i = 0; i < b.count; i++) fat[b.first + i] = i === b.count - 1 ? ENDOFCHAIN : b.first + i + 1;
  }
  for (let i = 0; i < numFat; i++) fat[dataSectors + i] = FATSECT;

  const dd = dv(dirBuf);
  for (let i = 0; i < dirCount; i++) {
    const o = i * 128;
    const e = entries[i];
    if (!e) {
      dd.setUint32(o + 68, FREE, true);
      dd.setUint32(o + 72, FREE, true);
      dd.setUint32(o + 76, FREE, true);
      continue;
    }
    const nm = e.name + '\0';
    const len = Math.min(64, nm.length * 2);
    for (let k = 0; k * 2 < len; k++) dd.setUint16(o + k * 2, nm.charCodeAt(k), true);
    dd.setUint16(o + 64, len, true);
    dd.setUint8(o + 66, e.type);
    dd.setUint8(o + 67, 1); // black
    dd.setUint32(o + 68, e.left >>> 0, true);
    dd.setUint32(o + 72, e.right >>> 0, true);
    dd.setUint32(o + 76, e.child >>> 0, true);
    if (i === 0) {
      const mb = blocks.find((b) => b.kind === 'mini');
      dd.setUint32(o + 116, mb ? mb.first : ENDOFCHAIN, true);
      dd.setBigUint64(o + 120, BigInt(miniStream.length), true);
    } else if (e.type === 2 && e.size > 0) {
      const start = e.size >= CUTOFF ? blocks.find((b) => b.kind === 'big' && b.id === i).first : e.start;
      dd.setUint32(o + 116, start, true);
      dd.setBigUint64(o + 120, BigInt(e.size), true);
    } else {
      dd.setUint32(o + 116, e.type === 2 ? ENDOFCHAIN : 0, true);
      dd.setBigUint64(o + 120, 0n, true);
    }
  }

  const header = new Uint8Array(SEC);
  const hd = dv(header);
  hd.setUint32(0, 0xe011cfd0, true);
  hd.setUint32(4, 0xe11ab1a1, true);
  hd.setUint16(24, 0x003e, true);
  hd.setUint16(26, 3, true);
  hd.setUint16(28, 0xfffe, true);
  hd.setUint16(30, 9, true);
  hd.setUint16(32, 6, true);
  hd.setUint32(44, numFat, true);
  hd.setUint32(48, blocks.find((b) => b.kind === 'dir').first, true);
  hd.setUint32(56, CUTOFF, true);
  const mf = blocks.find((b) => b.kind === 'minifat');
  hd.setUint32(60, mf ? mf.first : ENDOFCHAIN, true);
  hd.setUint32(64, mf ? mf.count : 0, true);
  hd.setUint32(68, ENDOFCHAIN, true);
  hd.setUint32(72, 0, true);
  for (let i = 0; i < 109; i++) hd.setUint32(76 + i * 4, i < numFat ? dataSectors + i : FREE, true);

  const fatBuf = new Uint8Array(numFat * SEC).fill(0xff);
  const fd = dv(fatBuf);
  fat.forEach((v, i) => fd.setUint32(i * 4, v >>> 0, true));

  return concat([header, ...blocks.map((b) => b.buf), fatBuf]);
}

/** HWP 레코드 스트림 파싱 */
export function parseRecords(buf) {
  const d = dv(buf);
  const out = [];
  let p = 0;
  while (p + 4 <= buf.length) {
    const h = d.getUint32(p, true);
    const tagId = h & 0x3ff;
    const level = (h >> 10) & 0x3ff;
    let size = (h >> 20) & 0xfff;
    let off = p + 4;
    if (size === 0xfff) { size = d.getUint32(p + 4, true); off = p + 8; }
    if (off + size > buf.length) { out.push({ tagId, level, size, truncated: true }); break; }
    out.push({ tagId, level, size, data: buf.subarray(off, off + size) });
    p = off + size;
  }
  return out;
}

export function encodeRecord(tagId, level, data) {
  const big = data.length >= 0xfff;
  const head = new Uint8Array(big ? 8 : 4);
  const hd = dv(head);
  hd.setUint32(0, (tagId & 0x3ff) | ((level & 0x3ff) << 10) | (((big ? 0xfff : data.length) & 0xfff) << 20), true);
  if (big) hd.setUint32(4, data.length, true);
  return concat([head, data]);
}
