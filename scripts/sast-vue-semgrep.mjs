import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, '.tmp', 'semgrep-vue-src');
const REPORTS_DIR = path.join(ROOT, 'reports');
const MAP_FILE = path.join(REPORTS_DIR, 'semgrep-vue-map.json');
const SEMGREP_REPORT = path.join(REPORTS_DIR, 'semgrep-vue.json');

function walkVueFiles(dir, acc = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkVueFiles(fullPath, acc);
            continue;
        }
        if (entry.isFile() && entry.name.endsWith('.vue')) {
            acc.push(fullPath);
        }
    }
    return acc;
}

function clearDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

function extractScripts(vueContent) {
    const blocks = [];
    const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(vueContent)) !== null) {
        const attrs = match[1] || '';
        const code = match[2] || '';
        const before = vueContent.slice(0, match.index);
        const line = before.split('\n').length;
        const isTs = /\blang\s*=\s*["']ts["']/i.test(attrs);
        blocks.push({ attrs, code, line, isTs });
    }
    return blocks;
}

function writeExtractedScripts(vueFiles) {
    const map = [];

    for (const vueFile of vueFiles) {
        const relPath = path.relative(ROOT, vueFile);
        const content = fs.readFileSync(vueFile, 'utf8');
        const scripts = extractScripts(content);

        scripts.forEach((block, idx) => {
            if (!block.code.trim()) return;
            const ext = block.isTs ? 'ts' : 'js';
            const safeName = relPath.replace(/[\\/]/g, '__').replace(/\.vue$/i, '');
            const outFile = path.join(OUT_DIR, `${safeName}__script${idx + 1}.${ext}`);
            const wrapped = `// source: ${relPath}\n// source-script-start-line: ${block.line}\n${block.code}\n`;
            fs.writeFileSync(outFile, wrapped, 'utf8');
            map.push({
                sourceFile: relPath,
                sourceStartLine: block.line,
                extractedFile: path.relative(ROOT, outFile),
                lang: ext
            });
        });
    }

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(MAP_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), items: map }, null, 2));
    return map.length;
}

function runSemgrep() {
    const args = [
        'scan',
        '--config',
        './semgrep-rules',
        '--metrics',
        'off',
        '--exclude',
        'node_modules',
        '--exclude',
        'dist',
        '--exclude',
        'public',
        '--json',
        '--output',
        SEMGREP_REPORT,
        OUT_DIR
    ];

    const result = spawnSync('semgrep', args, { stdio: 'inherit', cwd: ROOT });
    if (result.error) {
        console.error(`Failed to run semgrep: ${result.error.message}`);
        process.exit(2);
    }
    process.exit(result.status ?? 1);
}

function main() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error('src directory not found.');
        process.exit(1);
    }
    clearDir(OUT_DIR);
    const vueFiles = walkVueFiles(SRC_DIR);
    const extractedCount = writeExtractedScripts(vueFiles);
    if (extractedCount === 0) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        fs.writeFileSync(SEMGREP_REPORT, JSON.stringify({ results: [], errors: [] }, null, 2));
        console.log('No <script> blocks found in .vue files.');
        process.exit(0);
    }
    runSemgrep();
}

main();
