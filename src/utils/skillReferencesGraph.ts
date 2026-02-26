export type SkillFileMeta = {
    path: string;
    skillName?: string;
    size?: number | null;
    modified?: string | null;
};

export type SkillReferenceGraphNodeData = {
    id: string;
    type: 'file' | 'external';
    path?: string;
    label: string;
    isMarkdown?: boolean;
    externalRefCount?: number;
    skillName?: string;
    isCurrentSkill?: number;
    url?: string;
};

export type SkillSkillData = {
    skillName: string;
    filesMeta: SkillFileMeta[];
    contentsByPath: Record<string, string | undefined>;
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
    /** When provided, builds tenant-wide graph with cross-skill references */
    allSkillsData?: SkillSkillData[];
};

export type BuildSkillReferenceGraphOutput = {
    elements: CytoscapeElement[];
    fileIdByPath: Record<string, string>;
};

/** Updates isCurrentSkill on elements for the given current skill (for tenant cache reuse) */
export function updateGraphCurrentSkill(
    elements: CytoscapeElement[],
    currentSkillName: string
): CytoscapeElement[] {
    return elements.map((el) => {
        if (el?.data?.type !== 'file') return el;
        let isCurrent = true;
        if (el.data.skillName != null) {
            isCurrent = el.data.skillName === currentSkillName;
        } else if (el.data.path?.includes('/')) {
            const firstSeg = el.data.path.split('/')[0];
            isCurrent = firstSeg === currentSkillName;
        }
        return {
            ...el,
            data: { ...el.data, isCurrentSkill: isCurrent ? 1 : 0 }
        };
    });
}

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

    const bareUrlRe = /https?:\/\/[^\s)\]>\"'<\n]+/g;
    while ((m = bareUrlRe.exec(s))) {
        let u = String(m[0] || '').trim();
        u = u.replace(/[.,;:!?]+$/, '');
        if (u && !out.includes(u)) out.push(u);
    }

    return out;
}

function isOpenableExternalUrl(raw: string): boolean {
    const s = String(raw || '').trim();
    return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//');
}

function urlToShortLabel(url: string): string {
    try {
        const u = url.replace(/^\/\//, 'https://');
        const parsed = new URL(u);
        return parsed.hostname || url;
    } catch {
        return url.length > 40 ? url.slice(0, 37) + '...' : url;
    }
}

function qualPath(skillName: string, path: string): string {
    const p = normalizePath(path || '');
    return p ? `${skillName}/${p}` : skillName;
}

function parseQualPath(qualifiedPath: string): { skillName: string; path: string } | null {
    const q = normalizePath(qualifiedPath || '');
    if (!q) return null;
    const idx = q.indexOf('/');
    if (idx <= 0) return null;
    return { skillName: q.slice(0, idx), path: q.slice(idx + 1) };
}

export function buildSkillReferenceGraph(
    input: BuildSkillReferenceGraphInput
): BuildSkillReferenceGraphOutput {
    const includeNonMarkdownNodes = input.includeNonMarkdownNodes !== false;
    const tenantMode = Array.isArray(input.allSkillsData) && input.allSkillsData.length > 0;
    const currentSkillName = input.skillName;

    const knownPaths = new Set<string>();
    const fileIdByPath: Record<string, string> = {};
    const nodeDataById = new Map<string, SkillReferenceGraphNodeData>();
    const edgeAgg = new Map<string, SkillReferenceGraphEdgeData>();
    const contentsByPathMap = new Map<string, string>();
    const srcPathToSkill = new Map<string, string>();

    if (tenantMode) {
        // 선택된 스킬(current skill) 데이터만 로드 (외부 스킬 참조 감지 안 함)
        const currentSkillData = input.allSkillsData!.find(
            (sd) => String(sd?.skillName || '').trim() === currentSkillName
        );
        if (currentSkillData) {
            const skillName = String(currentSkillData.skillName || '').trim();
            const metas = Array.isArray(currentSkillData.filesMeta) ? currentSkillData.filesMeta : [];
            for (const m of metas) {
                const p = normalizePath(m?.path || '');
                if (!p) continue;
                const qp = qualPath(skillName, p);
                knownPaths.add(qp);
            }
            for (const [kp, content] of Object.entries(currentSkillData.contentsByPath || {})) {
                const qp = qualPath(skillName, kp);
                contentsByPathMap.set(qp, String(content || ''));
                srcPathToSkill.set(qp, skillName);
            }
            for (const m of metas) {
                const p = normalizePath(m?.path || '');
                if (!p) continue;
                const md = isMarkdownPath(p);
                if (!md && !includeNonMarkdownNodes) continue;
                const qp = qualPath(skillName, p);
                const id = `file:${qp}`;
                fileIdByPath[qp] = id;
                const label = basename(p) || p;
                nodeDataById.set(id, {
                    id,
                    type: 'file',
                    path: qp,
                    label,
                    isMarkdown: md,
                    externalRefCount: 0,
                    skillName,
                    isCurrentSkill: 1
                });
            }
        }
    } else {
        const filesMeta = Array.isArray(input.filesMeta) ? input.filesMeta : [];
        for (const f of filesMeta) {
            const p = normalizePath(f.path || '');
            if (p) knownPaths.add(p);
        }
        for (const [kp, content] of Object.entries(input.contentsByPath || {})) {
            contentsByPathMap.set(normalizePath(kp), String(content || ''));
        }
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
                externalRefCount: 0,
                isCurrentSkill: 1
            });
        }
    }

    const resolveTarget = (
        rawTarget: string,
        srcQualPath: string,
        srcDir: string
    ): string | null => {
        const normalized = normalizePath(rawTarget);
        if (!normalized) return null;
        if (tenantMode) {
            const resolved = joinAndResolve(srcDir, normalized);
            if (!resolved) return null;
            if (knownPaths.has(resolved)) return resolved;
            return tryResolveMissingExtension(resolved, knownPaths);
        } else {
            const resolved = joinAndResolve(srcDir, normalized);
            if (!resolved) return null;
            if (knownPaths.has(resolved)) return resolved;
            return tryResolveMissingExtension(resolved, knownPaths);
        }
    };

    const iterateContents = tenantMode
        ? contentsByPathMap.entries()
        : Object.entries(input.contentsByPath || {}).map(([k, v]) => [normalizePath(k), String(v || '')] as [string, string]);

    for (const [rawPath, content] of iterateContents) {
        const srcPath = tenantMode ? rawPath : normalizePath(rawPath);
        if (!srcPath) continue;
        if (!isMarkdownPath(tenantMode ? (parseQualPath(srcPath)?.path ?? srcPath) : srcPath)) continue;
        const srcId = fileIdByPath[srcPath] || `file:${srcPath}`;

        if (!nodeDataById.has(srcId)) {
            fileIdByPath[srcPath] = srcId;
            const parsed = tenantMode ? parseQualPath(srcPath) : null;
            const skillName = parsed?.skillName ?? currentSkillName;
            const label = tenantMode && parsed
                ? (skillName === currentSkillName ? basename(parsed.path) || parsed.path : `${skillName}: ${basename(parsed.path) || parsed.path}`)
                : basename(srcPath) || srcPath;
            nodeDataById.set(srcId, {
                id: srcId,
                type: 'file',
                path: srcPath,
                label,
                isMarkdown: true,
                externalRefCount: 0,
                skillName: tenantMode ? skillName : undefined,
                isCurrentSkill: tenantMode ? (skillName === currentSkillName ? 1 : 0) : 1
            });
        }

        const srcNode = nodeDataById.get(srcId)!;
        const targets = extractMdLinkTargets(String(content || ''));
        const srcDir = tenantMode ? dirname(parseQualPath(srcPath)?.path ?? srcPath) : dirname(srcPath);
        const srcQualDir = tenantMode ? dirname(srcPath) : '';

        for (const rawTarget of targets) {
            const t = String(rawTarget || '').trim();
            if (!t) continue;
            if (isExternalUrl(t)) {
                if (!t.startsWith('#')) srcNode.externalRefCount = (srcNode.externalRefCount || 0) + 1;
                if (isOpenableExternalUrl(t)) {
                    const extId = `ext:${t}`;
                    if (!nodeDataById.has(extId)) {
                        nodeDataById.set(extId, {
                            id: extId,
                            type: 'external',
                            label: urlToShortLabel(t),
                            url: t,
                            isCurrentSkill: 0
                        });
                    }
                    const edgeKey = `${srcId}-->${extId}`;
                    const existing = edgeAgg.get(edgeKey);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        edgeAgg.set(edgeKey, {
                            id: `ref:${srcId}->${extId}`,
                            type: 'ref',
                            source: srcId,
                            target: extId,
                            count: 1
                        });
                    }
                }
                continue;
            }

            const targetPath = tenantMode
                ? resolveTarget(t, srcPath, srcQualDir)
                : resolveTarget(t, srcPath, srcDir);
            if (!targetPath) continue;

            const tgtId = fileIdByPath[targetPath] || `file:${targetPath}`;
            fileIdByPath[targetPath] = tgtId;
            if (!nodeDataById.has(tgtId)) {
                const parsed = tenantMode ? parseQualPath(targetPath) : null;
                const tgtSkill = parsed?.skillName ?? currentSkillName;
                const tgtLabel = tenantMode && parsed
                    ? (tgtSkill === currentSkillName ? basename(parsed.path) || parsed.path : `${tgtSkill}: ${basename(parsed.path) || parsed.path}`)
                    : basename(targetPath) || targetPath;
                nodeDataById.set(tgtId, {
                    id: tgtId,
                    type: 'file',
                    path: targetPath,
                    label: tgtLabel,
                    isMarkdown: isMarkdownPath(targetPath),
                    externalRefCount: 0,
                    skillName: tenantMode ? tgtSkill : undefined,
                    isCurrentSkill: tenantMode ? (tgtSkill === currentSkillName ? 1 : 0) : 1
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

    // Structural edges: top-level SKILL.md -> all other files in the same skill
    const skillRootIdBySkill = new Map<string, string>();
    const fileIdsBySkill = new Map<string, string[]>();
    for (const [id, data] of nodeDataById.entries()) {
        if (data.type !== 'file') continue;
        const path = data.path ?? '';
        const skillName = data.skillName ?? currentSkillName;
        const isTopLevelSkillMd = tenantMode
            ? path === `${skillName}/SKILL.md`
            : path === 'SKILL.md';
        if (isTopLevelSkillMd) skillRootIdBySkill.set(skillName, id);
        if (!fileIdsBySkill.has(skillName)) fileIdsBySkill.set(skillName, []);
        fileIdsBySkill.get(skillName)!.push(id);
    }
    for (const [skillName, rootId] of skillRootIdBySkill) {
        const fileIds = fileIdsBySkill.get(skillName) ?? [];
        for (const tgtId of fileIds) {
            if (tgtId === rootId) continue;
            const edgeKey = `${rootId}-->${tgtId}`;
            if (edgeAgg.has(edgeKey)) continue;
            edgeAgg.set(edgeKey, {
                id: `ref:${rootId}->${tgtId}`,
                type: 'ref',
                source: rootId,
                target: tgtId,
                count: 1
            });
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
