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
    putRawDefinition(definition: any, requestPath: string, options: any): Promise<any>;
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
    advanceToActivity?(instanceId: string, tracingTag: string, body?: { payloadMapping?: Record<string, Record<string, any>>; maxAttempts?: number }): Promise<any>;
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
    getSystem(systemId: String): Promise<any>;
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
    getActivitiesStatus(instId: string, executionScope: String): Promise<any>;
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
    setupAgentKnowledge(params: {
        agent_id: string;
        goal?: string | null;
        persona?: string | null;
    }): Promise<any>;
}

// export type { Backend }
