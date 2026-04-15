import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');
const LOG_DIR = path.join(REPORTS_DIR, 'sast-vue-logs');
const SUMMARY_FILE = path.join(REPORTS_DIR, 'sast-vue-report-summary.json');

const STEPS = [
    {
        name: 'semgrep',
        command: 'node',
        args: ['scripts/sast-vue-semgrep.mjs'],
        stdoutFile: 'semgrep.stdout.log',
        stderrFile: 'semgrep.stderr.log',
        cleanupFiles: ['reports/semgrep-vue.json'],
        reportFile: 'reports/semgrep-vue.json'
    },
    {
        name: 'eslint-report',
        command: 'npx',
        args: [
            'eslint',
            'src',
            '--ext',
            '.vue,.js,.ts',
            '--ignore-path',
            '.gitignore',
            '--cache',
            '--cache-location',
            '.cache/eslint-vue',
            '--format',
            'json',
            '--output-file',
            'reports/eslint.json'
        ],
        env: { TSESTREE_IGNORE_TYPESCRIPT_VERSION: 'true' },
        stdoutFile: 'eslint.stdout.log',
        stderrFile: 'eslint.stderr.log',
        cleanupFiles: ['reports/eslint.json'],
        reportFile: 'reports/eslint.json',
        allowFailure: true
    },
    {
        name: 'typecheck-report',
        command: 'npx',
        args: ['vue-tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', '.cache/vue-tsc.sast.tsbuildinfo'],
        stdoutFile: '../typecheck.txt',
        stderrFile: 'typecheck.stderr.log',
        cleanupFiles: ['reports/typecheck.txt'],
        reportFile: 'reports/typecheck.txt'
    }
];

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function clearLogFile(filePath) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, '', 'utf8');
}

function appendLog(filePath, chunk) {
    if (chunk?.length) {
        fs.appendFileSync(filePath, chunk);
    }
}

function writeSummary(summary) {
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));
}

function removeFileIfExists(relativePath) {
    const filePath = path.join(ROOT, relativePath);
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
    }
}

function getFileSize(relativePath) {
    const filePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(filePath)) {
        return 0;
    }
    return fs.statSync(filePath).size;
}

function buildFailureHint(step, result) {
    const stderrSize = getFileSize(result.stderrPath);
    const stdoutSize = getFileSize(result.stdoutPath);
    const reportSize = step.reportFile ? getFileSize(step.reportFile) : 0;

    if (stderrSize > 0) {
        return `stderr: ${result.stderrPath}`;
    }
    if (reportSize > 0) {
        return `report: ${step.reportFile}`;
    }
    if (stdoutSize > 0) {
        return `stdout: ${result.stdoutPath}`;
    }
    return `summary: ${path.relative(ROOT, SUMMARY_FILE)}`;
}

function runStep(step) {
    const stdoutPath = path.join(LOG_DIR, step.stdoutFile);
    const stderrPath = path.join(LOG_DIR, step.stderrFile);
    for (const file of step.cleanupFiles || []) {
        removeFileIfExists(file);
    }
    clearLogFile(stdoutPath);
    clearLogFile(stderrPath);

    const startedAt = new Date().toISOString();

    return new Promise((resolve) => {
        const child = spawn(step.command, step.args, {
            cwd: ROOT,
            env: { ...process.env, ...step.env },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        child.stdout.on('data', (chunk) => {
            process.stdout.write(chunk);
            appendLog(stdoutPath, chunk);
        });

        child.stderr.on('data', (chunk) => {
            process.stderr.write(chunk);
            appendLog(stderrPath, chunk);
        });

        child.on('error', (error) => {
            const finishedAt = new Date().toISOString();
            appendLog(stderrPath, `${error.stack || error.message}\n`);
            resolve({
                name: step.name,
                startedAt,
                finishedAt,
                status: 'error',
                exitCode: null,
                stdoutPath: path.relative(ROOT, stdoutPath),
                stderrPath: path.relative(ROOT, stderrPath),
                error: error.message
            });
        });

        child.on('close', (code, signal) => {
            const finishedAt = new Date().toISOString();
            resolve({
                name: step.name,
                startedAt,
                finishedAt,
                status: code === 0 ? 'passed' : 'failed',
                exitCode: code,
                signal,
                stdoutPath: path.relative(ROOT, stdoutPath),
                stderrPath: path.relative(ROOT, stderrPath),
                reportFile: step.reportFile || null
            });
        });
    });
}

async function main() {
    ensureDir(REPORTS_DIR);
    ensureDir(LOG_DIR);
    ensureDir(path.join(ROOT, '.cache'));

    const summary = {
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: 'passed',
        steps: []
    };
    writeSummary(summary);

    for (const step of STEPS) {
        console.log(`\n[sast:vue:report] starting ${step.name}`);
        const result = await runStep(step);
        summary.steps.push(result);
        writeSummary(summary);

        if (result.status !== 'passed') {
            const failureHint = buildFailureHint(step, result);
            if (step.allowFailure) {
                console.warn(`[sast:vue:report] ${step.name} reported issues but is non-blocking. ${failureHint}`);
                continue;
            }

            summary.status = 'failed';
            summary.finishedAt = new Date().toISOString();
            writeSummary(summary);
            console.error(`[sast:vue:report] ${step.name} failed. ${failureHint}`);
            process.exit(result.exitCode ?? 1);
        }

        console.log(`[sast:vue:report] completed ${step.name}`);
    }

    summary.finishedAt = new Date().toISOString();
    writeSummary(summary);
}

main().catch((error) => {
    ensureDir(REPORTS_DIR);
    ensureDir(LOG_DIR);

    const summary = {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'error',
        steps: [],
        error: error.stack || error.message
    };
    writeSummary(summary);
    console.error(error);
    process.exit(1);
});
