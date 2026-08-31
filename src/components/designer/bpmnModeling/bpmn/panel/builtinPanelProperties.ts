// 전용 패널 위젯에 연결되는 사용자 정의 속성 기본값 레지스트리
//
// 실사용 속성패널인 src/views/process-hierarchy/ProcessHierarchyProperties.vue 의
// 패널 필드·섹션을 task_property_schema 에 시드하여 관리자가 일반 사용자 정의
// 속성과 함께 노출/라벨/순서를
// 제어할 수 있게 한다. (bpmnModeling 하위의 GPT/uEngine 패널 스택은 실행 경로에
// 없으므로 이 레지스트리의 대상이 아니다.)
//
// taskType 스코프 규칙 — 패널 자체의 섹션 노출 조건을 그대로 따른다:
//   'process'                → Process 탭·PI Flag 탭·검토의견 탭 (프로세스 수준)
//   'task'                   → Task 탭에서 요소 공통(isTaskPropertyElement 계열) 섹션
//   'bpmn:<Type>'            → 특정 요소 전용 섹션 (SequenceFlow, Lane, Participant 등)
//
// 행이 없으면 기본 노출(fail-open). 새 테넌트의 초기 시드는
// taskCatalog.syncPanelPropertySchemas()가 (task_type, property_key) 기준으로 수행한다.

export interface BuiltinPanelProperty {
    /** 스코프 — 'process' | 'task' | 특정 BPMN 타입 (task_type/applies_to 로 사용) */
    taskType: string;
    /** 필드 키 — 패널의 isBuiltinPropVisible(scope, key) 호출 키와 일치해야 함 */
    key: string;
    /** 한국어 라벨 (스튜디오 기본 라벨) */
    labelKo: string;
    /** i18n 키 (있는 경우) */
    labelI18n?: string;
    /** task_property_schema.property_type 값 */
    propertyType: string;
    /** 렌더링 위젯 (text, select, switch, textarea, section, dialog 등) */
    widget: string;
    /** 저장되는 모델 경로/핸들러 (문서·추적용) */
    binding?: string;
    /** 패널 탭 (process, task, pi-flag, governance) */
    tab?: string;
    /** 필드가 속한 패널 컴포넌트 파일명 */
    panel: string;
    /** 패널 내 표시 순서 */
    displayOrder: number;
    required?: boolean;
    description?: string;
}

const PANEL = 'ProcessHierarchyProperties.vue';

export const BUILTIN_PANEL_PROPERTIES: BuiltinPanelProperty[] = [
    // ============================================================
    // Process 탭 (프로세스 수준)
    // ============================================================
    { taskType: 'process', key: 'owner', labelKo: '담당자', propertyType: 'user', widget: 'dialog', binding: 'OwnerSettingDialog', tab: 'process', panel: PANEL, displayOrder: 10, description: '담당자 설정·변경 이력 (관리자만 편집 가능)' },
    { taskType: 'process', key: 'parent_hierarchy', labelKo: '상위 체계', propertyType: 'select', widget: 'select-group', binding: 'parentForm.domainId/megaId/majorId', tab: 'process', panel: PANEL, displayOrder: 20, description: 'Domain/Mega/Major 상위 체계 지정 및 모듈 전환 (관리자만 편집 가능)' },
    { taskType: 'process', key: 'title', labelKo: '프로세스명', propertyType: 'string', widget: 'text', binding: 'processForm.title', tab: 'process', panel: PANEL, displayOrder: 30 },
    { taskType: 'process', key: 'description', labelKo: '설명', propertyType: 'textarea', widget: 'textarea', binding: 'processForm.description', tab: 'process', panel: PANEL, displayOrder: 40 },
    { taskType: 'process', key: 'manual_links', labelKo: '관련자료 링크', propertyType: 'url', widget: 'ManualLinkField', binding: 'processForm.manualLinks', tab: 'process', panel: PANEL, displayOrder: 50, description: 'Task별 관련자료 집계 표시 포함' },
    { taskType: 'process', key: 'api_integrations_summary', labelKo: 'API 연동 집계', propertyType: 'boolean', widget: 'section', tab: 'process', panel: PANEL, displayOrder: 60, description: 'Task별 API 연동 현황 (읽기 전용 섹션)' },
    { taskType: 'process', key: 'system_list', labelKo: '시스템 리스트', propertyType: 'boolean', widget: 'section', tab: 'process', panel: PANEL, displayOrder: 70, description: '연관 시스템 집계 (읽기 전용 섹션)' },
    { taskType: 'process', key: 'related_project_list', labelKo: '연관과제 리스트', propertyType: 'boolean', widget: 'section', tab: 'process', panel: PANEL, displayOrder: 80, description: '연관 과제 집계 (읽기 전용 섹션)' },
    { taskType: 'process', key: 'total_duration', labelKo: '프로세스 전체 소요시간', propertyType: 'boolean', widget: 'section', tab: 'process', panel: PANEL, displayOrder: 90, description: '읽기 전용 집계 섹션' },
    { taskType: 'process', key: 'total_cost', labelKo: '프로세스 전체 비용', propertyType: 'boolean', widget: 'section', tab: 'process', panel: PANEL, displayOrder: 100, description: '읽기 전용 집계 섹션' },
    { taskType: 'process', key: 'task_count', labelKo: 'Task 개수', propertyType: 'boolean', widget: 'section', tab: 'process', panel: PANEL, displayOrder: 110, description: '읽기 전용 집계 섹션' },

    // ============================================================
    // PI Flag 탭 (프로세스 수준, 소유자에게만 표시)
    // ============================================================
    { taskType: 'process', key: 'pi_flag_tab', labelKo: 'PI Flag 탭', propertyType: 'boolean', widget: 'section', tab: 'pi-flag', panel: PANEL, displayOrder: 120, description: '프로세스 수준 PI Flag 보드 탭 전체' },
    { taskType: 'process', key: 'pi_flag_agent_chat', labelKo: 'PI Flag Agent 분석', propertyType: 'boolean', widget: 'section', tab: 'pi-flag', panel: PANEL, displayOrder: 130, description: 'Agent 분석 서브탭과 PI Flag 기반 AI 질문 채팅' },

    // ============================================================
    // 검토의견 탭 (거버넌스)
    // ============================================================
    { taskType: 'process', key: 'governance_tab', labelKo: '검토의견 탭', propertyType: 'boolean', widget: 'section', tab: 'governance', panel: PANEL, displayOrder: 140, description: '결재·피드백·타임라인을 포함한 검토의견 탭 전체' },
    { taskType: 'process', key: 'review_guide', labelKo: '검토 가이드', propertyType: 'boolean', widget: 'section', tab: 'governance', panel: PANEL, displayOrder: 150, description: '기본지식/체크포인트 가이드 버튼과 플로팅 창' },
    { taskType: 'process', key: 'release_strategy', labelKo: '릴리즈 전략', propertyType: 'boolean', widget: 'section', tab: 'governance', panel: PANEL, displayOrder: 160, description: '차기 Major 초안 요청 패널' },

    // ============================================================
    // Task 탭 — 요소 공통 (isTaskPropertyElement 계열)
    // ============================================================
    { taskType: 'task', key: 'element_id', labelKo: '요소 ID', propertyType: 'string', widget: 'readonly', binding: 'elementDisplayId', tab: 'task', panel: PANEL, displayOrder: 10, description: '읽기 전용 표시 + 복사 버튼' },
    { taskType: 'task', key: 'name', labelKo: '이름', propertyType: 'string', widget: 'text', binding: 'taskForm.name', tab: 'task', panel: PANEL, displayOrder: 20 },
    { taskType: 'task', key: 'description', labelKo: '설명', propertyType: 'textarea', widget: 'textarea', binding: 'taskForm.description', tab: 'task', panel: PANEL, displayOrder: 30, description: '커스텀 스키마 필드가 없을 때 표시되는 기본 설명 입력' },
    { taskType: 'task', key: 'form_link', labelKo: '폼 연결', propertyType: 'select', widget: 'autocomplete', binding: 'taskFormLinkId', tab: 'task', panel: PANEL, displayOrder: 40, description: 'UserTask/Task/ManualTask에만 표시. 폼 디자이너 열기 포함' },
    { taskType: 'task', key: 'raci', labelKo: 'RACI', propertyType: 'multiselect', widget: 'RaciField', binding: 'taskForm.raci', tab: 'task', panel: PANEL, displayOrder: 50, description: 'Task 계열 요소에 표시' },
    { taskType: 'task', key: 'task_io', labelKo: '세부 업무 수행 절차', labelI18n: 'taskIo.tab', propertyType: 'multiselect', widget: 'TaskIoField', binding: 'taskForm.procedure', tab: 'task', panel: PANEL, displayOrder: 60, description: 'Task 계열 요소의 단계별 업무 수행 절차' },
    { taskType: 'task', key: 'manual_links', labelKo: '관련자료 링크', propertyType: 'url', widget: 'ManualLinkField', binding: 'taskForm.manualLinks', tab: 'task', panel: PANEL, displayOrder: 70 },
    { taskType: 'task', key: 'api_integrations', labelKo: 'API 연동', propertyType: 'multiselect', widget: 'list-editor', binding: 'taskForm.apiIntegrations', tab: 'task', panel: PANEL, displayOrder: 80, description: 'API 이름/메서드/URL/파라미터 편집 목록' },
    { taskType: 'task', key: 'data_io', labelKo: '입출력 데이터', propertyType: 'boolean', widget: 'section', tab: 'task', panel: PANEL, displayOrder: 90, description: '데이터 객체 입출력 표시 (읽기 전용 섹션)' },
    { taskType: 'task', key: 'fte_calculator', labelKo: 'FTE 계산기', propertyType: 'number', widget: 'section', binding: 'taskForm.fte', tab: 'task', panel: PANEL, displayOrder: 100, description: '내부/역할그룹 레인 태스크의 FTE 산정' },
    { taskType: 'task', key: 'opex', labelKo: 'OPEX (외부 비용)', propertyType: 'number', widget: 'section', binding: 'taskForm.opexUnit/opexCost/opexNote', tab: 'task', panel: PANEL, displayOrder: 110, description: '외부(도급) 레인 태스크의 비용 산정' },
    { taskType: 'task', key: 'system_mapping', labelKo: '시스템 매핑', propertyType: 'select', widget: 'autocomplete', binding: 'taskSystemSingle', tab: 'task', panel: PANEL, displayOrder: 120 },
    { taskType: 'task', key: 'related_project_mapping', labelKo: '연관 과제 매핑', propertyType: 'multiselect', widget: 'autocomplete', binding: 'taskForm.relatedProjects', tab: 'task', panel: PANEL, displayOrder: 130, description: '단일/동시(멀티) 매핑 모드 포함' },
    { taskType: 'task', key: 'pi_flag', labelKo: 'PI Flag', propertyType: 'boolean', widget: 'section', tab: 'task', panel: PANEL, displayOrder: 140, description: '요소별 PI Flag 코멘트 작성·반영 (소유자에게만 표시)' },

    // ============================================================
    // 특정 요소 전용 섹션
    // ============================================================
    // 시퀀스 플로우 (선 정보)
    { taskType: 'bpmn:SequenceFlow', key: 'name', labelKo: '이름', propertyType: 'string', widget: 'text', binding: 'taskForm.name', tab: 'task', panel: PANEL, displayOrder: 10 },
    { taskType: 'bpmn:SequenceFlow', key: 'flow_type', labelKo: '선 종류', propertyType: 'select', widget: 'select', binding: 'taskForm.flowType', tab: 'task', panel: PANEL, displayOrder: 20 },
    { taskType: 'bpmn:SequenceFlow', key: 'condition_expression', labelKo: '조건식', propertyType: 'textarea', widget: 'textarea', binding: 'taskForm.conditionExpression', tab: 'task', panel: PANEL, displayOrder: 30, description: '선 종류가 조건일 때 표시' },
    { taskType: 'bpmn:SequenceFlow', key: 'condition_llm_mode', labelKo: 'LLM 맥락 판단으로 평가', propertyType: 'boolean', widget: 'switch', binding: 'taskForm.conditionLlmMode', tab: 'task', panel: PANEL, displayOrder: 40, description: '선 종류가 조건일 때 표시' },

    // 참여자 (Pool)
    { taskType: 'bpmn:Participant', key: 'exec_pool', labelKo: '실행형 Pool 지정', propertyType: 'boolean', widget: 'switch', binding: 'toggleExecPoolForElement', tab: 'task', panel: PANEL, displayOrder: 10, description: '실행 사용자에게만 표시' },
    { taskType: 'bpmn:Participant', key: 'ppi', labelKo: 'PPI (프로세스 성과지표)', propertyType: 'multiselect', widget: 'PpiField', binding: 'taskForm.ppi', tab: 'task', panel: PANEL, displayOrder: 20 },

    // 레인
    { taskType: 'bpmn:Lane', key: 'name', labelKo: 'Lane 이름', propertyType: 'string', widget: 'text', binding: 'taskForm.name', tab: 'task', panel: PANEL, displayOrder: 10 },
    { taskType: 'bpmn:Lane', key: 'description', labelKo: '설명', propertyType: 'textarea', widget: 'textarea', binding: 'laneDescription', tab: 'task', panel: PANEL, displayOrder: 20, description: 'AI 설명 생성 버튼 포함' },
    { taskType: 'bpmn:Lane', key: 'lane_assignment', labelKo: 'Lane 담당 지정', propertyType: 'select', widget: 'section', binding: 'laneResourceType/laneAssignee/laneOrganization/laneSupplier/laneRoleGroupSelectedList', tab: 'task', panel: PANEL, displayOrder: 30, description: '원가 유형·담당자·조직·공급업체·역할 그룹 지정' },

    // 콜 액티비티 / 시작·종료 이벤트 (프로세스 연결)
    { taskType: 'bpmn:CallActivity', key: 'definition_link', labelKo: '프로세스 정의 선택', propertyType: 'select', widget: 'autocomplete', binding: 'callActivityDefinitionId', tab: 'task', panel: PANEL, displayOrder: 10, description: '시작/종료 이벤트의 프로세스 연결에도 동일 적용' },

    // 비즈니스 룰 태스크
    { taskType: 'bpmn:BusinessRuleTask', key: 'dmn_rule', labelKo: 'DMN 룰 설정', propertyType: 'select', widget: 'autocomplete', binding: 'businessRuleId', tab: 'task', panel: PANEL, displayOrder: 10 },

    // 메일 발송 태스크
    { taskType: 'bpmn:SendTask', key: 'mail_recipients', labelKo: '수신자', propertyType: 'multiselect', widget: 'combobox', binding: 'sendTaskRecipients', tab: 'task', panel: PANEL, displayOrder: 10 },
    { taskType: 'bpmn:SendTask', key: 'mail_title', labelKo: '메일 제목', propertyType: 'string', widget: 'text', binding: 'sendTaskMailTitle', tab: 'task', panel: PANEL, displayOrder: 20 },
    { taskType: 'bpmn:SendTask', key: 'mail_contents', labelKo: '메일 내용', propertyType: 'textarea', widget: 'textarea', binding: 'sendTaskMailContents', tab: 'task', panel: PANEL, displayOrder: 30 },

    // 데이터 객체/저장소 참조
    { taskType: 'bpmn:DataObjectReference', key: 'attachment', labelKo: '첨부 자료', propertyType: 'url', widget: 'section', binding: 'taskForm.dataAttachmentUrl, taskForm.dataAttachmentFile', tab: 'task', panel: PANEL, displayOrder: 10, description: 'URL 및 파일 첨부. DataStoreReference에도 적용' }
];
