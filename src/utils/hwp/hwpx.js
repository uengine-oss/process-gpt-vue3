// 최소 ZIP/HWPX 리더 — 브라우저·Node 공용. 압축 해제는 codec.inflateRaw에 위임한다.
const dv = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
const utf8 = (u8) => new TextDecoder('utf-8').decode(u8);

export function readZip(buf) {
  const d = dv(buf);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (d.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP EOCD 없음');
  const count = d.getUint16(eocd + 10, true);
  let p = d.getUint32(eocd + 16, true);

  const entries = [];
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (d.getUint32(p, true) !== 0x02014b50) break;
    const nameLen = d.getUint16(p + 28, true);
    entries.push({
      name: utf8(buf.subarray(p + 46, p + 46 + nameLen)),
      method: d.getUint16(p + 10, true),
      compSize: d.getUint32(p + 20, true),
      localOff: d.getUint32(p + 42, true),
    });
    p += 46 + nameLen + d.getUint16(p + 30, true) + d.getUint16(p + 32, true);
  }

  const read = async (e, codec) => {
    const lnameLen = d.getUint16(e.localOff + 26, true);
    const lextraLen = d.getUint16(e.localOff + 28, true);
    const start = e.localOff + 30 + lnameLen + lextraLen;
    const raw = buf.subarray(start, start + e.compSize);
    return e.method === 0 ? raw : codec.inflateRaw(raw);
  };

  return { entries, read };
}

/**
 * HWPX에서 이미지 참조 정보를 뽑는다.
 * - binIndex: binaryItemIDRef → 1-based BinData 순번 (HWP의 BinItem ID와 대응)
 * - refs: 문서 순서대로 나열한 binaryItemIDRef 목록
 */
export async function readImageRefs(hwpxBytes, codec) {
  const zip = readZip(hwpxBytes);
  const text = async (name) => {
    const e = zip.entries.find((x) => x.name === name);
    return e ? utf8(await zip.read(e, codec)) : '';
  };

  // content.hpf의 opf:item 중 BinData를 가리키는 것이 순서대로 BIN0001..N 이 된다
  const hpf = await text('Contents/content.hpf');
  const binIndex = new Map();
  let n = 0;
  for (const m of hpf.matchAll(/<opf:item\b[^>]*>/g)) {
    const tag = m[0];
    const href = /href="([^"]*)"/.exec(tag)?.[1] ?? '';
    if (!href.includes('BinData/')) continue;
    const id = /id="([^"]*)"/.exec(tag)?.[1];
    if (id) binIndex.set(id, ++n);
  }

  // 그림마다 참조 ID와 개체 표시 크기(<hp:sz>)를 문서 순서대로 수집한다.
  // rhwp는 hp:sz를 무시하고 imgRect 값을 쓰기 때문에 그림이 크게 렌더된다.
  const refs = [];
  const sizes = [];
  const sections = zip.entries
    .filter((e) => /^Contents\/section\d+\.xml$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const e of sections) {
    const xml = utf8(await zip.read(e, codec));
    for (const m of xml.matchAll(/<hc:img\b[^>]*binaryItemIDRef="([^"]*)"[^>]*>/g)) {
      refs.push(m[1]);
      // 같은 그림 개체 안에서 <hc:img> 바로 뒤에 오는 <hp:sz>가 표시 크기다
      const after = xml.slice(m.index + m[0].length, m.index + m[0].length + 400);
      const sz = /<hp:sz\b[^>]*width="(\d+)"[^>]*height="(\d+)"/.exec(after);
      sizes.push(sz ? { w: +sz[1], h: +sz[2] } : null);
    }
  }

  return { binIndex, refs, sizes };
}
