import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../');
const KO_PATH = resolve(ROOT, 'src/utils/locales/ko.json');
const EN_PATH = resolve(ROOT, 'src/utils/locales/en.json');

const KOREAN_REGEX = /[\uAC00-\uD7A3]/;

function flattenKeys(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenKeys(value, path));
        } else {
            result[path] = value;
        }
    }
    return result;
}

function extractLineKeyMap(filePath) {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    const keyStack = [];
    const lineKeyMap = new Map();
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
        const isObjectOpen = /:\s*\{/.test(line);
        const isCloseBrace = /^\s*\}/.test(line);

        if (isCloseBrace) {
            if (keyStack.length > 0) keyStack.pop();
            depth = Math.max(0, depth - 1);
            continue;
        }

        if (keyMatch) {
            const key = keyMatch[1];
            while (keyStack.length > depth) keyStack.pop();

            if (isObjectOpen) {
                keyStack.push(key);
                depth++;
                lineKeyMap.set(lineNum, keyStack.join('.'));
            } else {
                const fullPath = keyStack.length > 0 ? `${keyStack.join('.')}.${key}` : key;
                lineKeyMap.set(lineNum, fullPath);
            }
        }
    }
    return lineKeyMap;
}

function findUntranslatedInEnglish(enFlat) {
    const untranslated = [];
    for (const [key, value] of Object.entries(enFlat)) {
        if (typeof value === 'string' && KOREAN_REGEX.test(value)) {
            untranslated.push({ key, value });
        }
    }
    return untranslated;
}

function run() {
    let koData, enData;
    try {
        koData = JSON.parse(readFileSync(KO_PATH, 'utf8'));
    } catch (e) {
        console.error(`ko.json 읽기 실패: ${e.message}`);
        process.exit(1);
    }
    try {
        enData = JSON.parse(readFileSync(EN_PATH, 'utf8'));
    } catch (e) {
        console.error(`en.json 읽기 실패: ${e.message}`);
        process.exit(1);
    }

    const koFlat = flattenKeys(koData);
    const enFlat = flattenKeys(enData);
    const koKeys = new Set(Object.keys(koFlat));
    const enKeys = new Set(Object.keys(enFlat));

    const missingInEn = [...koKeys].filter((k) => !enKeys.has(k));
    const missingInKo = [...enKeys].filter((k) => !koKeys.has(k));

    const koLineMap = extractLineKeyMap(KO_PATH);
    const enLineMap = extractLineKeyMap(EN_PATH);

    const lineMismatches = [];
    const maxLine = Math.max(...koLineMap.keys(), ...enLineMap.keys());
    for (let line = 1; line <= maxLine; line++) {
        const koKey = koLineMap.get(line);
        const enKey = enLineMap.get(line);
        if (koKey && enKey && koKey !== enKey) {
            lineMismatches.push({ line, koKey, enKey });
        }
    }

    const untranslated = findUntranslatedInEnglish(enFlat);

    const koLineReverse = new Map();
    for (const [line, key] of koLineMap.entries()) koLineReverse.set(key, line);
    const enLineReverse = new Map();
    for (const [line, key] of enLineMap.entries()) enLineReverse.set(key, line);

    console.log('=== i18n Locale Sync Report ===\n');

    console.log(`[MISSING IN en.json] (${missingInEn.length} keys)`);
    if (missingInEn.length === 0) {
        console.log('  None');
    } else {
        for (const key of missingInEn) {
            const line = koLineReverse.get(key) || '?';
            console.log(`  - ${key} (ko.json line ${line})`);
        }
    }

    console.log(`\n[MISSING IN ko.json] (${missingInKo.length} keys)`);
    if (missingInKo.length === 0) {
        console.log('  None');
    } else {
        for (const key of missingInKo) {
            const line = enLineReverse.get(key) || '?';
            console.log(`  - ${key} (en.json line ${line})`);
        }
    }

    console.log(`\n[LINE MISMATCH] (${lineMismatches.length} locations)`);
    if (lineMismatches.length === 0) {
        console.log('  None');
    } else {
        for (const { line, koKey, enKey } of lineMismatches) {
            console.log(`  Line ${line}: ko="${koKey}" vs en="${enKey}"`);
        }
    }

    console.log(`\n[UNTRANSLATED IN en.json] (${untranslated.length} keys)`);
    if (untranslated.length === 0) {
        console.log('  None');
    } else {
        for (const { key, value } of untranslated) {
            const line = enLineReverse.get(key) || '?';
            console.log(`  - ${key}: "${value}" (line ${line})`);
        }
    }

    const totalIssues = missingInEn.length + missingInKo.length + lineMismatches.length + untranslated.length;
    console.log(
        `\nTotal: ${missingInEn.length} missing in en, ${missingInKo.length} missing in ko, ${lineMismatches.length} line mismatches, ${untranslated.length} untranslated`
    );

    if (totalIssues === 0) {
        console.log('\nAll locale files are in sync.');
    }

    process.exit(totalIssues > 0 ? 1 : 0);
}

run();
