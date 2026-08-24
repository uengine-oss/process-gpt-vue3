/**
 * BPMN Generation Service
 *
 * 업무 시나리오를 텍스트 / 파일 / Confluence 중 하나로 입력받아
 * AI로 BPMN 2.0 XML을 생성하는 백엔드 엔드포인트의 전송(transport) 계층.
 *
 * - text / file → POST /langchain-chat/generate-bpmn/stream                 (multipart/form-data, SSE)
 * - confluence  → POST /langchain-chat/generate-bpmn-from-confluence/stream  (application/json, SSE)
 *
 * 큰 BPMN XML이 게이트웨이/프록시 버퍼링으로 잘리는 것을 막기 위해 SSE 스트리밍 엔드포인트를
 * 사용한다. 토큰을 누적해 최종 done 이벤트의 { xml, scenario_source, guideline_source }로 resolve 하며,
 * onProgress 콜백으로 생성 중 텍스트를 실시간 노출할 수 있다. (반환 계약은 기존과 동일)
 *
 * OpenUI 래핑 해제 / 캔버스 적용 등 UI 관심사는 호출 측(컴포넌트)에서 처리한다.
 *
 * 참고: ../playground-pi-system-backend/docs/bpmn-generation-frontend-guide.md
 */
import { streamSse, SseError } from './sseClient';

// 배포 환경에서는 /pi-system-backend prefix 뒤로 라우팅된다.
// (Vite dev 프록시도 /pi-system-backend/ 를 동일 백엔드로 전달 후 prefix 제거)
const API_BASE_URL = '/pi-system-backend';
// AI 응답이 길 수 있으므로 넉넉히 (파일 파싱 + LLM 호출)
const TIMEOUT_MS = 180_000;

export type BpmnSourceType = 'text' | 'file' | 'confluence';

export interface GenerateBpmnResponse {
    xml: string;
    scenario_source: 'input_text' | 'file' | 'confluence' | string;
    guideline_source: 'guideline_text' | 'confluence' | '' | string;
    /** 일부 응답은 부가 설명(answer)을 함께 반환할 수 있다. */
    answer?: string;
}

export interface GenerateBpmnParams {
    sourceType: BpmnSourceType;
    /** sourceType=text 일 때 필수 */
    inputText?: string;
    /** sourceType=file 일 때 file 또는 fileUrl 중 하나 필수 */
    file?: File | null;
    /** 업로드 대신 다운로드 가능한 파일 URL */
    fileUrl?: string;
    /** sourceType=confluence 일 때 필수 */
    confluenceUrl?: string;
    /** 추가 가이드라인 텍스트 (공통, 선택) */
    guidelineText?: string;
    /** 추가 가이드라인 Confluence URL (공통, 선택) */
    guidelineUrl?: string;
}

/** 서버가 내려주는 한국어 detail 메시지를 그대로 담는 에러 */
export class BpmnGenerationError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'BpmnGenerationError';
        this.status = status;
    }
}

/** 클라이언트 측 사전 검증용 상수 (서버도 재검증함) */
export const SUPPORTED_FILE_EXTENSIONS = [
    '.pdf',
    '.docx',
    '.xlsx',
    '.xlsm',
    '.pptx',
    '.hwp',
    '.hwpx',
    '.txt',
    '.md',
    '.csv',
    '.json',
    '.xml',
    '.log'
];
export const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB

/**
 * 외부 abort signal과 내부 타임아웃을 묶은 signal을 만든다.
 * 둘 중 하나라도 abort되면 요청이 취소된다.
 */
function withTimeout(
    externalSignal?: AbortSignal,
    timeoutMs: number = TIMEOUT_MS
): { signal: AbortSignal; clear: () => void; isTimedOut: () => boolean } {
    const controller = new AbortController();
    // 내부 타임아웃으로 인한 abort인지(=isTimedOut), 외부(사용자 취소)로 인한 abort인지 구분하기 위한 플래그.
    // 둘 다 AbortError를 발생시키므로, 호출 측에서 타임아웃 메시지를 따로 노출하려면 이 구분이 필요하다.
    let timedOut = false;
    const onExternalAbort = () => controller.abort();

    if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    return {
        signal: controller.signal,
        isTimedOut: () => timedOut,
        clear: () => {
            clearTimeout(timeoutId);
            externalSignal?.removeEventListener('abort', onExternalAbort);
        }
    };
}

/** done 이벤트(SSE) → GenerateBpmnResponse 로 변환. xml 누락 시 에러. */
function doneToResponse(done: any): GenerateBpmnResponse {
    if (!done || typeof done.xml !== 'string' || !done.xml.trim()) {
        throw new BpmnGenerationError(500, 'BPMN 생성 응답이 비어 있습니다.');
    }
    return {
        xml: done.xml,
        scenario_source: done.scenario_source ?? '',
        guideline_source: done.guideline_source ?? ''
    };
}

/** SseError(스트림 시작 전 HTTP 오류 또는 스트림 내부 error 이벤트) → BpmnGenerationError 로 변환 */
function mapStreamError(error: unknown, isTimedOut: () => boolean): never {
    // 타임아웃으로 인한 abort는 사용자 취소(AbortError)와 구분해 메시지를 노출한다.
    if (isTimedOut()) throw new BpmnGenerationError(408, '응답 시간이 초과되었습니다. 다시 시도해 주세요.');
    if (error instanceof SseError) throw new BpmnGenerationError(error.status || 500, error.message);
    throw error; // AbortError(사용자 취소) 등은 그대로 전파
}

/** 파일/텍스트 → multipart/form-data (SSE 스트리밍) */
async function generateFromFileOrText(
    params: GenerateBpmnParams,
    externalSignal?: AbortSignal,
    onProgress?: (accumulatedText: string) => void
): Promise<GenerateBpmnResponse> {
    const form = new FormData();
    form.append('sourceType', params.sourceType); // "text" | "file"
    if (params.inputText) form.append('inputText', params.inputText);
    if (params.file) form.append('file', params.file);
    if (params.fileUrl) form.append('fileUrl', params.fileUrl);
    if (params.guidelineText) form.append('guidelineText', params.guidelineText);
    if (params.guidelineUrl) form.append('guidelineUrl', params.guidelineUrl);

    const { signal, clear, isTimedOut } = withTimeout(externalSignal);
    let accumulated = '';
    try {
        const done = await streamSse(`${API_BASE_URL}/langchain-chat/generate-bpmn/stream`, form, {
            // Content-Type은 브라우저가 boundary 포함해 자동 설정 (직접 지정 금지)
            signal,
            onDelta: onProgress
                ? (text) => {
                      accumulated += text;
                      onProgress(accumulated);
                  }
                : undefined
        });
        return doneToResponse(done);
    } catch (error) {
        mapStreamError(error, isTimedOut);
    } finally {
        clear();
    }
}

/** Confluence → application/json (SSE 스트리밍) */
async function generateFromConfluence(
    params: GenerateBpmnParams,
    externalSignal?: AbortSignal,
    onProgress?: (accumulatedText: string) => void
): Promise<GenerateBpmnResponse> {
    const { signal, clear, isTimedOut } = withTimeout(externalSignal);
    let accumulated = '';
    try {
        const done = await streamSse(
            `${API_BASE_URL}/langchain-chat/generate-bpmn-from-confluence/stream`,
            JSON.stringify({
                confluenceUrl: params.confluenceUrl,
                inputText: params.inputText,
                guidelineText: params.guidelineText,
                guidelineUrl: params.guidelineUrl
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                signal,
                onDelta: onProgress
                    ? (text) => {
                          accumulated += text;
                          onProgress(accumulated);
                      }
                    : undefined
            }
        );
        return doneToResponse(done);
    } catch (error) {
        mapStreamError(error, isTimedOut);
    } finally {
        clear();
    }
}

/**
 * 통합 진입점: sourceType에 따라 올바른 SSE 엔드포인트로 라우팅한다.
 * @param params      소스 종류 및 입력값
 * @param signal      취소용 외부 AbortSignal (선택)
 * @param onProgress  생성 중 누적 텍스트 콜백 (실시간 미리보기용, 선택)
 */
export function generateBpmn(
    params: GenerateBpmnParams,
    signal?: AbortSignal,
    onProgress?: (accumulatedText: string) => void
): Promise<GenerateBpmnResponse> {
    if (params.sourceType === 'confluence') {
        return generateFromConfluence(params, signal, onProgress);
    }
    return generateFromFileOrText(params, signal, onProgress);
}

/** 파일 확장자가 지원 목록에 포함되는지 검사 */
export function isSupportedFileExtension(fileName: string): boolean {
    const dot = fileName.lastIndexOf('.');
    if (dot < 0) return false;
    return SUPPORTED_FILE_EXTENSIONS.includes(fileName.slice(dot).toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────
// BPMN 생성 파이프라인 (Confluence 전용)
// POST /langchain-chat/generate-bpmn-pipeline
//
// Confluence 페이지를 Markdown으로 변환(draw.io 구조 보존)한 뒤
// 업무 절차 판별 → 독립 프로세스 분리 → 프로세스별 BPMN XML 병렬 생성.
// 참고: ../playground-pi-system-backend/docs/bpmn-pipeline-api-spec.md
// ─────────────────────────────────────────────────────────────────────────

// 파이프라인은 Consolidator → Classifier → Splitter → N개 병렬 생성으로 LLM을 여러 번 호출한다.
// 큰 문서/여러 소스를 통합하면 프로세스가 많아져 생성 단계가 길어질 수 있으므로 넉넉히 잡는다.
const PIPELINE_TIMEOUT_MS = 600_000;

export interface BpmnPipelineResult {
    process_name: string;
    /** 생성 실패 시 빈 문자열 */
    xml: string;
    /** 개별 생성 실패 사유. 성공 시 null */
    error: string | null;
}

export interface GenerateBpmnPipelineResponse {
    results: BpmnPipelineResult[];
    scenario_source: 'confluence' | string;
    guideline_source: 'guideline_text' | 'confluence' | '' | string;
    /** 변환 손실 가능성 표시: has_image | has_diagram | has_attachment | has_unresolved_macro */
    quality_flags: string[];
    /** 단계별 진행 로그 (소요 시간 포함) — 결과 화면에 그대로 노출 가능 */
    pipeline_log: string[];
}

export interface GenerateBpmnPipelineParams {
    confluenceUrl: string;
    guidelineText?: string;
    guidelineUrl?: string;
}

/** 문서에 업무 절차가 없을 때(422 NO_PROCESS_DATA) 발생하는 에러 */
export class BpmnNoProcessDataError extends BpmnGenerationError {
    pipelineLog: string[];
    constructor(message: string, pipelineLog: string[]) {
        super(422, message);
        this.name = 'BpmnNoProcessDataError';
        this.pipelineLog = pipelineLog;
    }
}

/** 파이프라인 스트리밍 진행 콜백 (단계 로그 / 프로세스별 결과 실시간 수신) */
export interface BpmnPipelineProgress {
    /** 단계 로그 1줄 (예: "[Parser] Markdown 변환 완료 ...") */
    onLog?: (message: string) => void;
    /** 프로세스 1건 생성 완료 (완료 순서대로 도착, index로 위치 식별) */
    onProcess?: (event: { index: number; total: number; result: BpmnPipelineResult }) => void;
}

/**
 * Confluence 페이지 → 프로세스 분리 → BPMN XML N건 병렬 생성. (SSE 스트리밍)
 *
 * 단계 로그/프로세스별 결과를 onLog/onProcess로 실시간 전달하며, 최종 done 이벤트를
 * GenerateBpmnPipelineResponse로 resolve 한다. (반환 계약은 기존 JSON 버전과 동일)
 * 일부 프로세스만 실패한 경우에도 정상 resolve 되고 results[].error 로 구분된다.
 * 업무 절차가 없으면 BpmnNoProcessDataError, 전부 실패면 BpmnGenerationError 를 던진다.
 */
/** 파이프라인 계열 done 이벤트 → GenerateBpmnPipelineResponse 로 변환. */
function pipelineDoneToResponse(done: any, defaultSource: string): GenerateBpmnPipelineResponse {
    if (!done) throw new BpmnGenerationError(500, 'BPMN 파이프라인 응답이 비어 있습니다.');
    return {
        results: Array.isArray(done.results) ? done.results : [],
        scenario_source: done.scenario_source ?? defaultSource,
        guideline_source: done.guideline_source ?? '',
        quality_flags: Array.isArray(done.quality_flags) ? done.quality_flags : [],
        pipeline_log: Array.isArray(done.pipeline_log) ? done.pipeline_log : []
    };
}

/** 파이프라인 계열 오류를 적절한 에러 타입으로 변환한다. (타임아웃/절차없음/HTTP/취소 구분) */
function mapPipelineError(error: unknown, isTimedOut: () => boolean): Error {
    // 타임아웃으로 인한 abort는 사용자 취소(AbortError)와 구분해 메시지를 노출한다.
    if (isTimedOut()) return new BpmnGenerationError(408, '응답 시간이 초과되었습니다. 다시 시도해 주세요.');
    if (error instanceof SseError) {
        const evt = error.event;
        // 업무 절차 없음(NO_PROCESS_DATA)은 정상적인 판별 결과 → 전용 에러로 전달
        if (evt && evt.code === 'NO_PROCESS_DATA') {
            return new BpmnNoProcessDataError(
                evt.message ?? '문서에서 업무 절차를 찾을 수 없습니다.',
                Array.isArray(evt.pipeline_log) ? evt.pipeline_log : []
            );
        }
        return new BpmnGenerationError(error.status || 500, error.message);
    }
    return error as Error; // AbortError(사용자 취소) 등은 그대로 전파
}

export async function generateBpmnPipeline(
    params: GenerateBpmnPipelineParams,
    externalSignal?: AbortSignal,
    progress: BpmnPipelineProgress = {}
): Promise<GenerateBpmnPipelineResponse> {
    const { signal, clear, isTimedOut } = withTimeout(externalSignal, PIPELINE_TIMEOUT_MS);
    try {
        const done = await streamSse(
            `${API_BASE_URL}/langchain-chat/generate-bpmn-pipeline/stream`,
            JSON.stringify({
                confluenceUrl: params.confluenceUrl,
                guidelineText: params.guidelineText,
                guidelineUrl: params.guidelineUrl
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                signal,
                onEvent: (evt) => {
                    if (evt.type === 'log') progress.onLog?.(evt.message);
                    else if (evt.type === 'process') progress.onProcess?.(evt);
                }
            }
        );
        return pipelineDoneToResponse(done, 'confluence');
    } catch (error) {
        throw mapPipelineError(error, isTimedOut);
    } finally {
        clear();
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 다중 소스(파일/링크/텍스트 자유 혼합) 통합 생성
// POST /langchain-chat/generate-bpmn-multi/stream  (multipart/form-data, SSE)
//
// 여러 파일과 여러 Confluence 링크, 직접 입력 텍스트를 한 요청에 함께 보내면 서버가 각 소스를
// 파싱해 하나의 context로 결정적 병합(Consolidator)한 뒤 기존 파이프라인(Classifier→Splitter→
// Generator)으로 1건 이상의 BPMN XML을 생성한다. 반환 계약은 generateBpmnPipeline과 동일하다.
// 참고: ../playground-pi-system-backend 의 generate_bpmn_multi_stream
// ─────────────────────────────────────────────────────────────────────────

export interface GenerateBpmnMultiParams {
    /** 직접 입력 업무 시나리오 텍스트 (선택) */
    inputText?: string;
    /** 업로드 파일 목록 (선택) */
    files?: File[];
    /** 업로드 대신 다운로드 가능한 파일 URL 목록 (선택) */
    fileUrls?: string[];
    /** Confluence 페이지 URL 목록 (선택) */
    confluenceUrls?: string[];
    /** 추가 가이드라인 텍스트 (선택) */
    guidelineText?: string;
    /** 추가 가이드라인 Confluence URL (선택) */
    guidelineUrl?: string;
}

/**
 * 다중 소스(파일 N개 + Confluence 링크 N개 + 텍스트)를 하나의 context로 통합해 BPMN XML들을 생성한다.
 * (multipart/form-data, SSE 스트리밍)
 *
 * 단계 로그/프로세스별 결과는 progress.onLog/onProcess로 실시간 전달되며, 최종 done 이벤트를
 * GenerateBpmnPipelineResponse(scenario_source="multi")로 resolve 한다.
 * 일부 소스/프로세스만 실패해도 정상 resolve 되고 results[].error 로 구분된다.
 * 업무 절차가 없으면 BpmnNoProcessDataError, 전부 실패면 BpmnGenerationError 를 던진다.
 */
export async function generateBpmnMulti(
    params: GenerateBpmnMultiParams,
    externalSignal?: AbortSignal,
    progress: BpmnPipelineProgress = {}
): Promise<GenerateBpmnPipelineResponse> {
    const form = new FormData();
    if (params.inputText && params.inputText.trim()) form.append('inputText', params.inputText.trim());
    (params.files || []).forEach((file) => form.append('files', file));
    (params.fileUrls || []).forEach((url) => url && url.trim() && form.append('fileUrls', url.trim()));
    (params.confluenceUrls || []).forEach((url) => url && url.trim() && form.append('confluenceUrls', url.trim()));
    if (params.guidelineText) form.append('guidelineText', params.guidelineText);
    if (params.guidelineUrl) form.append('guidelineUrl', params.guidelineUrl);

    const { signal, clear, isTimedOut } = withTimeout(externalSignal, PIPELINE_TIMEOUT_MS);
    try {
        const done = await streamSse(`${API_BASE_URL}/langchain-chat/generate-bpmn-multi/stream`, form, {
            // Content-Type은 브라우저가 boundary 포함해 자동 설정 (직접 지정 금지)
            signal,
            onEvent: (evt) => {
                if (evt.type === 'log') progress.onLog?.(evt.message);
                else if (evt.type === 'process') progress.onProcess?.(evt);
            }
        });
        return pipelineDoneToResponse(done, 'multi');
    } catch (error) {
        throw mapPipelineError(error, isTimedOut);
    } finally {
        clear();
    }
}
