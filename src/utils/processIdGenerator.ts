/**
 * 프로세스 ID 생성 유틸리티
 * 계층별 ID 규칙: DOM-001, MEGA-001, MAJ-001, SUB-001
 */

export type ProcessIdType = 'domain' | 'mega' | 'major' | 'sub';

export interface ProcessSequences {
    domain: number;
    mega: number;
    major: number;
    sub: number;
}

// ID 프리픽스 정의
const ID_PREFIXES: Record<ProcessIdType, string> = {
    domain: 'DOM',
    mega: 'MEGA',
    major: 'MAJ',
    sub: 'SUB'
};

// 기본 시퀀스 값
const DEFAULT_SEQUENCES: ProcessSequences = {
    domain: 1,
    mega: 1,
    major: 1,
    sub: 1
};

/**
 * 시퀀스 번호를 3자리 문자열로 포맷
 * @param num 시퀀스 번호
 * @returns 3자리 문자열 (예: 001, 012, 123)
 */
function formatSequence(num: number): string {
    return num.toString().padStart(3, '0');
}

/**
 * 프로세스 ID 생성
 * @param type 프로세스 타입 (domain, mega, major, sub)
 * @param sequence 시퀀스 번호
 * @returns 생성된 ID (예: DOM-001, MEGA-002)
 */
export function generateProcessId(type: ProcessIdType, sequence: number): string {
    const prefix = ID_PREFIXES[type];
    return `${prefix}-${formatSequence(sequence)}`;
}

/**
 * ID에서 타입과 시퀀스 추출
 * @param id 프로세스 ID (예: DOM-001)
 * @returns { type, sequence } 또는 null
 */
export function parseProcessId(id: string): { type: ProcessIdType; sequence: number } | null {
    const match = id.match(/^(DOM|MEGA|MAJ|SUB)-(\d{3})$/);
    if (!match) return null;

    const prefixToType: Record<string, ProcessIdType> = {
        DOM: 'domain',
        MEGA: 'mega',
        MAJ: 'major',
        SUB: 'sub'
    };

    return {
        type: prefixToType[match[1]],
        sequence: parseInt(match[2], 10)
    };
}

/**
 * ID가 유효한 형식인지 검증
 * @param id 검증할 ID
 * @param expectedType 예상 타입 (선택적)
 * @returns 유효 여부
 */
export function isValidProcessId(id: string, expectedType?: ProcessIdType): boolean {
    const parsed = parseProcessId(id);
    if (!parsed) return false;
    if (expectedType && parsed.type !== expectedType) return false;
    return true;
}

/**
 * 프로세스 ID 생성기 클래스
 * 상태를 유지하며 순차적인 ID 생성 지원
 */
export class ProcessIdGenerator {
    private sequences: ProcessSequences;

    constructor(initialSequences?: Partial<ProcessSequences>) {
        this.sequences = { ...DEFAULT_SEQUENCES, ...initialSequences };
    }

    /**
     * 다음 ID 생성
     * @param type 프로세스 타입
     * @returns 생성된 ID
     */
    next(type: ProcessIdType): string {
        const id = generateProcessId(type, this.sequences[type]);
        this.sequences[type]++;
        return id;
    }

    /**
     * 현재 시퀀스 조회
     * @param type 프로세스 타입
     * @returns 현재 시퀀스 번호
     */
    getCurrentSequence(type: ProcessIdType): number {
        return this.sequences[type];
    }

    /**
     * 시퀀스 설정
     * @param type 프로세스 타입
     * @param value 시퀀스 값
     */
    setSequence(type: ProcessIdType, value: number): void {
        this.sequences[type] = value;
    }

    /**
     * 모든 시퀀스 조회
     * @returns 시퀀스 객체
     */
    getSequences(): ProcessSequences {
        return { ...this.sequences };
    }

    /**
     * 시퀀스 초기화
     * @param sequences 새 시퀀스 값
     */
    resetSequences(sequences?: Partial<ProcessSequences>): void {
        this.sequences = { ...DEFAULT_SEQUENCES, ...sequences };
    }
}

/**
 * 기존 ID 목록에서 다음 시퀀스 계산
 * @param existingIds 기존 ID 목록
 * @param type 프로세스 타입
 * @returns 다음 시퀀스 번호
 */
export function getNextSequenceFromIds(existingIds: string[], type: ProcessIdType): number {
    const prefix = ID_PREFIXES[type];
    const regex = new RegExp(`^${prefix}-(\\d{3})$`);

    let maxSequence = 0;

    existingIds.forEach(id => {
        const match = id.match(regex);
        if (match) {
            const seq = parseInt(match[1], 10);
            if (seq > maxSequence) {
                maxSequence = seq;
            }
        }
    });

    return maxSequence + 1;
}

/**
 * 레거시 ID를 새 형식으로 변환
 * @param legacyId 레거시 ID (예: my_process_name)
 * @param type 프로세스 타입
 * @param sequence 시퀀스 번호
 * @returns 새 형식 ID
 */
export function convertLegacyId(legacyId: string, type: ProcessIdType, sequence: number): string {
    return generateProcessId(type, sequence);
}

// 기본 export
export default {
    generateProcessId,
    parseProcessId,
    isValidProcessId,
    getNextSequenceFromIds,
    convertLegacyId,
    ProcessIdGenerator
};
