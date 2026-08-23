import {
    getExplicitMajorStageColumn,
    getMajorBusinessDomain,
    getProcessStageColumnFromValue,
    isProcessStageValue,
    PROCESS_STAGE_LABELS
} from './processClassification';
import type { ProcessStageColumn } from './processClassification';

interface MoveMajorOptions {
    majorId: string;
    newStage: string;
    sourceMegaId?: string;
    targetMegaId?: string;
    domains?: any[];
}

interface MajorLocation {
    mega: any;
    major: any;
    index: number;
}

function sameProcessId(process: any, id: string): boolean {
    return process?.id === id || process?.pid === id || process?.proc_def_id === id;
}

function findMegaById(map: any, megaId: string): any | null {
    if (!megaId) return null;
    return (map?.mega_proc_list || []).find((mega: any) => mega.id === megaId || mega.pid === megaId || mega.name === megaId) || null;
}

function findMajorLocationById(map: any, majorId: string, preferredMegaId = ''): MajorLocation | null {
    const findInMega = (mega: any): MajorLocation | null => {
        const index = (mega?.major_proc_list || []).findIndex((major: any) => sameProcessId(major, majorId));
        return index >= 0 ? { mega, major: mega.major_proc_list[index], index } : null;
    };

    const preferredMega = findMegaById(map, preferredMegaId);
    const preferredMatch = preferredMega ? findInMega(preferredMega) : null;
    if (preferredMatch) return preferredMatch;

    for (const mega of map?.mega_proc_list || []) {
        const match = findInMega(mega);
        if (match) return match;
    }
    return null;
}

function findMajorById(map: any, majorId: string): any | null {
    return findMajorLocationById(map, majorId)?.major || null;
}

function getMegaStageColumn(mega: any): ProcessStageColumn | null {
    const candidates = [
        mega?.category,
        mega?.process_category,
        mega?.processCategory,
        mega?.stage,
        mega?.process_stage,
        mega?.processStage,
        mega?.lifecycle_stage,
        mega?.lifecycleStage,
        mega?.phase,
        mega?.name,
        mega?.id
    ];

    for (const candidate of candidates) {
        const exactColumn = getProcessStageColumnFromValue(candidate, true);
        if (exactColumn) return exactColumn;
    }

    for (const candidate of candidates) {
        const inferredColumn = getProcessStageColumnFromValue(candidate);
        if (inferredColumn) return inferredColumn;
    }

    return null;
}

function findMegaByStage(map: any, stage: string, preferredMegaId = ''): any | null {
    const preferredMega = findMegaById(map, preferredMegaId);
    if (preferredMega) return preferredMega;

    const targetColumn = getProcessStageColumnFromValue(stage) || getProcessStageColumnFromValue(stage, true);
    const targetLabel = targetColumn ? PROCESS_STAGE_LABELS[targetColumn] : stage;
    const normalizedStage = String(stage || '').trim();

    for (const mega of map?.mega_proc_list || []) {
        if ([mega?.id, mega?.pid, mega?.name].some((value) => String(value || '').trim() === normalizedStage)) {
            return mega;
        }
        if (targetLabel && [mega?.id, mega?.pid, mega?.name].some((value) => String(value || '').trim() === targetLabel)) {
            return mega;
        }
    }

    if (!targetColumn) return null;

    return (map?.mega_proc_list || []).find((mega: any) => getMegaStageColumn(mega) === targetColumn) || null;
}

function applyStageFields(major: any, stage: string) {
    major.category = stage;
    if (major.stage !== undefined) major.stage = stage;
    if (major.process_stage !== undefined) major.process_stage = stage;
    if (major.processStage !== undefined) major.processStage = stage;
    if (major.lifecycle_stage !== undefined) major.lifecycle_stage = stage;
    if (major.lifecycleStage !== undefined) major.lifecycleStage = stage;
}

function findSubLocation(map: any, subId: string, preferredMajorId = ''): { major: any; index: number } | null {
    const findInMajor = (major: any) => {
        const index = (major.sub_proc_list || []).findIndex((sub: any) => {
            return sameProcessId(sub, subId);
        });
        return index >= 0 ? { major, index } : null;
    };

    if (preferredMajorId) {
        const preferredMajor = findMajorById(map, preferredMajorId);
        const preferredMatch = preferredMajor ? findInMajor(preferredMajor) : null;
        if (preferredMatch) return preferredMatch;
    }

    for (const mega of map?.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            const match = findInMajor(major);
            if (match) return match;
        }
    }
    return null;
}

export function applySubMajorMove(map: any, subId: string, fromMajorId: string, toMajorId: string): boolean {
    const source = findSubLocation(map, subId, fromMajorId);
    const targetMajor = findMajorById(map, toMajorId);
    if (!source || !targetMajor) return false;

    const movedSub = source.major.sub_proc_list.splice(source.index, 1)[0];
    // 이동된 sub의 pid를 새 major 기준으로 재계산
    const prefix = toMajorId + '.';
    let maxIndex = 0;
    for (const sub of targetMajor.sub_proc_list || []) {
        const pid = sub.pid || '';
        if (pid.startsWith(prefix)) {
            const suffix = pid.slice(prefix.length);
            if (!suffix.includes('.')) {
                const n = parseInt(suffix, 10);
                if (!isNaN(n) && n > maxIndex) maxIndex = n;
            }
        }
    }
    movedSub.pid = `${toMajorId}.${maxIndex + 1}`;
    targetMajor.sub_proc_list = [...(targetMajor.sub_proc_list || []), movedSub];
    return true;
}

export function applyMajorStageMove(map: any, options: MoveMajorOptions): boolean {
    const source = findMajorLocationById(map, options.majorId, options.sourceMegaId);
    if (!source) return false;

    const major = source.major;
    const businessDomain = getMajorBusinessDomain(major, options.domains || []);
    const targetColumn = getProcessStageColumnFromValue(options.newStage);
    const stageLabel = targetColumn ? PROCESS_STAGE_LABELS[targetColumn] : options.newStage;
    const targetMega = findMegaByStage(map, options.newStage, options.targetMegaId);

    applyStageFields(major, stageLabel);

    if (businessDomain) {
        if (isProcessStageValue(major.domain)) major.domain = businessDomain;
        if (isProcessStageValue(major.domain_id)) major.domain_id = businessDomain;
    }

    if (targetMega && targetMega !== source.mega) {
        const movedMajor = source.mega.major_proc_list.splice(source.index, 1)[0];
        targetMega.major_proc_list = targetMega.major_proc_list || [];

        const duplicateIndex = targetMega.major_proc_list.findIndex((item: any) => sameProcessId(item, options.majorId));
        if (duplicateIndex >= 0) {
            targetMega.major_proc_list.splice(duplicateIndex, 1, movedMajor);
        } else {
            targetMega.major_proc_list.push(movedMajor);
        }
    }

    return true;
}

export function normalizeMajorStagePlacement(map: any): boolean {
    const moves: Array<{ sourceMega: any; targetMega: any; majorId: string }> = [];

    for (const sourceMega of map?.mega_proc_list || []) {
        for (const major of sourceMega.major_proc_list || []) {
            const explicitStageColumn = getExplicitMajorStageColumn(major);
            if (!explicitStageColumn) continue;

            const targetMega = findMegaByStage(map, PROCESS_STAGE_LABELS[explicitStageColumn]);
            if (!targetMega || targetMega === sourceMega) continue;

            const majorId = major.id || major.pid || major.proc_def_id;
            if (!majorId) continue;
            moves.push({ sourceMega, targetMega, majorId });
        }
    }

    for (const move of moves) {
        const sourceList = move.sourceMega.major_proc_list || [];
        const sourceIndex = sourceList.findIndex((major: any) => sameProcessId(major, move.majorId));
        if (sourceIndex < 0) continue;

        const movedMajor = sourceList.splice(sourceIndex, 1)[0];
        move.targetMega.major_proc_list = move.targetMega.major_proc_list || [];

        const duplicateIndex = move.targetMega.major_proc_list.findIndex((major: any) => sameProcessId(major, move.majorId));
        if (duplicateIndex >= 0) {
            move.targetMega.major_proc_list.splice(duplicateIndex, 1, movedMajor);
        } else {
            move.targetMega.major_proc_list.push(movedMajor);
        }
    }

    return moves.length > 0;
}
