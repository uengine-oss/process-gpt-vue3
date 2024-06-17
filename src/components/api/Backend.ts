export interface Backend {
    listDefinition(basePath: string): Promise<any>;
    listVersionDefinitions(version: string, basePath: string): Promise<any>;
    listVersions(): Promise<any>;
    versionUp(version: string, major: boolean, makeProduction: boolean): Promise<any>;
    makeProduction(version: string): Promise<any>;
    getProduction(): Promise<any>;
    getDefinitionVersions(defId: string, options: any) : Promise<any>;
    getVersion(version: string): Promise<any>;
    getDefinition(defPath: string): Promise<any>;
    renameOrMove(definition: any, requestPath: string): Promise<any>;
    createFolder(newResource: any, requestPath: string): Promise<any>;
    deleteDefinition(requestPath: string, options: any): Promise<any>;
    getRawDefinition(defId: string, options: any): Promise<any>;
    putRawDefinition(definition: any, requestPath: string, options: any): Promise<any>;
    start(command: any): Promise<any>;
    stop(instanceId: string): Promise<any>;
    suspend(instanceId: string): Promise<any>;
    resume(instanceId: string): Promise<any>;
    getInstance(instanceId: string): Promise<any>;
    backToHere(instanceId: string, tracingTag: string): Promise<any>;
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
    putWorkItemComplete(taskId: string, workItem: any): Promise<any>;
    postMessage(instanceId: string, message: any): Promise<any>;
    getWorkList(options?: any): Promise<any>;
    getProcessDefinitionMap(): Promise<any>;
    putProcessDefinitionMap(definitionMap: any): Promise<any>;
    getPendingList(): Promise<any>;
    getCompletedList(options?: any): Promise<any>;
    getInProgressList(): Promise<any>;
    putWorklist(taskId: string, workItem: any): Promise<any>;
    getEventList(instanceId: string): Promise<any>;
    getDryRunInstance(defPath: string): Promise<any>;
    startDryRun(command: object) : Promise<any>;
}

// export type { Backend }
