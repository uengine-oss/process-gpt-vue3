// 첫 화면과 머리글이 함께 쓰는 바깥 주소. 튜토리얼과 제품 소개는 uengine.org 에서 관리한다.
const UENGINE = 'https://www.uengine.org';
export const GITHUB = 'https://github.com/uengine-oss/process-gpt';

export function tutorialUrl(locale) {
    return locale === 'ko' ? `${UENGINE}/docs/process-gpt/` : `${UENGINE}/en/docs/process-gpt/`;
}

export function productUrl(locale) {
    return locale === 'ko' ? `${UENGINE}/contents/processgpt.html` : `${UENGINE}/en/contents/processgpt.html`;
}

// Process GPT Lite 설치: 릴리스에 고정된 스크립트를 받아 SHA-256 을 검사한 뒤 실행한다.
// 새 릴리스를 내면 버전과 그 릴리스 install/get.sh 의 확인값(shasum -a 256)을 함께 바꾼다.
export const LITE_VERSION = 'v0.2.0';
export const LITE_GET_SHA256 = 'd659b9b09cc7c05c914c06bd5ecf3ba72042ef3bb5cf1d5f13f89e23a43907a9';
const LITE_RAW = `https://raw.githubusercontent.com/uengine-oss/process-gpt-lite/${LITE_VERSION}/install/get.sh`;
export const LITE_SCRIPT_URL = `https://github.com/uengine-oss/process-gpt-lite/blob/${LITE_VERSION}/install/get.sh`;
export const LITE_INSTALL = [`curl -fsSLO ${LITE_RAW}`, `echo "${LITE_GET_SHA256}  get.sh" | shasum -a 256 -c -`, 'bash get.sh'].join('\n');

export function guideLinks(locale) {
    return [
        { key: 'tutorial', href: tutorialUrl(locale) },
        { key: 'github', href: GITHUB },
        { key: 'product', href: productUrl(locale) }
    ];
}
