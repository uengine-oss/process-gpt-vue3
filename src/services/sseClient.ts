/**
 * SSE(Server-Sent Events) over fetch — POST 전용 공용 클라이언트.
 *
 * 백엔드의 스트리밍 엔드포인트(generate-bpmn/stream, generate-bpmn-from-confluence/stream,
 * qdrant-chat/stream 등)는 모두 동일한 와이어 포맷을 사용한다:
 *
 *   data: {"type":"delta","text":"...토큰 조각..."}
 *   data: {"type":"done", ...}      // 종료 직전 1회 (xml 또는 answer 등 페이로드 포함)
 *   data: [DONE]
 *   data: {"type":"error","message":"..."}   // 오류 시 (이후 [DONE])
 *
 * 표준 EventSource는 GET 전용이라 POST(+JSON/FormData) 스트림에는 쓸 수 없으므로
 * fetch + ReadableStream으로 직접 파싱한다.
 */

/** 스트림 시작 전(HTTP 비정상) 또는 스트림 내부 error 이벤트를 표현하는 에러 */
export class SseError extends Error {
    /** HTTP 상태코드. 스트림 내부 error 이벤트는 status 필드(없으면 0). */
    status: number;
    /** 스트림 내부 error 이벤트의 원본 페이로드(code/pipeline_log 등 부가 정보 포함). */
    event?: any;
    constructor(status: number, message: string, event?: any) {
        super(message);
        this.name = 'SseError';
        this.status = status;
        this.event = event;
    }
}

export interface StreamSseOptions {
    /** 추가 헤더 (Content-Type 등). FormData 전송 시 Content-Type은 지정하지 않는다. */
    headers?: Record<string, string>;
    /** 취소용 AbortSignal */
    signal?: AbortSignal;
    /** delta 토큰 조각이 도착할 때마다 호출 (실시간 표시용) */
    onDelta?: (text: string) => void;
    /** 모든 파싱된 이벤트에 대해 호출 (delta/done/error 포함) */
    onEvent?: (event: any) => void;
}

/**
 * SSE 스트림을 POST로 호출하고 종료 시 'done' 이벤트 페이로드를 반환한다.
 *
 * - HTTP가 2xx가 아니면(=스트림 시작 전 검증 오류 등) 응답 JSON의 detail로 SseError를 던진다.
 * - 스트림 내부 'error' 이벤트가 오면 그 message로 SseError(status=0)를 던진다.
 * - 정상 종료([DONE]) 시 마지막 'done' 이벤트 객체를 반환한다(없으면 null).
 */
export async function streamSse(url: string, body: BodyInit, options: StreamSseOptions = {}): Promise<any> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: options.headers,
        body,
        signal: options.signal
    });

    if (!response.ok || !response.body) {
        const errorBody = await response.json().catch(() => null);
        throw new SseError(response.status, errorBody?.detail ?? `요청 실패 (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneEvent: any = null;

    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE 이벤트는 빈 줄(\n\n)로 구분된다.
            const chunks = buffer.split('\n\n');
            buffer = chunks.pop() ?? '';
            for (const chunk of chunks) {
                const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
                if (!dataLine) continue;
                const payload = dataLine.slice('data:'.length).trim();
                if (!payload) continue;
                if (payload === '[DONE]') return doneEvent;

                let event: any;
                try {
                    event = JSON.parse(payload);
                } catch {
                    continue;
                }
                options.onEvent?.(event);
                if (event.type === 'delta') {
                    options.onDelta?.(event.text ?? '');
                } else if (event.type === 'error') {
                    throw new SseError(
                        typeof event.status === 'number' ? event.status : 0,
                        event.message || '스트리밍 중 오류가 발생했습니다.',
                        event
                    );
                } else if (event.type === 'done') {
                    doneEvent = event;
                }
            }
        }
        return doneEvent;
    } finally {
        // 조기 return/throw 시에도 연결을 확실히 닫는다.
        reader.cancel().catch(() => {});
    }
}
