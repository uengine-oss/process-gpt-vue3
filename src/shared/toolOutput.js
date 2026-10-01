/**
 * MCP 도구 결과(output) 를 객체로 읽는다.
 *
 * 같은 도구라도 에이전트에 따라 JSON 문자열, `content='{...}'`, 콘텐츠 블록 목록
 * (`content=[{'type': 'text', 'text': '{...}'}]`) 등 여러 꼴로 온다. 채팅방(ChatRoomPage)이
 * 쓰던 파서를 그대로 옮겨, 채팅 화면(Chat.vue)의 프로세스 실행 카드도 같은 규칙으로 읽게 한다.
 *
 * @returns {object|null} 읽지 못하면 null
 */
export function parseMcpToolOutput(outputStr) {
    if (!outputStr) return null;
    if (typeof outputStr === 'object') return outputStr;

    const sanitizeForJsonParse = (s) => {
        if (typeof s !== 'string') return s;
        let out = '';
        let inString = false;
        let escaped = false;

        for (let i = 0; i < s.length; i++) {
            const ch = s[i];

            if (ch === '\n' || ch === '\r' || ch === '\t') continue;

            if (inString) {
                out += ch;
                if (escaped) {
                    escaped = false;
                } else if (ch === '\\') {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
                out += ch;
                continue;
            }

            if (ch === '\\') {
                const next = s[i + 1];
                if (next === 'n' || next === 'r' || next === 't') {
                    i++;
                    continue;
                }
            }

            out += ch;
        }

        return out.trim();
    };

    const normalizeNewlines = (val) => {
        if (typeof val !== 'string') return val;
        return val.replace(/\\\\\\\\n/g, '\\\\n').replace(/\\\\n/g, '\n');
    };

    const normalizeParsedObject = (parsed) => {
        if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
            parsed.image_analysis_result = normalizeNewlines(parsed.image_analysis_result);
        }
        return parsed;
    };

    const tryParseJsonSafely = (source) => {
        if (typeof source !== 'string') return null;
        const trimmed = source.trim();
        if (!trimmed) return null;

        const candidates = [
            trimmed,
            sanitizeForJsonParse(trimmed),
            trimmed.replace(/\\'/g, "'"),
            sanitizeForJsonParse(trimmed.replace(/\\'/g, "'")),
            trimmed.replace(/\\\\/g, '\\').replace(/\\'/g, "'"),
            sanitizeForJsonParse(trimmed.replace(/\\\\/g, '\\').replace(/\\'/g, "'"))
        ];

        for (const candidate of candidates) {
            try {
                return normalizeParsedObject(JSON.parse(candidate));
            } catch (e) {
                // 다음 후보로 재시도
            }
        }
        return null;
    };

    /**
     * `'text': '...'` 처럼 따옴표로 둘러싸인 값 하나를 선형 시간으로 떼어 낸다.
     * 시작 위치는 여는 따옴표를 가리켜야 한다.
     */
    const readQuoted = (text, quoteAt) => {
        const quote = text[quoteAt];
        if (quote !== "'" && quote !== '"') return null;
        const body = text.slice(quoteAt + 1);
        const safePattern = quote === "'" ? /^[^'\\]*(?:\\.[^'\\]*)*/ : /^[^"\\]*(?:\\.[^"\\]*)*/;
        const m = safePattern.exec(body);
        if (!m || body[m[0].length] !== quote) return null;
        return m[0];
    };

    /**
     * MCP 결과가 리스트로 오는 경우를 푼다.
     *
     * 같은 도구라도 에이전트에 따라 문자열(`content='{...}'`) 로 오기도 하고
     * 콘텐츠 블록 목록(`content=[{'type': 'text', 'text': '{...}'}]`) 으로도
     * 온다. 뒤쪽을 못 읽으면 실행에 성공하고도 인스턴스 ID 를 꺼내지 못해
     * **화면이 실행된 인스턴스로 넘어가지 않는다.**
     */
    const extractFirstTextBlock = (rawText) => {
        if (typeof rawText !== 'string' || !rawText.startsWith('content=[')) return null;
        const m = /['"]text['"]\s*:\s*/.exec(rawText);
        if (!m) return null;
        return readQuoted(rawText, m.index + m[0].length);
    };

    const extractContentField = (rawText) => {
        if (typeof rawText !== 'string' || !rawText.startsWith('content=')) return null;
        const listText = extractFirstTextBlock(rawText);
        if (listText !== null) return listText;
        const quote = rawText[8];
        if (quote !== "'" && quote !== '"') return null;
        // 원래는 (?:\\.|(?!\1)[\s\S])* 형태의 백트래킹 정규식을 썼는데, 이스케이프 문자(\)가
        // 많이 섞인 큰 문자열(예: read_file로 읽은 스킬 문서 원문)에 대해 catastrophic
        // backtracking을 일으켜 메인 스레드가 무한정 멈추는 원인이었다(CPU 프로파일로 확인).
        // "이스케이프 아닌 문자 연속" / "이스케이프 쌍" 을 겹치지 않게 번갈아 매칭하는
        // 선형 시간 패턴으로 교체한다.
        const body = rawText.slice(9);
        const safePattern = quote === "'" ? /^[^'\\]*(?:\\.[^'\\]*)*/ : /^[^"\\]*(?:\\.[^"\\]*)*/;
        const m = safePattern.exec(body);
        const content = m[0];
        const rest = body.slice(content.length);
        if (rest[0] !== quote) return null;
        const afterQuote = rest.slice(1);
        if (afterQuote === '' || /^\s+\w+=/.test(afterQuote)) {
            return content;
        }
        return null;
    };

    const tryParseFromText = (rawText) => {
        if (typeof rawText !== 'string') return null;

        const directParsed = tryParseJsonSafely(rawText);
        if (directParsed) return directParsed;

        const contentField = extractContentField(rawText);
        if (contentField) {
            const parsedFromContent = tryParseJsonSafely(contentField);
            if (parsedFromContent) return parsedFromContent;
        }

        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            const jsonSlice = rawText.substring(firstBrace, lastBrace + 1);
            const parsedFromSlice = tryParseJsonSafely(jsonSlice);
            if (parsedFromSlice) return parsedFromSlice;
        }

        return null;
    };

    const parsed = tryParseFromText(outputStr);
    if (parsed) return parsed;

    console.warn('[parseMcpToolOutput] JSON 파싱 실패');
    return null;
}
