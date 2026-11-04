// 첫 화면과 머리글이 함께 쓰는 바깥 주소. 튜토리얼과 제품 소개는 uengine.org 에서 관리한다.
const UENGINE = 'https://www.uengine.org';
export const GITHUB = 'https://github.com/uengine-oss/process-gpt';

export function tutorialUrl(locale) {
    return locale === 'ko' ? `${UENGINE}/docs/process-gpt/` : `${UENGINE}/en/docs/process-gpt/`;
}

export function productUrl(locale) {
    return locale === 'ko' ? `${UENGINE}/contents/processgpt.html` : `${UENGINE}/en/contents/processgpt.html`;
}

export function guideLinks(locale) {
    return [
        { key: 'tutorial', href: tutorialUrl(locale) },
        { key: 'github', href: GITHUB },
        { key: 'product', href: productUrl(locale) }
    ];
}
