/**
 * 영속된 메시지(chats.messages jsonb)에서 BPMN 프로세스 산출물 패널을 복원하기 위한 순수 헬퍼.
 *
 * deepagent 가 emit 한 출력계약은 스트리밍 시 `msg.pdf2bpmnResult`(= _mapPostprocessToPdf2bpmnResult 결과)
 * 로 메시지에 박혀 DB 에 영속된다. 새로고침/재진입 후 우측 ArtifactPanel 의 `type:'process'` 패널을
 * 다시 띄우려면 이 영속 데이터에서 패널 디스크립터를 재구성해야 한다.
 *
 * 이 모듈은 서버/컴포넌트 없이 단위 테스트 가능하도록 분리한다.
 */

/** result(pdf2bpmnResult) 가 복원 가능한 BPMN 산출물인지(전체 출력계약 보유) 판별. */
export function isRestorableProcessResult(result) {
    return !!(result && typeof result === 'object' && result.__contract);
}

/** 산출물에서 표시용 프로세스 이름을 뽑는다. */
export function processNameFromResult(result) {
    const sp = result && Array.isArray(result.savedProcesses) ? result.savedProcesses[0] : null;
    if (sp && sp.process_name) return sp.process_name;
    return '생성된 프로세스';
}

/** 산출물에서 proc_def id(저장됨 재확인용)를 뽑는다. 없으면 ''. */
export function processIdFromResult(result) {
    const sp = result && Array.isArray(result.savedProcesses) ? result.savedProcesses[0] : null;
    return (sp && sp.process_id) || '';
}

/**
 * 영속된 메시지에서 pushArtifactPanel 에 넘길 패널 디스크립터를 만든다.
 * 복원 대상이 아니면 null.
 *
 * @param {object} msg 영속된 assistant 메시지(msg.pdf2bpmnResult / msg.uuid)
 * @returns {{type:'process', label:string, data:{result:object, messageId:(string|null)}}|null}
 */
export function buildProcessPanelFromMessage(msg) {
    const result = msg && msg.pdf2bpmnResult;
    if (!isRestorableProcessResult(result)) return null;
    return {
        type: 'process',
        label: processNameFromResult(result),
        data: { result, messageId: (msg && msg.uuid) || null }
    };
}

export default buildProcessPanelFromMessage;
