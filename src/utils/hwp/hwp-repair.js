// rhwp exportHwp() 출력이 한글에서 열리도록 보정한다. 브라우저·Node 공용.
//
// 원인: rhwp가 섹션 첫 문단에 단 정의(cold) 컨트롤을 만들지 않는다. 한글은 단 정의가
// 없는 섹션을 유효한 문서로 보지 않고 "파일이 손상되었습니다"로 거부한다.
// 여기서 넣는 값은 전부 문서 무관한 고정값이라 어떤 문서에도 그대로 적용된다.
import { readCfb, writeCfb, parseRecords, encodeRecord, concat, latin1 } from './cfb.js';
import { readImageRefs } from './hwpx.js';

const B = 0x010;
const PARA_HEADER = B + 50;
const PARA_TEXT = B + 51;
const PARA_CHAR_SHAPE = B + 52;
const CTRL_HEADER = B + 55;
const PAGE_BORDER_FILL = B + 59;
const LIST_HEADER = B + 56;
const SHAPE_COMPONENT = B + 60;
const SHAPE_PICTURE = B + 69;
// SHAPE_PICTURE에서 BinItem ID(UINT16)의 위치.
// 0..11 테두리 / 12..43 사각형 4꼭지점 / 44..59 자르기 / 60..67 안쪽여백
// 68 밝기 / 69 명암 / 70 효과 / 71..72 BinItem ID
const PIC_BINID_OFFSET = 71;

// PARA_TEXT 안의 확장 컨트롤 문자 8 WCHAR: ch + ctrlId('dloc') + 예약 + ch
const COLD_CHAR = new Uint8Array([0x02, 0, 0x64, 0x6c, 0x6f, 0x63, 0, 0, 0, 0, 0, 0, 0, 0, 0x02, 0]);
// cold CTRL_HEADER: 'dloc' + 속성(단 1개, 너비 동일) + 예약
const COLD_CTRL = new Uint8Array([0x64, 0x6c, 0x6f, 0x63, 0x04, 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

// OLE 프로퍼티셋 스트림 명명 규약
const SUMMARY_NAME = 'HwpSummaryInformation';
const SUMMARY_PREFIX = String.fromCharCode(5);

const ctrlId = (r) => (r.tagId === CTRL_HEADER && r.data?.length >= 4
  ? latin1(r.data.subarray(0, 4).slice().reverse()).trim() : null);

const u32 = (u8, o) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(o, true);
const setU32 = (u8, o, v) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength).setUint32(o, v, true);
const u16 = (u8, o) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint16(o, true);
const setU16 = (u8, o, v) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength).setUint16(o, v, true);
const i32 = (u8, o) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getInt32(o, true);
const setI32 = (u8, o, v) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength).setInt32(o, v, true);

/**
 * 그림 컨트롤의 BinItem ID 보정.
 *
 * rhwp는 HWPX의 binaryItemIDRef가 "image1"처럼 숫자로 끝나지 않으면(예: "qrImg")
 * 참조 ID를 0으로 써버려 한글에서 이미지가 깨진다. 원본 HWPX의 content.hpf에
 * 선언된 BinData 순서로 올바른 ID를 복원한다.
 *
 * @returns {Promise<{records: object[], note: string}>}
 */
async function fixPictureIds(sectionRecs, sourceHwpx, codec) {
  const { binIndex, refs } = await readImageRefs(sourceHwpx, codec);

  const pics = sectionRecs.filter((r) => r.tagId === SHAPE_PICTURE && r.data.length > PIC_BINID_OFFSET + 1);
  if (!pics.length) return { records: sectionRecs, changed: false, note: null };
  if (pics.length !== refs.length) {
    return {
      records: sectionRecs,
      changed: false,
      note: `⚠ 그림 개수 불일치 (HWP ${pics.length} / HWPX ${refs.length}) — ID 보정 생략`,
    };
  }

  let fixed = 0;
  let k = 0;
  const records = sectionRecs.map((r) => {
    if (r.tagId !== SHAPE_PICTURE || r.data.length <= PIC_BINID_OFFSET + 1) return r;
    const want = binIndex.get(refs[k++]);
    if (!want || u16(r.data, PIC_BINID_OFFSET) === want) return r;
    const d = r.data.slice();
    setU16(d, PIC_BINID_OFFSET, want);
    fixed++;
    return { ...r, data: d };
  });
  return { records, changed: fixed > 0, note: fixed ? `그림 BinItem ID ${fixed}건 보정` : null };
}

/**
 * 그림 개체의 표시 크기 보정.
 *
 * 렌더 박스는 SHAPE_COMPONENT의 '현재 크기'(offset 28/32)가 결정하는데, rhwp는 여기에
 * HWPX의 <hp:sz>가 아니라 imgRect 값을 써서 그림이 실제보다 크게 나온다.
 */
async function fixPictureBoxSize(sectionRecs, sourceHwpx, codec, report) {
  const { sizes } = await readImageRefs(sourceHwpx, codec);
  const picIdx = sectionRecs.map((r, i) => (r.tagId === SHAPE_PICTURE ? i : -1)).filter((i) => i >= 0);
  if (!picIdx.length || picIdx.length !== sizes.length) return { records: sectionRecs, changed: false };

  const records = sectionRecs.map((r) => r);
  let fixed = 0;
  picIdx.forEach((pi, k) => {
    const sz = sizes[k];
    if (!sz?.w || !sz?.h) return;
    // 그림을 감싸는 SHAPE_COMPONENT는 바로 앞쪽에 온다
    let ci = pi - 1;
    while (ci >= 0 && records[ci].tagId !== SHAPE_COMPONENT) ci--;
    if (ci < 0 || records[ci].data.length < 36) return;
    if (i32(records[ci].data, 28) === sz.w && i32(records[ci].data, 32) === sz.h) return;
    const d = records[ci].data.slice();
    setI32(d, 28, sz.w);
    setI32(d, 32, sz.h);
    records[ci] = { ...records[ci], data: d };
    fixed++;
  });
  if (fixed) report.push(`그림 표시크기 ${fixed}건 보정`);
  return { records, changed: fixed > 0 };
}

/**
 * 머리말/꼬리말 안 표의 높이 보정.
 *
 * HWPX는 표의 hp:sz에 실제 내용과 무관한 큰 값이 들어있을 수 있고(이 문서는 56850,
 * 약 200mm) rhwp는 그대로 복사한다. 한글은 셀 높이로 재계산해 쓴다. 그대로 두면
 * 머리말/꼬리말이 페이지 밖으로 밀려난다.
 * 셀 LIST_HEADER: 8..9 열주소 / 10..11 행주소 / 16..19 너비 / 20..23 높이
 */
function fixHeaderFooterTableHeight(recs, report) {
  const out = [...recs];
  let fixed = 0;
  for (let i = 0; i < out.length; i++) {
    if (ctrlId(out[i]) !== 'head' && ctrlId(out[i]) !== 'foot') continue;
    const hfLevel = out[i].level;
    for (let j = i + 1; j < out.length && out[j].level > hfLevel; j++) {
      if (ctrlId(out[j]) !== 'tbl' || out[j].data.length < 24) continue;
      const tblLevel = out[j].level;
      // 셀별 행 높이를 모아 표 높이를 다시 구한다
      const rows = new Map();
      for (let k = j + 1; k < out.length && out[k].level > tblLevel; k++) {
        const r = out[k];
        if (r.tagId !== LIST_HEADER || r.level !== tblLevel + 1 || r.data.length < 24) continue;
        rows.set(u16(r.data, 10), i32(r.data, 20));
      }
      if (!rows.size) continue;
      const want = [...rows.values()].reduce((a, b) => a + b, 0);
      const cur = i32(out[j].data, 20);
      if (!want || cur === want) continue;
      const d = out[j].data.slice();
      setI32(d, 20, want);
      out[j] = { ...out[j], data: d };
      report.push(`머리말/꼬리말 표 높이 ${cur} → ${want}`);
      fixed++;
    }
  }
  return { records: out, changed: fixed > 0 };
}

/** PNG / BMP / JPEG의 픽셀 크기 */
function imageSize(b) {
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length > 24 && d.getUint32(0) === 0x89504e47) return { w: d.getUint32(16), h: d.getUint32(20) };
  if (b[0] === 0x42 && b[1] === 0x4d) return { w: d.getInt32(18, true), h: Math.abs(d.getInt32(22, true)) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let p = 2;
    while (p + 9 < b.length) {
      if (b[p] !== 0xff) { p++; continue; }
      const m = b[p + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: d.getUint16(p + 5), w: d.getUint16(p + 7) };
      }
      p += 2 + d.getUint16(p + 2);
    }
  }
  return null;
}

/**
 * 그림의 '원본 크기' 필드 보정.
 *
 * rhwp는 이 필드에 자르기 사각형의 우/하 값을 그대로 복사한다. 자르기가 걸린 그림은
 * 좌·상만 잘리고 우·하는 안 잘려서 그림이 확대·치우쳐 보인다.
 * 올바른 값은 이미지 픽셀 × 75 (96dpi → HWPUNIT).
 */
async function fixPictureNaturalSize(recs, entries, read, codec, report) {
  // BinData 스트림을 binId별로 준비 (압축 저장될 수 있음)
  const bins = new Map();
  for (const e of entries.filter((x) => x.type === 2 && x.path.startsWith('BinData/'))) {
    const n = Number(/BIN(\d+)/i.exec(e.name)?.[1] ?? 0);
    if (n) bins.set(n, e);
  }
  if (!bins.size) return { records: recs, changed: false };

  let fixed = 0;
  const out = [];
  for (const r of recs) {
    if (r.tagId !== SHAPE_PICTURE || r.data.length < 90) { out.push(r); continue; }
    const binId = u16(r.data, PIC_BINID_OFFSET);
    const e = bins.get(binId);
    if (!e) { out.push(r); continue; }

    let bytes = read(e);
    try { bytes = await codec.inflateRaw(bytes); } catch { /* 비압축 저장 */ }
    const px = imageSize(bytes);
    if (!px?.w || !px?.h) { out.push(r); continue; }

    const want = [Math.round(px.w * 75), Math.round(px.h * 75)];
    const cur = [i32(r.data, 82), i32(r.data, 86)];
    if (cur[0] === want[0] && cur[1] === want[1]) { out.push(r); continue; }

    const d = r.data.slice();
    // 자르기가 '전체 표시'였다면 새 원본 크기에 맞춰 함께 늘린다
    const crop = [i32(d, 44), i32(d, 48), i32(d, 52), i32(d, 56)];
    if (crop[0] === 0 && crop[1] === 0 && crop[2] === cur[0] && crop[3] === cur[1]) {
      setI32(d, 52, want[0]);
      setI32(d, 56, want[1]);
    }
    setI32(d, 82, want[0]);
    setI32(d, 86, want[1]);
    out.push({ ...r, data: d });
    fixed++;
  }
  if (fixed) report.push(`그림 원본크기 ${fixed}건 보정`);
  return { records: out, changed: fixed > 0 };
}

/**
 * @param {Uint8Array} buf rhwp가 만든 .hwp
 * @param {{inflateRaw:Function, deflateRaw:Function}} codec 환경별 압축 어댑터
 * @param {{sourceHwpx?: Uint8Array}} opts 원본 HWPX를 주면 그림 참조 ID까지 보정한다
 * @returns {Promise<{out: Uint8Array, changed: boolean, report: string[]}>}
 */
export async function repairHwp(buf, codec, { sourceHwpx } = {}) {
  const report = [];
  const { entries, read } = readCfb(buf);
  const fhEntry = entries.find((e) => e.name === 'FileHeader');
  const compressed = !!(u32(read(fhEntry), 36) & 1);
  const secEntry = entries.find((e) => e.path === 'BodyText/Section0');
  if (!secEntry) return { out: buf, changed: false, report: ['Section0 없음 — 수정 불가'] };

  let raw = read(secEntry);
  if (compressed) raw = await codec.inflateRaw(raw);
  let recs = parseRecords(raw);
  let changed = false;

  // 문단 0 = 첫 level0 PARA_HEADER부터 다음 level0 PARA_HEADER 직전까지
  let end = 1;
  while (end < recs.length && !(recs[end].level === 0 && recs[end].tagId === PARA_HEADER)) end++;
  const para0 = recs.slice(0, end);

  if (para0.some((r) => ctrlId(r) === 'cold')) {
    report.push('cold 이미 존재 — 단 정의 보정 불필요');
  } else {
    recs = fixColumnDef(para0, recs, end, report);
    changed = true;
  }

  // 그림 참조 ID 보정 (원본 HWPX가 있을 때만 가능)
  if (sourceHwpx) {
    try {
      const r = await fixPictureIds(recs, sourceHwpx, codec);
      if (r.note) report.push(r.note);
      if (r.changed) { recs = r.records; changed = true; }
      const s = await fixPictureBoxSize(recs, sourceHwpx, codec, report);
      if (s.changed) { recs = s.records; changed = true; }
    } catch (e) {
      report.push(`⚠ 그림 ID 보정 실패: ${String(e.message ?? e).slice(0, 60)}`);
    }
  }

  // 머리말/꼬리말 표 높이 보정 (원본 없이 가능)
  {
    const r = fixHeaderFooterTableHeight(recs, report);
    if (r.changed) { recs = r.records; changed = true; }
  }

  // 그림 원본 크기 보정 (HWP 안의 이미지만으로 가능)
  try {
    const r = await fixPictureNaturalSize(recs, entries, read, codec, report);
    if (r.changed) { recs = r.records; changed = true; }
  } catch (e) {
    report.push(`⚠ 그림 원본크기 보정 실패: ${String(e.message ?? e).slice(0, 60)}`);
  }

  // 요약정보 스트림은 OLE 규약상 0x05 접두가 붙어야 한다. rhwp는 접두 없이 써서
  // 이 이름을 요구하는 리더(예: olefile 기반 파서)가 문서를 통째로 못 읽는다.
  const needsPrefix = entries.some((e) => e.name === SUMMARY_NAME);
  if (needsPrefix) {
    report.push('요약정보 스트림 이름에 0x05 접두 부여');
    changed = true;
  }

  if (!changed) return { out: buf, changed: false, report };

  const body = concat(recs.map((r) => encodeRecord(r.tagId, r.level, r.data)));
  const section = compressed ? await codec.deflateRaw(body) : body;

  const items = [];
  for (const e of entries) {
    if (e.type === 5) continue;
    const renamed = e.name === SUMMARY_NAME ? SUMMARY_PREFIX + SUMMARY_NAME : e.name;
    items.push({
      path: e.path === e.name ? renamed : e.path,
      name: renamed,
      type: e.type,
      data: e.type === 2 ? (e.path === 'BodyText/Section0' ? section : read(e)) : undefined,
    });
  }
  return { out: writeCfb(items), changed: true, report };
}

/** 섹션 첫 문단에 단 정의(cold)를 넣고 관련 필드를 맞춘다. */
function fixColumnDef(para0, recs, end, report) {
  const out = [];
  for (const r of para0) {
    if (r.tagId === PARA_HEADER) {
      const d = r.data.slice();
      const before = u32(d, 0);
      setU32(d, 0, before + 8); // 컨트롤 문자 8자 추가분
      out.push({ ...r, data: d });
      report.push(`PARA_HEADER 글자수 ${before} → ${before + 8}`);
    } else if (r.tagId === PARA_TEXT) {
      // secd 컨트롤(앞 16B) 바로 뒤에 cold 컨트롤 문자 삽입
      const d = concat([r.data.subarray(0, 16), COLD_CHAR, r.data.subarray(16)]);
      out.push({ ...r, data: d });
      report.push(`PARA_TEXT ${r.data.length}B → ${d.length}B (cold 컨트롤 문자)`);
    } else if (r.tagId === PARA_CHAR_SHAPE) {
      // 첫 항목 위치는 반드시 0이어야 한다. rhwp는 컨트롤 길이만큼 밀어서 쓴다.
      const d = r.data.slice();
      if (d.length >= 8 && u32(d, 0) !== 0) {
        report.push(`PARA_CHAR_SHAPE 첫 위치 ${u32(d, 0)} → 0`);
        setU32(d, 0, 0);
      }
      out.push({ ...r, data: d });
    } else {
      out.push(r);
    }
  }

  // PAGE_BORDER_FILL은 양쪽/짝수/홀수 3개가 와야 한다
  const pbf = out.map((r, i) => (r.tagId === PAGE_BORDER_FILL ? i : -1)).filter((i) => i >= 0);
  if (pbf.length === 1) {
    out.splice(pbf[0] + 1, 0, out[pbf[0]], out[pbf[0]]);
    report.push('PAGE_BORDER_FILL 1개 → 3개');
  }

  // secd의 level>=2 자식들 뒤에 cold CTRL_HEADER 삽입
  let j = out.findIndex((r) => ctrlId(r) === 'secd') + 1;
  if (j === 0) { report.push('⚠ secd 없음 — 단 정의 보정 생략'); return recs; }
  while (j < out.length && out[j].level >= 2) j++;
  out.splice(j, 0, { tagId: CTRL_HEADER, level: 1, size: COLD_CTRL.length, data: COLD_CTRL });
  report.push('CTRL_HEADER cold 삽입');

  return [...out, ...recs.slice(end)];
}

/** 브라우저용 압축 어댑터 (CompressionStream) */
export const browserCodec = {
  async inflateRaw(u8) {
    const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  },
  async deflateRaw(u8) {
    const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  },
};
