/** Resolve the selected diagram mode without ever writing the referenced definition. */
export async function resolveLinkedProcessXml(backend, definitionId, diagramMode = 'as-is') {
    if (diagramMode === 'to-be') {
        if (typeof backend.getToBeDefinitionXml === 'function') {
            const xml = await backend.getToBeDefinitionXml(definitionId);
            if (typeof xml === 'string' && xml.trim()) return xml;
        } else if (typeof backend.getDefinitionDetailLite === 'function') {
            const record = await backend.getDefinitionDetailLite(definitionId);
            const tobe = record?.definition?.tobe_bpmn || record?.tobe?.bpmn || record?.tobe?.xml;
            if (typeof tobe === 'string' && tobe.trim()) return tobe;
        }
    }
    const result = await backend.getRawDefinition(definitionId, { type: 'bpmn' });
    return typeof result === 'string' ? result : result?.bpmn || result?.snapshot || null;
}
