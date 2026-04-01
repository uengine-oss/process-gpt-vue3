/** BPMN 모델러(컨텍스트 패드·팔레트) 모드별 정책 — window.$mode 분기 대신 Strategy 사용 */
export interface BpmnModelingPolicy {
    /** 컨텍스트 패드에서 플로우에 붙이는 기본 태스크 타입 */
    defaultAppendTaskBpmnType: 'bpmn:UserTask' | 'bpmn:ManualTask';
    /** null이면 ProcessGPT: window.$paletteSettings 등 클라이언트 설정 사용 */
    paletteVisibleTaskBpmnTypes: string[] | null;
    /** null이면 팔레트와 동일하게 window 기반; 다중 태스크 교체 메뉴용 */
    multiReplaceTaskBpmnTypes: string[] | null;
}

export interface Backend {
    listDefinition(basePath: string): Promise<any>;
    listVersionDefinitions(version: string, basePath: string): Promise<any>;
    listVersions(): Promise<any>;
    versionUp(version: string, major: boolean, makeProduction: boolean): Promise<any>;
    makeProduction(version: string): Promise<any>;
    getProduction(): Promise<any>;
    getDefinitionVersions(defId: string, options: any): Promise<any>;
    getVersion(version: string): Promise<any>;
    getDefinition(defPath: string): Promise<any>;
    renameOrMove(definition: any, requestPath: string): Promise<any>;
    createFolder(newResource: any, requestPath: string): Promise<any>;
    deleteDefinition(requestPath: string, options: any): Promise<any>;
    restoreDefinition(defId: string, options: any): Promise<boolean | undefined>;
    getRawDefinition(defId: string, options: any): Promise<any>;
    /**
     * Raw 정의 저장 (PUT /definition/raw).
     * options에 선택 `name?: string` — 표시용 이름(trim, 최대 255자). Oracle 프로필에서 TB_BPM_PROCDEF.name 갱신.
     * 생략·공백만이면 서버가 경로 기반 이름을 유지한다.
     * options `updatedByName?: string` — 수동 지정 시 본문에 그대로(정규화 후) 실음.
     * uEngine BPMN이면 미지정 시 `updatedByName`에 Keycloak 사용자 **id**(UUID) 자동 설정. UI는 id로 사용자 조회 후 표시.
     */
    putRawDefinition(definition: any, requestPath: string, options: any): Promise<any>;
    /** 프로세스 정의 복제 (정의체계도 등). desiredNewId 있으면 해당 ID로 저장, 없으면 _copy 자동 생성. */
    duplicateLocalProcess?(
        sourceId: string,
        newName: string,
        bpmn: string,
        definition?: any,
        desiredNewId?: string
    ): Promise<{ success: boolean; newId: string }>;
    start(command: any): Promise<any>;
    stop(instanceId: string): Promise<any>;
    suspend(instanceId: string): Promise<any>;
    resume(instanceId: string): Promise<any>;
    getInstance(instanceId: string): Promise<any>;
    getAllInstanceList(page: any, size: any): Promise<any>;
    getInstanceListByGroup(group: string): Promise<any>;
    getFilteredInstanceList(filters: object, page: number, size: number): Promise<any>;
    backToHere(instanceId: string, tracingTag: string): Promise<any>;
    /**
     * 태스크 반송(이전 단계 담당자에게 재처리 요청) 가능 여부/조건 조회
     * - 실제 가능 여부 판단 로직은 백엔드에서 처리
     */
    getTaskReturnAvailability(taskId: string): Promise<any>;
    /**
     * 태스크 반송 실행
     * - 백엔드에서 검증 후 실제 반송 처리(상태 변경/담당자 변경/로그 기록 등)
     */
    returnTask(taskId: string, payload: any): Promise<any>;
    /**
     * 태스크 SKIP(건너뛰기) 가능 여부/조건 조회
     * - 실제 가능 여부 판단 로직은 백엔드에서 처리
     */
    getTaskSkipAvailability(taskId: string): Promise<any>;
    /**
     * 태스크 SKIP(건너뛰기) 실행
     * - 백엔드에서 검증 후 실제 처리(상태 변경/로그 기록 등)
     */
    skipTask(taskId: string, payload: any): Promise<any>;
    advanceToActivity?(
        instanceId: string,
        tracingTag: string,
        body?: { payloadMapping?: Record<string, Record<string, any>>; maxAttempts?: number }
    ): Promise<any>;
    startFromActivity?(instanceId: string, tracingTag: string, body?: { variables?: Record<string, any> }): Promise<any>;
    getProcessVariables(instanceId: string): Promise<any>;
    getVariable(instId: string, varName: string): Promise<any>;
    getVariableWithTaskId(instId: string, taskId: string, varName: string): Promise<any>;
    setVariable(instanceId: string, varName: string, varValue: any): Promise<any>;
    setVariableWithTaskId(instanceId: string, taskId: string, varName: string, varValue: any): Promise<any>;
    getRoleMapping(instId: string, roleName: string): Promise<any>;
    setRoleMapping(instanceId: string, roleName: string, roleMapping: any): Promise<any>;
    signal(instanceId: string, signal: string): Promise<any>;
    serviceMessage(requestPath: string): Promise<any>;
    getWorkItem(taskId: string): Promise<any>;
    putWorkItem(taskId: string, workItem: any): Promise<any>;
    putWorkItemComplete(taskId: string, workItem: any, isSimulate: string): Promise<any>;
    postMessage(instanceId: string, message: any): Promise<any>;
    fireMessage(instanceId: string, event: any): Promise<any>;
    getWorkList(options?: any): Promise<any>;
    getProcessDefinitionMap(): Promise<any>;
    putProcessDefinitionMap(definitionMap: any): Promise<any>;
    /** uEngine 모드: 맵 JSON proc_def_owners에서 해당 프로세스 담당자 조회 */
    getOwnerByProcDef?(procDefId: string): Promise<string | null>;
    /** uEngine 모드: 맵 JSON proc_def_owners에 담당자 저장 */
    putOwner?(procDefId: string, owner: string | null): Promise<void>;
    getMetricsMap(): Promise<any>;
    putMetricsMap(metricsMap: any): Promise<any>;
    getPendingList(): Promise<any>;
    getCompletedList(options?: any): Promise<any>;
    getInProgressList(): Promise<any>;
    putWorklist(taskId: string, workItem: any): Promise<any>;
    getEventList(instanceId: string): Promise<any>;
    dryRun(isSimulate: string, command: object): Promise<any>;
    startAndComplete(command: object, isSimulate: string): Promise<any>;
    getSystemList(): Promise<any>;
    putSystem(system: any): Promise<any>;
    deleteSystem(system: any): Promise<any>;
    getSystem(systemId: string): Promise<any>;
    getCurrentWorkItemByCorrKey(corrKey: number): Promise<any>;
    deleteInstance(instanceId: string): Promise<any>;
    setNotifications(value: any): Promise<any>;
    search(keyword: string): Promise<any>;
    testList(path: string): Promise<any>;
    testRecordList(path: string): Promise<any>;
    findCurrentWorkItemByInstId(instId: string): Promise<any>;
    getUserList(options: any): Promise<any>;
    getGroupList(): Promise<any>;
    releaseVersion(releaseName: string): Promise<any>;
    uploadDefinition(file: File, path: string): Promise<any>;
    getCompletedTaskId(instId: string): Promise<any>;
    getActivitiesStatus(instId: string, executionScope: string): Promise<any>;
    deleteTest(path: string, tracingTag: string, index: number): Promise<any>;
    deleteRecordTest(path: string, index: number): Promise<any>;
    checkDBConnection(): Promise<any>;
    getWorkListAll(): Promise<any>;
    uploadImage(fileName: string, image: File): Promise<any>;
    getImageUrl(fileName: string): Promise<any>;
    uploadFile(fileName: string, file: File, storageType: string): Promise<any>;
    getFileUrl(path: string): Promise<any>;
    downloadFile(path: string): Promise<any>;
    getTenant(tenantId: string): Promise<any>;
    setTenant(tenantId: string): Promise<any>;
    updateUser(userInfo: any): Promise<any>;
    getAllWorkListByInstId(instId: number): Promise<any>;
    listMarketplaceDefinition(): Promise<any>;
    getRefForm(taskId: string): Promise<any>;
    saveTask(id: string, name: string, type: string, json: any): Promise<any>;
    getTaskList(): Promise<any>;
    watchNotifications(callback: (notification: any) => void): Promise<any>;
    getMCPTools(): Promise<any>;
    getMCPByTenant(): Promise<any>;
    setMCPByTenant(mcp: any): Promise<any>;
    getBSCard(): Promise<any>;
    putBSCard(card: any): Promise<any>;
    fetchAgentData(agentUrl: string): Promise<any>;
    getSchedule(id: string, version: string): Promise<any>;
    setSchedule(json: any): Promise<any>;
    deleteSchedule(defId: string, eventId: string): Promise<any>;
    getDataSourceList(): Promise<any>;
    addDataSource(dataSource: any): Promise<any>;
    updateDataSource(dataSource: any): Promise<any>;
    deleteDataSource(dataSource: any): Promise<any>;
    extractDatasourceSchema(): Promise<any>;
    callDataSource(dataSource: any, bodyData: any): Promise<any>;
    getEnvByTenant(): Promise<any>;
    getSecretByTenant(): Promise<any>;
    getBrowserUseSecretByTenant(): Promise<any>;
    deleteEnvByTenant(name: string): Promise<any>;
    deleteSecretByTenant(name: string): Promise<any>;
    deleteBrowserUseSecretByTenant(name: string): Promise<any>;
    createEnvByTenant(data: any): Promise<any>;
    createSecretByTenant(data: any): Promise<any>;
    createBrowserUseSecretByTenant(data: any): Promise<any>;
    updateEnvByTenant(data: any): Promise<any>;
    updateSecretByTenant(data: any): Promise<any>;
    updateBrowserUseSecretByTenant(data: any): Promise<any>;
    getMCPLists(): Promise<any>;
    claimWorkItem(taskId: string, data: any): Promise<any>;

    // User & Data API
    getUserInfo(): Promise<any>;
    getData(path: string, options: any): Promise<any>;
    delegateSuperAdmin?(targetUserId: string): Promise<any>;

    // Lock API (동시 수정 방지: 체크아웃/체크인)
    getLock(id: string): Promise<{ id: string; user_id: string } | null>;
    setLock(lockObj: { id: string; user_id: string }): Promise<any>;
    deleteLock(id: string): Promise<void>;

    // Task Catalog API
    getTaskSystems(): Promise<any>;
    saveTaskSystem(system: any): Promise<any>;
    deleteTaskSystem(id: string): Promise<any>;

    getTaskCatalogList(options?: any): Promise<any>;
    getTaskCatalog(id: string): Promise<any>;
    saveTaskCatalog(item: any): Promise<any>;
    deleteTaskCatalog(id: string): Promise<any>;

    getPropertySchemas(taskType?: string): Promise<any>;
    savePropertySchema(schema: any): Promise<any>;
    deletePropertySchema(id: string): Promise<any>;

    getPaletteSettings(): Promise<any>;
    savePaletteSettings(settings: any): Promise<any>;

    // Palette Task Types API
    getPaletteTaskTypes(): Promise<any>;
    updatePaletteTaskType(id: string, isEnabled: boolean): Promise<any>;

    // Task Execution Properties API (분석용)
    saveTaskExecutionProperties(params: {
        procDefId: string;
        procInstId: string;
        activityId: string;
        activityName?: string;
        todoId?: string;
        properties: any;
        executorEmail?: string;
    }): Promise<any>;
    updateTaskExecutionCompletion(params: {
        procInstId: string;
        activityId: string;
        status: 'COMPLETED' | 'CANCELLED' | 'FAILED';
    }): Promise<any>;
    getTaskExecutionProperties(options?: {
        procDefId?: string;
        systemName?: string;
        agentMode?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
    }): Promise<any[]>;

    // Agent Knowledge API
    setupAgentKnowledge(params: { agent_id: string; goal?: string | null; persona?: string | null }): Promise<any>;

    /**
     * BPMN XML 파싱 시 게이트웨이 export용 condition (ProcessGPT vs uEngine 규약 위임)
     */
    getGatewayExportCondition(gateway: any): string;
    /**
     * BPMN XML 파싱 시 시퀀스 플로우 export용 condition
     */
    getSequenceFlowExportCondition(flow: any): string;

    /**
     * 모델러 저장(saveModel): raw BPMN/XML을 모드별 규약으로 반영
     * - uEngine: putRawDefinition + 선택적 release
     * - ProcessGPT: 폼 draft·활동 tool 동기화 후 최종 putRawDefinition (processDefinition 필수)
     */
    saveProcessDefinitionFromModeler(params: { info: any; xml: string; processDefinition?: any }): Promise<void>;

    /**
     * /instancelist/:instId 경로 세그먼트 (ProcessGPT: 점 → _DOT_, uEngine: 원문 유지)
     */
    encodeInstanceIdForInstancelistRoute(instId: string): string;
    /**
     * 라우트 파라미터 instId → API/백엔드용 인스턴스 ID
     */
    decodeInstanceIdFromInstancelistRouteParam(routeParam: string): string;

    /** BPMN 편집기: 태스크 추가/팔레트/다중 교체 정책 */
    getBpmnModelingPolicy(): BpmnModelingPolicy;

    // 프로세스 정의 요소별 댓글 API (ElementCommentPanel)
    getElementComments(procDefId: string, elementId?: string): Promise<any[]>;
    getElementCommentCounts(procDefId: string): Promise<Record<string, { total: number; unresolved: number }>>;
    addElementComment(comment: {
        procDefId: string;
        elementId: string;
        elementType?: string;
        elementName?: string;
        content: string;
        parentCommentId?: string;
    }): Promise<any>;
    updateElementComment(commentId: string, content: string): Promise<any>;
    deleteElementComment(commentId: string): Promise<void>;
    resolveElementComment(commentId: string, resolved?: boolean, resolveActionText?: string): Promise<any>;
}

// export type { Backend }
