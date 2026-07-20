function cloneDefinition(definition) {
    try {
        return JSON.parse(JSON.stringify(definition || {}));
    } catch (_) {
        return { ...(definition || {}) };
    }
}

function readUengineProperties(element) {
    const props = Array.from(element.getElementsByTagName('*')).find(
        (child) => child.localName === 'properties' && child.namespaceURI === 'http://uengine'
    );
    if (!props) return {};

    const raw =
        props.getAttribute('json') || Array.from(props.children || []).find((child) => child.localName === 'json')?.textContent || '';
    if (!raw || !raw.trim()) return {};

    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Failed to parse CallActivity uengine properties:', e);
        return {};
    }
}

function getBpmnElements(doc, localName) {
    const elements = Array.from(doc.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', localName));
    if (elements.length > 0) return elements;
    return Array.from(doc.getElementsByTagName('*')).filter((element) => element.localName === localName);
}

function getLaneRoleByActivityId(doc) {
    const roleByActivityId = {};
    getBpmnElements(doc, 'lane').forEach((lane) => {
        const roleName = lane.getAttribute('name') || '';
        if (!roleName.trim()) return;

        getBpmnElements(lane, 'flowNodeRef').forEach((ref) => {
            const activityId = ref.textContent?.trim();
            if (activityId) roleByActivityId[activityId] = roleName.trim();
        });
    });
    return roleByActivityId;
}

export function syncBpmnCallActivitiesIntoDefinition(xml, sourceDefinition) {
    const definition = cloneDefinition(sourceDefinition);
    if (!Array.isArray(definition.activities)) {
        definition.activities = [];
    }

    if (!xml || typeof DOMParser === 'undefined') return definition;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror')[0]) return definition;

        const roleByActivityId = getLaneRoleByActivityId(doc);
        const callActivities = getBpmnElements(doc, 'callActivity');
        const callActivityIds = new Set(callActivities.map((callActivity) => callActivity.getAttribute('id')).filter(Boolean));

        definition.activities = definition.activities.filter((activity) => {
            const type = String(activity?.type || '').toLowerCase();
            return type !== 'callactivity' || callActivityIds.has(activity?.id);
        });

        callActivities.forEach((callActivity) => {
            const id = callActivity.getAttribute('id');
            if (!id) return;

            const properties = readUengineProperties(callActivity);
            const existingIndex = definition.activities.findIndex((activity) => activity?.id === id);
            const previous = existingIndex >= 0 ? definition.activities[existingIndex] : {};
            const next = {
                ...previous,
                id,
                name: callActivity.getAttribute('name') || previous.name || id,
                type: 'CallActivity',
                description: previous.description || '',
                properties: JSON.stringify(properties)
            };

            const roleName = (typeof properties?.role === 'string' ? properties.role : properties?.role?.name) || roleByActivityId[id];
            if (roleName) {
                next.role = roleName;
            }

            if (existingIndex >= 0) {
                definition.activities.splice(existingIndex, 1, next);
            } else {
                definition.activities.push(next);
            }
        });
    } catch (e) {
        console.warn('syncBpmnCallActivitiesIntoDefinition failed:', e);
    }

    return definition;
}
