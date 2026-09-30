/**
 * 줄 단위 diff.
 *
 * 정의 원문(XML)을 나란히 놓기만 하면 어디가 달라졌는지 사람이 눈으로 찾아야 한다.
 * 라이브러리를 하나 더 들이는 대신, 줄 배열의 최장 공통 부분수열만 구해 +/-/문맥으로 나눈다.
 */

export type LineKind = 'ctx' | 'add' | 'del';

export interface DiffLine {
    type: LineKind;
    text: string;
}

/** 이만큼 큰 파일은 LCS 표가 수천만 칸이 된다 — 그 앞에서 화면이 먼저 멈춘다. */
const MAX_LINES = 3000;

/** 바뀐 자리 앞뒤로 남길 문맥 줄 수. 전부 남기면 원문을 통째로 다시 읽는 셈이다. */
const CONTEXT = 3;

function lcsTable(a: string[], b: string[]): number[][] {
    const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }
    return table;
}

/** 바뀐 줄만 문맥과 함께 남긴다. 사이가 멀면 잘라 내고 자른 자리를 표시한다. */
function trimToChanges(lines: DiffLine[]): DiffLine[] {
    const keep = new Set<number>();
    lines.forEach((line, index) => {
        if (line.type === 'ctx') return;
        for (let i = Math.max(0, index - CONTEXT); i <= Math.min(lines.length - 1, index + CONTEXT); i++) keep.add(i);
    });
    if (!keep.size) return [];

    const out: DiffLine[] = [];
    let skipped = false;
    lines.forEach((line, index) => {
        if (keep.has(index)) {
            if (skipped) {
                out.push({ type: 'ctx', text: '…' });
                skipped = false;
            }
            out.push(line);
        } else {
            skipped = true;
        }
    });
    return out;
}

export function diffLines(before: string, after: string): DiffLine[] {
    const a = String(before || '').split('\n');
    const b = String(after || '').split('\n');

    if (a.length > MAX_LINES || b.length > MAX_LINES) {
        // 비교를 포기하는 대신, 적어도 어느 쪽이 얼마나 긴지는 말해 준다.
        return [
            { type: 'del', text: `(${a.length} lines)` },
            { type: 'add', text: `(${b.length} lines)` }
        ];
    }

    const table = lcsTable(a, b);
    const lines: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            lines.push({ type: 'ctx', text: a[i] });
            i++;
            j++;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
            lines.push({ type: 'del', text: a[i] });
            i++;
        } else {
            lines.push({ type: 'add', text: b[j] });
            j++;
        }
    }
    while (i < a.length) lines.push({ type: 'del', text: a[i++] });
    while (j < b.length) lines.push({ type: 'add', text: b[j++] });

    return trimToChanges(lines);
}
