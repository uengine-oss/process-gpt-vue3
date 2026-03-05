/**
 * DMN XML 파싱 유틸리티
 */
export function parseDmnXml(xmlString) {
    if (!xmlString) return null;
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        // 파싱 에러 확인
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            console.warn('XML 파싱 에러:', parserError.textContent);
            return null;
        }

        const result = {
            definitions: null,
            inputData: [],
            decisions: [],
            diagrams: [],

            // legacy fields (backward compatible for existing UI if needed)
            decision: null,
            inputs: [],
            outputs: [],
            rules: [],
            hitPolicy: null
        };

        const root = xmlDoc.documentElement;
        if (!root) return null;

        const getAttrs = (el) => {
            const attrs = {};
            if (!el || !el.attributes) return attrs;
            for (const attr of Array.from(el.attributes)) {
                const name = attr.name || '';
                if (!name || name.startsWith('xmlns')) continue;
                attrs[name] = attr.value;
            }
            return attrs;
        };

        const getDirectChildrenByLocalName = (parent, localName) => {
            if (!parent || !parent.children) return [];
            return Array.from(parent.children).filter((c) => c && c.localName === localName);
        };

        const getFirstDirectChildByLocalName = (parent, localName) => {
            const list = getDirectChildrenByLocalName(parent, localName);
            return list.length > 0 ? list[0] : null;
        };

        const getDirectTextByLocalName = (parent, localName) => {
            const el = getFirstDirectChildByLocalName(parent, localName);
            const text = el?.textContent ?? '';
            return (text || '').trim();
        };

        const parseDecisionTable = (decisionTableEl) => {
            if (!decisionTableEl) return null;

            const table = {
                id: decisionTableEl.getAttribute('id') || '',
                hitPolicy: decisionTableEl.getAttribute('hitPolicy') || 'UNIQUE',
                inputs: [],
                outputs: [],
                rules: []
            };

            const inputEls = getDirectChildrenByLocalName(decisionTableEl, 'input');
            inputEls.forEach((inputEl, index) => {
                const inputExpression = getFirstDirectChildByLocalName(inputEl, 'inputExpression');
                const expressionText = inputExpression ? getDirectTextByLocalName(inputExpression, 'text') : '';
                table.inputs.push({
                    id: inputEl.getAttribute('id') || `input_${index}`,
                    label: inputEl.getAttribute('label') || '',
                    typeRef: inputExpression?.getAttribute('typeRef') || '',
                    expression: expressionText
                });
            });

            const outputEls = getDirectChildrenByLocalName(decisionTableEl, 'output');
            outputEls.forEach((outputEl, index) => {
                table.outputs.push({
                    id: outputEl.getAttribute('id') || `output_${index}`,
                    label: outputEl.getAttribute('label') || '',
                    name: outputEl.getAttribute('name') || '',
                    typeRef: outputEl.getAttribute('typeRef') || ''
                });
            });

            const ruleEls = getDirectChildrenByLocalName(decisionTableEl, 'rule');
            ruleEls.forEach((ruleEl, index) => {
                const ruleData = {
                    id: ruleEl.getAttribute('id') || `rule_${index}`,
                    inputs: [],
                    outputs: []
                };

                const inputEntries = getDirectChildrenByLocalName(ruleEl, 'inputEntry');
                inputEntries.forEach((entryEl, entryIndex) => {
                    const text = getDirectTextByLocalName(entryEl, 'text');
                    ruleData.inputs.push({
                        index: entryIndex,
                        value: text
                    });
                });

                const outputEntries = getDirectChildrenByLocalName(ruleEl, 'outputEntry');
                outputEntries.forEach((entryEl, entryIndex) => {
                    const text = getDirectTextByLocalName(entryEl, 'text');
                    ruleData.outputs.push({
                        index: entryIndex,
                        value: text
                    });
                });

                table.rules.push(ruleData);
            });

            return table;
        };

        // definitions 정보
        result.definitions = {
            id: root.getAttribute('id') || '',
            name: root.getAttribute('name') || '',
            namespace: root.getAttribute('namespace') || ''
        };

        // inputData (definitions 직계 자식 기준)
        const inputDataEls = getDirectChildrenByLocalName(root, 'inputData');
        inputDataEls.forEach((inputEl) => {
            const variableEl = getFirstDirectChildByLocalName(inputEl, 'variable');
            result.inputData.push({
                id: inputEl.getAttribute('id') || '',
                name: inputEl.getAttribute('name') || '',
                variable: variableEl
                    ? {
                          id: variableEl.getAttribute('id') || '',
                          name: variableEl.getAttribute('name') || '',
                          typeRef: variableEl.getAttribute('typeRef') || ''
                      }
                    : null,
                _rawAttrs: getAttrs(inputEl)
            });
        });

        // decisions (definitions 직계 자식 기준)
        const decisionEls = getDirectChildrenByLocalName(root, 'decision');
        decisionEls.forEach((decisionEl) => {
            const decision = {
                id: decisionEl.getAttribute('id') || '',
                name: decisionEl.getAttribute('name') || '',
                informationRequirements: [],
                decisionTable: null,
                literalExpression: null,
                _rawAttrs: getAttrs(decisionEl)
            };

            const irEls = getDirectChildrenByLocalName(decisionEl, 'informationRequirement');
            irEls.forEach((irEl) => {
                const requiredInput = getFirstDirectChildByLocalName(irEl, 'requiredInput');
                const requiredDecision = getFirstDirectChildByLocalName(irEl, 'requiredDecision');
                decision.informationRequirements.push({
                    id: irEl.getAttribute('id') || '',
                    requiredInputHref: requiredInput?.getAttribute('href') || '',
                    requiredDecisionHref: requiredDecision?.getAttribute('href') || ''
                });
            });

            const decisionTableEl = getFirstDirectChildByLocalName(decisionEl, 'decisionTable');
            if (decisionTableEl) {
                decision.decisionTable = parseDecisionTable(decisionTableEl);
            }

            const literalExpressionEl = getFirstDirectChildByLocalName(decisionEl, 'literalExpression');
            if (literalExpressionEl) {
                decision.literalExpression = {
                    id: literalExpressionEl.getAttribute('id') || '',
                    expressionLanguage: literalExpressionEl.getAttribute('expressionLanguage') || '',
                    text: getDirectTextByLocalName(literalExpressionEl, 'text')
                };
            }

            result.decisions.push(decision);
        });

        // DMNDI (레이아웃/다이어그램 요소)
        const dmndiEl = Array.from(root.children || []).find((c) => c && c.localName === 'DMNDI');
        if (dmndiEl) {
            const diagramEls = getDirectChildrenByLocalName(dmndiEl, 'DMNDiagram');
            diagramEls.forEach((diagramEl) => {
                const diagram = {
                    id: diagramEl.getAttribute('id') || '',
                    shapes: [],
                    edges: []
                };

                const shapeEls = getDirectChildrenByLocalName(diagramEl, 'DMNShape');
                shapeEls.forEach((shapeEl) => {
                    const boundsEl = Array.from(shapeEl.children || []).find((c) => c && c.localName === 'Bounds');
                    diagram.shapes.push({
                        id: shapeEl.getAttribute('id') || '',
                        dmnElementRef: shapeEl.getAttribute('dmnElementRef') || '',
                        bounds: boundsEl
                            ? {
                                  x: boundsEl.getAttribute('x') || '',
                                  y: boundsEl.getAttribute('y') || '',
                                  width: boundsEl.getAttribute('width') || '',
                                  height: boundsEl.getAttribute('height') || ''
                              }
                            : null
                    });
                });

                const edgeEls = getDirectChildrenByLocalName(diagramEl, 'DMNEdge');
                edgeEls.forEach((edgeEl) => {
                    const waypointEls = Array.from(edgeEl.children || []).filter((c) => c && c.localName === 'waypoint');
                    diagram.edges.push({
                        id: edgeEl.getAttribute('id') || '',
                        dmnElementRef: edgeEl.getAttribute('dmnElementRef') || '',
                        waypoints: waypointEls.map((wp) => ({
                            x: wp.getAttribute('x') || '',
                            y: wp.getAttribute('y') || ''
                        }))
                    });
                });

                result.diagrams.push(diagram);
            });
        }

        // legacy fields (첫 번째 decisionTable을 기준으로 기존 UI 호환)
        const firstDecisionWithTable = result.decisions.find((d) => d && d.decisionTable);
        if (firstDecisionWithTable) {
            result.decision = { id: firstDecisionWithTable.id, name: firstDecisionWithTable.name };
            result.hitPolicy = firstDecisionWithTable.decisionTable.hitPolicy;
            result.inputs = firstDecisionWithTable.decisionTable.inputs || [];
            result.outputs = firstDecisionWithTable.decisionTable.outputs || [];
            result.rules = firstDecisionWithTable.decisionTable.rules || [];
        } else if (result.decisions.length > 0) {
            result.decision = { id: result.decisions[0].id, name: result.decisions[0].name };
        }

        return result;
    } catch (error) {
        console.error('DMN XML 파싱 실패:', error);
        return null;
    }
}

/**
 * 두 규칙이 같은지 비교
 */
export function isRuleEqual(rule1, rule2) {
    if (!rule1 && !rule2) return true;
    if (!rule1 || !rule2) return false;
    
    if (rule1.inputs.length !== rule2.inputs.length) return false;
    if (rule1.outputs.length !== rule2.outputs.length) return false;
    
    for (let i = 0; i < rule1.inputs.length; i++) {
        if (rule1.inputs[i].value !== rule2.inputs[i].value) return false;
    }
    
    for (let i = 0; i < rule1.outputs.length; i++) {
        if (rule1.outputs[i].value !== rule2.outputs[i].value) return false;
    }
    
    return true;
}

/**
 * 규칙의 변경 타입 확인
 */
export function getRuleChangeType(prevRule, currRule, prevIndex, currIndex) {
    if (!prevRule && currRule) return 'added';
    if (prevRule && !currRule) return 'removed';
    if (prevRule && currRule && !isRuleEqual(prevRule, currRule)) return 'modified';
    return 'unchanged';
}

function stableStringify(obj) {
    if (obj === null || obj === undefined) return String(obj);
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map((v) => stableStringify(v)).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function indexById(list) {
    const map = {};
    (list || []).forEach((item, idx) => {
        const key = item?.id ? String(item.id) : `__idx_${idx}`;
        map[key] = item;
    });
    return map;
}

function diffKeyFields(prev, curr, fields) {
    const diffs = [];
    fields.forEach((f) => {
        const prevVal = prev ? prev[f] : undefined;
        const currVal = curr ? curr[f] : undefined;
        if (stableStringify(prevVal) !== stableStringify(currVal)) {
            diffs.push({ field: f, previous: prevVal, current: currVal });
        }
    });
    return diffs;
}

export function diffDecisionTable(prevTable, currTable) {
    const prev = prevTable || { inputs: [], outputs: [], rules: [], hitPolicy: null, id: '' };
    const curr = currTable || { inputs: [], outputs: [], rules: [], hitPolicy: null, id: '' };

    const prevRules = indexById(prev.rules || []);
    const currRules = indexById(curr.rules || []);
    const allRuleKeys = new Set([...Object.keys(prevRules), ...Object.keys(currRules)]);

    const ruleChanges = [];
    for (const key of Array.from(allRuleKeys)) {
        const prevRule = prevRules[key];
        const currRule = currRules[key];
        if (!prevRule && currRule) {
            ruleChanges.push({ key, type: 'added', previous: null, current: currRule });
        } else if (prevRule && !currRule) {
            ruleChanges.push({ key, type: 'removed', previous: prevRule, current: null });
        } else if (prevRule && currRule && !isRuleEqual(prevRule, currRule)) {
            ruleChanges.push({ key, type: 'modified', previous: prevRule, current: currRule });
        } else if (prevRule && currRule) {
            ruleChanges.push({ key, type: 'unchanged', previous: prevRule, current: currRule });
        }
    }

    const summary = {
        addedRules: ruleChanges.filter((c) => c.type === 'added').length,
        modifiedRules: ruleChanges.filter((c) => c.type === 'modified').length,
        removedRules: ruleChanges.filter((c) => c.type === 'removed').length
    };

    const metaDiffs = diffKeyFields(prev, curr, ['id', 'hitPolicy']);

    return {
        previous: prev,
        current: curr,
        summary,
        metaDiffs,
        ruleChanges
    };
}

export function diffDmn(previous, current) {
    const prev = previous || {};
    const curr = current || {};

    const inputPrev = indexById(prev.inputData || []);
    const inputCurr = indexById(curr.inputData || []);
    const inputKeys = new Set([...Object.keys(inputPrev), ...Object.keys(inputCurr)]);
    const inputChanges = [];
    for (const key of Array.from(inputKeys)) {
        const p = inputPrev[key];
        const c = inputCurr[key];
        if (!p && c) inputChanges.push({ key, type: 'added', previous: null, current: c, diffs: [] });
        else if (p && !c) inputChanges.push({ key, type: 'removed', previous: p, current: null, diffs: [] });
        else if (p && c) {
            const diffs = diffKeyFields(p, c, ['name', 'variable']);
            inputChanges.push({ key, type: diffs.length ? 'modified' : 'unchanged', previous: p, current: c, diffs });
        }
    }

    const decPrev = indexById(prev.decisions || []);
    const decCurr = indexById(curr.decisions || []);
    const decKeys = new Set([...Object.keys(decPrev), ...Object.keys(decCurr)]);
    const decisionChanges = [];
    for (const key of Array.from(decKeys)) {
        const p = decPrev[key];
        const c = decCurr[key];
        if (!p && c) {
            decisionChanges.push({ key, type: 'added', previous: null, current: c, diffs: [], tableDiff: c.decisionTable ? diffDecisionTable(null, c.decisionTable) : null });
        } else if (p && !c) {
            decisionChanges.push({ key, type: 'removed', previous: p, current: null, diffs: [], tableDiff: p.decisionTable ? diffDecisionTable(p.decisionTable, null) : null });
        } else if (p && c) {
            const diffs = diffKeyFields(p, c, ['name', 'informationRequirements', 'literalExpression']);
            const tableDiff = (p.decisionTable || c.decisionTable) ? diffDecisionTable(p.decisionTable, c.decisionTable) : null;
            const type = diffs.length || (tableDiff && (tableDiff.summary.addedRules || tableDiff.summary.modifiedRules || tableDiff.summary.removedRules || tableDiff.metaDiffs.length))
                ? 'modified'
                : 'unchanged';
            decisionChanges.push({ key, type, previous: p, current: c, diffs, tableDiff });
        }
    }

    const diagramPrev = indexById(prev.diagrams || []);
    const diagramCurr = indexById(curr.diagrams || []);
    const diagramKeys = new Set([...Object.keys(diagramPrev), ...Object.keys(diagramCurr)]);
    const diagramChanges = [];
    for (const key of Array.from(diagramKeys)) {
        const p = diagramPrev[key];
        const c = diagramCurr[key];
        if (!p && c) {
            diagramChanges.push({
                key,
                type: 'added',
                previous: null,
                current: c,
                diffs: [],
                shapeChanges: (c.shapes || []).map((s, idx) => ({ key: s.id || `__idx_${idx}`, type: 'added', previous: null, current: s, diffs: [] })),
                edgeChanges: (c.edges || []).map((e, idx) => ({ key: e.id || `__idx_${idx}`, type: 'added', previous: null, current: e, diffs: [] }))
            });
        } else if (p && !c) {
            diagramChanges.push({
                key,
                type: 'removed',
                previous: p,
                current: null,
                diffs: [],
                shapeChanges: (p.shapes || []).map((s, idx) => ({ key: s.id || `__idx_${idx}`, type: 'removed', previous: s, current: null, diffs: [] })),
                edgeChanges: (p.edges || []).map((e, idx) => ({ key: e.id || `__idx_${idx}`, type: 'removed', previous: e, current: null, diffs: [] }))
            });
        } else if (p && c) {
            const shapePrev = indexById(p.shapes || []);
            const shapeCurr = indexById(c.shapes || []);
            const shapeKeys = new Set([...Object.keys(shapePrev), ...Object.keys(shapeCurr)]);
            const shapeChanges = [];
            for (const sk of Array.from(shapeKeys)) {
                const sp = shapePrev[sk];
                const sc = shapeCurr[sk];
                if (!sp && sc) shapeChanges.push({ key: sk, type: 'added', previous: null, current: sc, diffs: [] });
                else if (sp && !sc) shapeChanges.push({ key: sk, type: 'removed', previous: sp, current: null, diffs: [] });
                else if (sp && sc) {
                    const diffs = diffKeyFields(sp, sc, ['dmnElementRef', 'bounds']);
                    shapeChanges.push({ key: sk, type: diffs.length ? 'modified' : 'unchanged', previous: sp, current: sc, diffs });
                }
            }

            const edgePrev = indexById(p.edges || []);
            const edgeCurr = indexById(c.edges || []);
            const edgeKeys = new Set([...Object.keys(edgePrev), ...Object.keys(edgeCurr)]);
            const edgeChanges = [];
            for (const ek of Array.from(edgeKeys)) {
                const ep = edgePrev[ek];
                const ec = edgeCurr[ek];
                if (!ep && ec) edgeChanges.push({ key: ek, type: 'added', previous: null, current: ec, diffs: [] });
                else if (ep && !ec) edgeChanges.push({ key: ek, type: 'removed', previous: ep, current: null, diffs: [] });
                else if (ep && ec) {
                    const diffs = diffKeyFields(ep, ec, ['dmnElementRef', 'waypoints']);
                    edgeChanges.push({ key: ek, type: diffs.length ? 'modified' : 'unchanged', previous: ep, current: ec, diffs });
                }
            }

            const type = shapeChanges.some((s) => s.type !== 'unchanged') || edgeChanges.some((e) => e.type !== 'unchanged') ? 'modified' : 'unchanged';
            diagramChanges.push({
                key,
                type,
                previous: p,
                current: c,
                diffs: [],
                shapeChanges: shapeChanges.filter((s) => s.type !== 'unchanged'),
                edgeChanges: edgeChanges.filter((e) => e.type !== 'unchanged')
            });
        }
    }

    const defDiffs = diffKeyFields(prev.definitions || null, curr.definitions || null, ['id', 'name', 'namespace']);

    const summary = {
        added: inputChanges.filter((c) => c.type === 'added').length + decisionChanges.filter((c) => c.type === 'added').length + diagramChanges.filter((c) => c.type === 'added').length,
        modified: inputChanges.filter((c) => c.type === 'modified').length + decisionChanges.filter((c) => c.type === 'modified').length + diagramChanges.filter((c) => c.type === 'modified').length + (defDiffs.length ? 1 : 0),
        removed: inputChanges.filter((c) => c.type === 'removed').length + decisionChanges.filter((c) => c.type === 'removed').length + diagramChanges.filter((c) => c.type === 'removed').length
    };

    return {
        definitionsDiffs: defDiffs,
        inputChanges: inputChanges.filter((c) => c.type !== 'unchanged'),
        decisionChanges: decisionChanges.filter((c) => c.type !== 'unchanged'),
        diagramChanges: diagramChanges.filter((c) => c.type !== 'unchanged'),
        summary
    };
}

