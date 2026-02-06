export type SkillFileMeta = {
    path: string;
    size?: number | null;
    modified?: string | null;
};

export type SkillReferenceGraphNodeData = {
    id: string;
    type: 'file';
    path: string;
    label: string;
    isMarkdown: boolean;
    externalRefCount: number;
};

export type SkillReferenceGraphEdgeData = {
    id: string;
    type: 'ref';
    source: string;
    target: string;
    count: number;
};

export type CytoscapeElement =
    | { data: SkillReferenceGraphNodeData }
    | { data: SkillReferenceGraphEdgeData };

export type BuildSkillReferenceGraphInput = {
    skillName: string;
    filesMeta: SkillFileMeta[];
    contentsByPath: Record<string, string | undefined>;
    includeNonMarkdownNodes?: boolean;
};

export type BuildSkillReferenceGraphOutput = {
    elements: CytoscapeElement[];
    fileIdByPath: Record<string, string>;
};

function isExternalUrl(raw: string): boolean {
    const s = String(raw || '').trim();
    if (!s) return false;
    if (s.startsWith('#')) return true;
    if (s.startsWith('mailto:') || s.startsWith('tel:') || s.startsWith('data:')) return true;
    if (s.startsWith('http://') || s.startsWith('https://')) return true;
    if (s.startsWith('//')) return true;
    return false;
}

function normalizePath(rawPath: string): string {
    let p = String(rawPath || '').trim();
    if (p.startsWith('<') && p.endsWith('>')) p = p.slice(1, -1).trim();
    p = p.replace(/\\/g, '/');
    p = p.replace(/[?#].*$/, '');
    p = p.replace(/^\.\//, '');
    p = p.replace(/\/{2,}/g, '/');
    p = p.replace(/\/$/, '');
    return p;
}

function dirname(path: string): string {
    const p = normalizePath(path);
    const idx = p.lastIndexOf('/');
    return idx >= 0 ? p.slice(0, idx) : '';
}

function joinAndResolve(fromDir: string, target: string): string {
    const base = normalizePath(fromDir);
    let t = normalizePath(target);
    if (!t) return '';
    if (t.startsWith('/')) t = t.slice(1);
    const parts = (base ? `${base}/${t}` : t).split('/').filter(Boolean);
    const out: string[] = [];
    for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
            out.pop();
            continue;
        }
        out.push(part);
    }
    return out.join('/');
}

function basename(path: string): string {
    const p = normalizePath(path);
    const idx = p.lastIndexOf('/');
    return idx >= 0 ? p.slice(idx + 1) : p;
}

function isMarkdownPath(path: string): boolean {
    const p = normalizePath(path).toLowerCase();
    return p.endsWith('.md') || p.endsWith('.markdown');
}

function tryResolveMissingExtension(
    normalizedTarget: string,
    knownPaths: Set<string>
): string | null {
    if (!normalizedTarget) return null;
    if (knownPaths.has(normalizedTarget)) return normalizedTarget;
    if (/\.[a-z0-9]+$/i.test(normalizedTarget)) return null;
    const candidates = [`${normalizedTarget}.md`, `${normalizedTarget}.markdown`].filter((c) =>
        knownPaths.has(c)
    );
    if (candidates.length === 1) return candidates[0];
    return null;
}

function extractMdLinkTargets(text: string): string[] {
    const out: string[] = [];
    const s = String(text || '');

    const mdLinkRe = /!\[[^\]]*?\]\(([^)]+)\)|\[[^\]]*?\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = mdLinkRe.exec(s))) {
        const rawInside = (m[1] ?? m[2] ?? '').trim();
        if (!rawInside) continue;
        let target = rawInside;
        if (target.startsWith('<')) {
            const end = target.indexOf('>');
            if (end > 0) target = target.slice(0, end + 1);
        } else {
            target = target.split(/\s+/)[0] ?? '';
        }
        if (target) out.push(target);
    }

    const wikiRe = /\[\[([^\]]+?)\]\]/g;
    while ((m = wikiRe.exec(s))) {
        const inside = String(m[1] || '').trim();
        if (!inside) continue;
        const parts = inside.split('|').map((p) => p.trim()).filter(Boolean);
        const target = parts.length === 1 ? parts[0] : parts[parts.length - 1];
        if (target) out.push(target);
    }

    const plainPathRe = /(^|[^A-Za-z0-9_\-/])([A-Za-z0-9_\-/]+?\.(?:md|markdown))(?![A-Za-z0-9_\-/])/gi;
    while ((m = plainPathRe.exec(s))) {
        const p = String(m[2] || '').trim();
        if (p) out.push(p);
    }

    return out;
}

export function buildSkillReferenceGraph(
    input: BuildSkillReferenceGraphInput
): BuildSkillReferenceGraphOutput {
    const includeNonMarkdownNodes = input.includeNonMarkdownNodes !== false;
    const filesMeta = Array.isArray(input.filesMeta) ? input.filesMeta : [];
    const knownPaths = new Set(
        filesMeta
            .map((f) => normalizePath(f.path || ''))
            .filter((p) => p && p.length > 0)
    );

    const fileIdByPath: Record<string, string> = {};
    const nodeDataById = new Map<string, SkillReferenceGraphNodeData>();
    const edgeAgg = new Map<string, SkillReferenceGraphEdgeData>();

    for (const meta of filesMeta) {
        const p = normalizePath(meta?.path || '');
        if (!p) continue;
        const md = isMarkdownPath(p);
        if (!md && !includeNonMarkdownNodes) continue;
        const id = `file:${p}`;
        fileIdByPath[p] = id;
        nodeDataById.set(id, {
            id,
            type: 'file',
            path: p,
            label: basename(p) || p,
            isMarkdown: md,
            externalRefCount: 0
        });
    }

    for (const [rawPath, content] of Object.entries(input.contentsByPath || {})) {
        const srcPath = normalizePath(rawPath);
        if (!srcPath) continue;
        if (!isMarkdownPath(srcPath)) continue;
        const srcId = fileIdByPath[srcPath] || `file:${srcPath}`;

        if (!nodeDataById.has(srcId)) {
            fileIdByPath[srcPath] = srcId;
            nodeDataById.set(srcId, {
                id: srcId,
                type: 'file',
                path: srcPath,
                label: basename(srcPath) || srcPath,
                isMarkdown: true,
                externalRefCount: 0
            });
        }

        const srcNode = nodeDataById.get(srcId)!;
        const targets = extractMdLinkTargets(String(content || ''));
        const srcDir = dirname(srcPath);

        for (const rawTarget of targets) {
            const t = String(rawTarget || '').trim();
            if (!t) continue;
            if (isExternalUrl(t)) {
                if (!t.startsWith('#')) srcNode.externalRefCount += 1;
                continue;
            }

            const normalized = normalizePath(t);
            if (!normalized) continue;
            const resolved = joinAndResolve(srcDir, normalized);
            if (!resolved) continue;

            let targetPath: string | null = null;
            if (knownPaths.has(resolved)) targetPath = resolved;
            else targetPath = tryResolveMissingExtension(resolved, knownPaths);
            if (!targetPath) continue;

            const tgtId = fileIdByPath[targetPath] || `file:${targetPath}`;
            fileIdByPath[targetPath] = tgtId;
            if (!nodeDataById.has(tgtId)) {
                nodeDataById.set(tgtId, {
                    id: tgtId,
                    type: 'file',
                    path: targetPath,
                    label: basename(targetPath) || targetPath,
                    isMarkdown: isMarkdownPath(targetPath),
                    externalRefCount: 0
                });
            }

            const edgeKey = `${srcId}-->${tgtId}`;
            const existing = edgeAgg.get(edgeKey);
            if (existing) {
                existing.count += 1;
            } else {
                edgeAgg.set(edgeKey, {
                    id: `ref:${srcId}->${tgtId}`,
                    type: 'ref',
                    source: srcId,
                    target: tgtId,
                    count: 1
                });
            }
        }
    }

    const elements: CytoscapeElement[] = [];
    for (const node of nodeDataById.values()) {
        elements.push({ data: node });
    }
    for (const edge of edgeAgg.values()) {
        if (edge.source === edge.target) continue;
        elements.push({ data: edge });
    }

    return { elements, fileIdByPath };
}
