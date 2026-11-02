/**
 * 두 구간 녹화 + 타임라인 + TTS 내레이션 → 최종 데모 영상.
 *
 *   1) 각 구간을 마크 기준으로 잘라, 'wait'(LLM 대기) 구간만 배속 압축한다.
 *      사건(입력·응답·저장)은 실시간 그대로 둔다.
 *   2) 두 구간을 이어붙인다.
 *   3) 내레이션 mp3 를 순서대로 배치해 합친다.
 *
 * 실행: cd services/frontend && node e2e/handover/assemble-parts.mjs
 * 산출물: docs/demo/mined-process-to-live-demo.mp4
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const HERE = join(process.cwd(), 'e2e/handover');
const REPO_ROOT = resolve(process.cwd(), '../..');
const OUT_DIR = join(REPO_ROOT, 'docs/demo');
const OUT = join(OUT_DIR, 'handover-to-live-process-demo.mp4');
const TMP = join(HERE, 'e2e-results/assemble');

const WAIT_SPEED = Number(process.env.WAIT_SPEED || 12); // 대기 구간 배속
const MIN_WAIT_KEEP = 4; // 압축해도 최소 이만큼(초)은 남겨 진행이 보이게

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf-8', maxBuffer: 1 << 28 });
const dur = (f) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

function segmentsOf(marks, total) {
    const segs = [];
    for (let i = 0; i < marks.length; i++) {
        const start = marks[i].at;
        const end = i + 1 < marks.length ? marks[i + 1].at : total;
        if (end - start < 0.4) continue;
        segs.push({ start, end, wait: marks[i].phase === 'wait', name: marks[i].name });
    }
    return segs;
}

function cutPart(part, idxOffset, parts) {
    const tlName = typeof part === 'string' ? `gen-timeline-${part}.json` : `gen-timeline-part${part}.json`;
    const dirName = typeof part === 'string' ? part : `part${part}`;
    const tl = JSON.parse(readFileSync(join(HERE, tlName), 'utf-8'));
    const dir = join(HERE, `e2e-results/gen-demo/${dirName}`);
    const webm = readdirSync(dir).filter((f) => f.endsWith('.webm')).map((f) => join(dir, f))[0];
    if (!webm) throw new Error(`구간${part} 녹화 파일 없음: ${dir}`);

    const vlen = dur(webm);
    console.log(`\n구간${part}: 원본 ${vlen.toFixed(1)}초 · 마크 ${tl.marks.length}개`);
    const segs = segmentsOf(tl.marks, Math.min(tl.total, vlen));

    segs.forEach((s, i) => {
        const len = Math.min(s.end, vlen) - s.start;
        if (len <= 0.4) return;
        const out = join(TMP, `p${part}-${String(i).padStart(2, '0')}.mp4`);
        let speed = 1;
        if (s.wait) speed = len / WAIT_SPEED > MIN_WAIT_KEEP ? WAIT_SPEED : Math.max(1, len / MIN_WAIT_KEEP);
        const args = ['-y', '-ss', String(s.start), '-t', String(len), '-i', webm];
        if (speed > 1) args.push('-filter:v', `setpts=PTS/${speed}`);
        args.push('-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30', out);
        sh('ffmpeg', args);
        parts.push(out);
        console.log(`  [${idxOffset + i}] ${s.name.padEnd(18)} ${len.toFixed(1)}s ${speed > 1 ? `→ ${speed.toFixed(1)}x` : '(실시간)'}`);
    });
    return segs.length;
}

function main() {
    mkdirSync(TMP, { recursive: true });
    mkdirSync(OUT_DIR, { recursive: true });

    const parts = [];
    // ① 실제 업무 대화 → 인계 (버튼 클릭·대화 흐름이 그대로 보이는 구간)
    let n = cutPart('work', 0, parts);
    // ② 실제 앱의 인계 마이닝 화면 (/mining/handover) — 기존 BPMN 모델러로 렌더
    n += cutPart('mining', n, parts);
    // ③ 도출 결과를 실제 앱의 생성 기능으로 등록
    n += cutPart(1, n, parts);
    cutPart(2, n, parts);

    // 이어붙이기
    const listFile = join(TMP, 'concat.txt');
    writeFileSync(listFile, parts.map((p) => `file '${p}'`).join('\n'), 'utf-8');
    const silent = join(TMP, 'video.mp4');
    sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent]);
    const vlen = dur(silent);
    console.log(`\n편집 후 영상 ${vlen.toFixed(1)}초`);

    // 내레이션 배치 — 영상 길이에 맞춰 균등 분배(겹치지 않게)
    const narration = JSON.parse(readFileSync(join(HERE, 'narration/narration.json'), 'utf-8'))
        .filter((n) => n.duration && existsSync(n.file));
    const speech = narration.reduce((s, n) => s + n.duration, 0);
    const gap = Math.max(0.4, (vlen - speech) / (narration.length + 1));
    console.log(`내레이션 ${narration.length}개 · 발화 ${speech.toFixed(1)}초 · 간격 ${gap.toFixed(1)}초`);

    let cursor = gap;
    const inputs = [];
    const filters = [];
    narration.forEach((n, i) => {
        inputs.push('-i', n.file);
        const ms = Math.round(cursor * 1000);
        filters.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
        cursor += n.duration + gap;
    });
    const filter = `${filters.join(';')};${narration.map((_, i) => `[a${i}]`).join('')}amix=inputs=${narration.length}:normalize=0[aout]`;

    sh('ffmpeg', [
        '-y', '-i', silent, ...inputs,
        '-filter_complex', filter,
        '-map', '0:v', '-map', '[aout]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT
    ]);

    console.log(`\n완성: ${OUT}`);
    console.log(`길이 ${dur(OUT).toFixed(1)}초`);
}

main();
