/**
 * 녹화 원본 + 타임라인 + TTS 내레이션 → 최종 데모 영상.
 *
 * 하는 일:
 *   1) gen-timeline.json 의 'wait' 구간(LLM 생성 대기)만 배속 압축한다.
 *      사건(입력·응답·저장)은 실시간 그대로 둔다.
 *   2) 각 내레이션 mp3 를 해당 구간 시작 지점에 배치해 하나의 오디오로 만든다.
 *   3) 영상과 오디오를 합쳐 docs/demo/handover-to-process-demo.mp4 로 저장한다.
 *
 * 실행: cd services/frontend && node e2e/handover/assemble-demo.mjs
 */
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const HERE = join(process.cwd(), 'e2e/handover');
const RAW_DIR = join(HERE, 'e2e-results/gen-demo');
const REPO_ROOT = resolve(process.cwd(), '../..');
const OUT_DIR = join(REPO_ROOT, 'docs/demo');
const OUT = join(OUT_DIR, 'handover-to-process-demo.mp4');
const TMP = join(HERE, 'e2e-results/tmp');

const WAIT_SPEED = Number(process.env.WAIT_SPEED || 10); // 대기 구간 배속
const MIN_WAIT_KEEP = 3; // 압축 후 최소 이만큼(초)은 남겨 화면 전환이 보이게

function sh(cmd, args) {
    return execFileSync(cmd, args, { encoding: 'utf-8', maxBuffer: 1 << 28 });
}
function dur(f) {
    return parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());
}

/** 타임라인을 [구간] 목록으로 편다. */
function buildSegments(marks, total) {
    const segs = [];
    for (let i = 0; i < marks.length; i++) {
        const start = marks[i].at;
        const end = i + 1 < marks.length ? marks[i + 1].at : total;
        if (end - start < 0.3) continue;
        // 'wait' 로 시작한 마크 ~ 다음 마크까지가 대기 구간
        segs.push({ start, end, wait: marks[i].phase === 'wait', name: marks[i].name });
    }
    return segs;
}

function main() {
    const timeline = JSON.parse(readFileSync(join(HERE, 'gen-timeline.json'), 'utf-8'));
    const narration = JSON.parse(readFileSync(join(HERE, 'narration/narration.json'), 'utf-8'));

    const webm = readdirSync(RAW_DIR).filter((f) => f.endsWith('.webm')).map((f) => join(RAW_DIR, f))[0];
    if (!webm) throw new Error(`녹화 파일이 없습니다: ${RAW_DIR}`);
    mkdirSync(TMP, { recursive: true });
    mkdirSync(OUT_DIR, { recursive: true });

    const videoLen = dur(webm);
    console.log(`원본 ${videoLen.toFixed(1)}초 · 마크 ${timeline.marks.length}개`);

    const segs = buildSegments(timeline.marks, Math.min(timeline.total, videoLen));

    // ── 1) 구간별로 잘라 배속 적용
    const parts = [];
    segs.forEach((s, i) => {
        const out = join(TMP, `seg-${String(i).padStart(2, '0')}.mp4`);
        const len = s.end - s.start;
        const speed = s.wait && len / WAIT_SPEED > MIN_WAIT_KEEP ? WAIT_SPEED : s.wait ? Math.max(1, len / MIN_WAIT_KEEP) : 1;
        const args = ['-y', '-ss', String(s.start), '-t', String(len), '-i', webm];
        if (speed > 1) args.push('-filter:v', `setpts=PTS/${speed}`);
        args.push('-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', out);
        sh('ffmpeg', args);
        parts.push(out);
        console.log(`  [${i}] ${s.name} ${len.toFixed(1)}s ${speed > 1 ? `→ ${speed.toFixed(1)}x` : '(실시간)'}`);
    });

    // ── 2) 이어붙이기
    const listFile = join(TMP, 'concat.txt');
    writeFileSync(listFile, parts.map((p) => `file '${p}'`).join('\n'), 'utf-8');
    const silent = join(TMP, 'video.mp4');
    sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent]);
    const finalLen = dur(silent);
    console.log(`편집 후 ${finalLen.toFixed(1)}초`);

    // ── 3) 내레이션을 순서대로 배치 (겹치지 않게, 영상 길이에 맞춰 균등 분배)
    const gap = 0.6;
    const narrTotal = narration.reduce((s, n) => s + (n.duration || 0) + gap, 0);
    const lead = Math.max(0.5, (finalLen - narrTotal) / (narration.length + 1));
    let cursor = lead;
    const inputs = [];
    const filters = [];
    narration.forEach((n, i) => {
        inputs.push('-i', n.file);
        filters.push(`[${i + 1}:a]adelay=${Math.round(cursor * 1000)}|${Math.round(cursor * 1000)}[a${i}]`);
        cursor += (n.duration || 0) + gap + lead;
    });
    const mixIn = narration.map((_, i) => `[a${i}]`).join('');
    const filter = `${filters.join(';')};${mixIn}amix=inputs=${narration.length}:normalize=0[aout]`;

    sh('ffmpeg', [
        '-y', '-i', silent, ...inputs,
        '-filter_complex', filter,
        '-map', '0:v', '-map', '[aout]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', OUT
    ]);

    console.log(`\n완성: ${OUT}`);
    console.log(`길이 ${dur(OUT).toFixed(1)}초`);
}

main();
