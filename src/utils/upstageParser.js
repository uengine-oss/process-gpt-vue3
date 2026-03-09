/**
 * Upstage AI Document Parsing Utility
 * Reference: https://console.upstage.ai/docs/getting-started?api=document-parsing
 *
 * 전역에서 사용 가능한 Upstage AI 문서 파싱 유틸리티
 */

/**
 * File 객체를 Upstage AI로 파싱
 * @param {File} file - 파싱할 File 객체
 * @param {Object} options - 옵션 설정
 * @param {Array} options.outputFormats - 출력 형식 (기본값: ['html', 'text', 'markdown'])
 * @param {Array} options.base64Encoding - Base64로 인코딩할 요소 (기본값: ['table', 'figure'])
 * @param {string} options.ocr - OCR 설정 (기본값: 'auto')
 * @param {boolean} options.coordinates - 좌표 정보 포함 여부 (기본값: true)
 * @returns {Promise<Object>} 파싱 결과
 */
export async function parseDocumentWithUpstage(file, options = {}) {
    try {
        if (!file || !(file instanceof File)) {
            console.error('❌ 유효한 File 객체가 아닙니다.');
            return {
                success: false,
                error: '유효한 File 객체가 아닙니다.'
            };
        }

        // API 키 가져오기
        const UPSTAGE_API_KEY =
            import.meta.env.VITE_UPSTAGE_API_KEY || window._env_?.VITE_UPSTAGE_API_KEY || localStorage.getItem('upstageApiKey');

        if (!UPSTAGE_API_KEY) {
            console.warn('⚠️ Upstage API 키가 설정되지 않았습니다.');
            return {
                success: false,
                error: 'API 키가 설정되지 않았습니다.'
            };
        }

        // 파일 정보 상세 로깅
        console.log(`🚀 [Upstage] 파싱 시작:`, {
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type || '❌ MIME 타입 없음',
            lastModified: new Date(file.lastModified).toISOString()
        });

        // MIME 타입이 없거나 text/plain, text/markdown인 경우 경고
        if (!file.type || file.type === 'text/plain' || file.type === 'text/markdown') {
            console.warn(`⚠️ [Upstage] MIME 타입 문제: "${file.type}" - Upstage는 특정 문서 형식만 지원합니다.`);
        }

        // 옵션 기본값 설정
        const {
            outputFormats = ['html', 'text', 'markdown'],
            base64Encoding = ['table', 'figure'],
            ocr = 'auto',
            coordinates = true,
            model = 'document-parse'
        } = options;

        // FormData 생성
        const formData = new FormData();
        formData.append('document', file);
        formData.append('output_formats', JSON.stringify(outputFormats));
        formData.append('base64_encoding', JSON.stringify(base64Encoding));
        formData.append('ocr', ocr);
        formData.append('coordinates', String(coordinates));
        formData.append('model', model);

        const startTime = Date.now();

        // Upstage API 호출
        const response = await fetch('https://api.upstage.ai/v1/document-digitization', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${UPSTAGE_API_KEY}`
            },
            body: formData
        });

        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`⏱️ [Upstage] API 응답 시간: ${elapsed.toFixed(2)}초`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [Upstage] API 오류 (${response.status}):`, errorText);
            return {
                success: false,
                error: `API 오류 ${response.status}`,
                details: errorText
            };
        }

        const result = await response.json();
        console.log(`✅ [Upstage] 파싱 완료: ${file.name}`);

        const content = result.content || {};
        const elements = result.elements || [];

        // 텍스트 추출 (우선순위 순서: text > markdown > html > elements)
        let textContent = '';
        let textSource = '';

        if (content.text) {
            textContent = content.text;
            textSource = 'text';
        } else if (content.markdown) {
            textContent = content.markdown;
            textSource = 'markdown';
        } else if (content.html) {
            textContent = content.html;
            textSource = 'html';
        } else if (elements.length > 0) {
            const elementTexts = elements.filter((elem) => elem && elem.text).map((elem) => elem.text);

            if (elementTexts.length > 0) {
                textContent = elementTexts.join('\n');
                textSource = 'elements';
            }
        }

        if (textContent) {
            console.log(`📝 [Upstage] 텍스트 추출 성공: ${textSource} (${textContent.length.toLocaleString()} 문자)`);

            return {
                success: true,
                text: textContent,
                markdown: content.markdown || '',
                html: content.html || '',
                source: textSource,
                elements: elements,
                content: content,
                rawResponse: result,
                fileName: file.name,
                fileSize: file.size,
                parsedAt: new Date().toISOString(),
                elapsedTime: elapsed
            };
        } else {
            console.warn('⚠️ [Upstage] 추출된 텍스트가 없습니다.');
            return {
                success: false,
                error: '추출된 텍스트가 없습니다.',
                rawResponse: result
            };
        }
    } catch (error) {
        console.error('❌ [Upstage] 파싱 중 오류:', error);
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}

/**
 * 여러 파일을 동시에 파싱
 * @param {File[]} files - 파싱할 File 객체 배열
 * @param {Object} options - 옵션 설정
 * @returns {Promise<Object[]>} 파싱 결과 배열
 */
export async function parseMultipleDocuments(files, options = {}) {
    if (!Array.isArray(files) || files.length === 0) {
        console.error('❌ 유효한 파일 배열이 아닙니다.');
        return [];
    }

    console.log(`🚀 [Upstage] 일괄 파싱 시작: ${files.length}개 파일`);
    const startTime = Date.now();

    const results = await Promise.all(files.map((file) => parseDocumentWithUpstage(file, options)));

    const elapsed = (Date.now() - startTime) / 1000;
    const successCount = results.filter((r) => r.success).length;

    console.log(`✅ [Upstage] 일괄 파싱 완료: ${successCount}/${files.length} 성공 (${elapsed.toFixed(2)}초)`);

    return results;
}

/**
 * File 객체를 Upstage로 파싱 (순수하게 파싱 결과만 리턴)
 * @param {File} fileObject - File 객체
 * @param {Object} fileData - 캐시 확인용 파일 데이터 객체 (선택)
 * @param {Object} options - 옵션 설정
 * @param {boolean} options.forceReparse - true면 이미 파싱된 데이터가 있어도 다시 파싱
 * @returns {Promise<Object>} 파싱 결과
 */
export async function parseFileDocument(fileObject, fileData = null, options = {}) {
    try {
        if (!fileObject || !(fileObject instanceof File)) {
            console.error('❌ [Upstage] 유효한 File 객체가 아닙니다.');
            return {
                success: false,
                error: '유효한 File 객체가 아닙니다.'
            };
        }

        // 이미 파싱된 데이터가 있는지 확인 (캐시)
        if (fileData && !options.forceReparse && fileData.parsed_content) {
            console.log(`⏭️ [Upstage] 이미 파싱된 데이터 사용: ${fileObject.name}`);
            return {
                success: true,
                cached: true,
                text: fileData.parsed_content,
                markdown: fileData.parsed_markdown,
                html: fileData.parsed_html,
                source: fileData.parsed_source,
                parsedAt: fileData.parsed_at
            };
        }

        // 텍스트 파일인지 확인 (text/plain, text/markdown, text/html 등)
        const isTextFile = fileObject.type && (fileObject.type.startsWith('text/') || fileObject.type === 'application/json');

        if (isTextFile) {
            console.log(`📄 [Upstage] 텍스트 파일 직접 읽기: ${fileObject.name} (${fileObject.type})`);

            try {
                // 텍스트 파일은 직접 읽기
                const text = await fileObject.text();

                console.log(`✅ [Upstage] 텍스트 파일 읽기 성공: ${fileObject.name} (${text.length} 문자)`);

                return {
                    success: true,
                    text: text,
                    markdown: text, // 텍스트 그대로 사용
                    html: '',
                    source: 'direct-read',
                    fileName: fileObject.name,
                    fileSize: fileObject.size,
                    parsedAt: new Date().toISOString(),
                    elapsedTime: 0
                };
            } catch (readError) {
                console.error(`❌ [Upstage] 텍스트 파일 읽기 실패: ${fileObject.name}`, readError);
                return {
                    success: false,
                    error: `텍스트 파일 읽기 실패: ${readError.message}`
                };
            }
        }

        console.log(`[Upstage] 파싱 시작: ${fileObject.name}`);

        // Upstage AI로 문서 파싱
        const parseResult = await parseDocumentWithUpstage(fileObject, options);

        if (parseResult.success) {
            console.log(`✅ [Upstage] 파싱 성공: ${fileObject.name} (${parseResult.text.length} 문자)`);
        } else {
            console.warn(`⚠️ [Upstage] 파싱 실패: ${fileObject.name} - ${parseResult.error}`);
        }

        return parseResult;
    } catch (error) {
        console.error(`❌ [Upstage] 파싱 중 오류: ${fileObject.name}`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * URL에서 파일을 가져와 파싱
 * @param {string} url - 파일 URL
 * @param {string} fileName - 파일명
 * @param {Object} options - 옵션 설정
 * @returns {Promise<Object>} 파싱 결과
 */
export async function parseDocumentFromUrl(url, fileName, options = {}) {
    try {
        console.log(`🌐 [Upstage] URL에서 파일 가져오기: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const file = new File([blob], fileName || 'document', {
            type: blob.type || 'application/octet-stream'
        });

        return await parseDocumentWithUpstage(file, options);
    } catch (error) {
        console.error('❌ [Upstage] URL에서 파일 가져오기 실패:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 * @param {number} bytes - 바이트 크기
 * @returns {string} 포맷된 크기 문자열
 */
function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 지원되는 파일 형식 확인
 * @param {File} file - 확인할 File 객체
 * @returns {boolean} 지원 여부
 */
export function isSupportedFileType(file) {
    const supportedTypes = [
        // 문서
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/x-hwp',
        // 이미지
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        // 텍스트
        'text/plain',
        'text/html',
        'text/csv'
    ];

    const supportedExtensions = [
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
        '.hwp',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.bmp',
        '.tiff',
        '.txt',
        '.html',
        '.csv'
    ];

    // MIME 타입으로 확인
    if (supportedTypes.includes(file.type)) {
        return true;
    }

    // 확장자로 확인
    const fileName = file.name.toLowerCase();
    return supportedExtensions.some((ext) => fileName.endsWith(ext));
}

// 기본 export
export default {
    parseDocumentWithUpstage,
    parseMultipleDocuments,
    parseFileDocument,
    parseDocumentFromUrl,
    isSupportedFileType
};
