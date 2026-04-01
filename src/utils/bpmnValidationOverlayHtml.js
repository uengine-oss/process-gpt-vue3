/**
 * diagram-js overlay용 검증 메시지 박스 DOM.
 * 오버레이 루트가 width 0에 가까울 수 있어 min-width·flex-shrink는 CSS에서 고정한다.
 * @param {Array<{ level: string, message?: string, shortMessage?: string }>} errors
 * @param {(key: string) => string} t i18n
 */
export function createBpmnValidationOverlayElement(errors, t) {
    const isWarningOnly = errors.length > 0 && errors.every((e) => e.level === 'warning');
    const titleText = isWarningOnly ? t('validation.validationWarning') : t('validation.validationError');

    const container = document.createElement('div');
    container.className = isWarningOnly
        ? 'bpmn-validation-overlay-box bpmn-validation-overlay-box--warn'
        : 'bpmn-validation-overlay-box bpmn-validation-overlay-box--error';

    const accent = document.createElement('div');
    accent.className = 'bpmn-validation-overlay-box__accent';
    container.appendChild(accent);

    const body = document.createElement('div');
    body.className = 'bpmn-validation-overlay-box__body';

    const title = document.createElement('div');
    title.className = 'bpmn-validation-overlay-box__title';
    title.textContent = titleText;
    body.appendChild(title);

    errors.forEach((err) => {
        const msg = document.createElement('div');
        msg.className = 'bpmn-validation-overlay-box__msg';
        msg.textContent = err.shortMessage || err.message || '';
        body.appendChild(msg);
    });

    container.appendChild(body);
    return container;
}
