/**
 * 엑셀 Activity 시트를 파싱하여 BPMN XML로 변환합니다. (uenginePhase excelToBpmn.js 기반)
 * - 5행: 헤더(No, Activity 명, Type, Lane, 선행, 후행, 메모 등), 6행부터: 데이터
 * - 게이트웨이: 유형(Type) 컬럼에 '게이트웨이' 또는 'Gateway' 입력 시 Exclusive Gateway로 생성
 * - 메모: '메모' 컬럼 값은 해당 액티비티에 연결되는 BPMN 텍스트 어노테이션으로 출력
 */

import ExcelJS from 'exceljs';

const DATA_START_ROW = 4;
const DATA_START_COL = 0;
const DATA_END_COL = 15;

const LANE_HEIGHT = 100;
const NODE_WIDTH = 100;
const NODE_HEIGHT = 80;
const EVENT_SIZE = 36;
const GATEWAY_SIZE = 50;
const HORIZONTAL_GAP = 36;
const LANE_LABEL_HEIGHT = 20;

function findColumnIndices(firstRow) {
  const row = Array.isArray(firstRow) ? firstRow : [];
  const toStr = (v) => (v != null ? String(v).trim().toLowerCase() : '');
  const noKeys = ['no', '번호', '순서', 'num', 'idx'];
  const nameKeys = ['activity 명', 'activity명', 'activity', '액티비티', '이름', 'name', '명', '활동'];
  const typeKeys = ['type', '타입', '유형', '종류'];
  const laneKeys = ['lane', '레인', '泳道', '역할', '담당조직'];
  const nextKeys = ['후행', 'next', '다음', '연결', 'to', 'target'];
  const prevKeys = ['선행', '이전', 'preceding', 'before'];
  const memoKeys = ['메모', 'memo', '비고', '설명', 'remark', 'note'];

  const find = (keys) => {
    for (let i = 0; i < row.length; i++) {
      const cell = toStr(row[i]);
      if (keys.some((k) => cell.includes(k))) return i;
    }
    return -1;
  };

  let prevCol = -1;
  let nextCol = -1;
  for (let i = 0; i < row.length; i++) {
    const cell = toStr(row[i]);
    const hasNext = nextKeys.some((k) => cell.includes(k));
    const hasPrev = prevKeys.some((k) => cell.includes(k));
    if (hasPrev && !hasNext) prevCol = i;
    if (hasNext && !hasPrev) nextCol = i;
  }
  if (prevCol < 0) prevCol = find(prevKeys);
  if (nextCol < 0) nextCol = find(nextKeys);

  return {
    no: find(noKeys),
    name: find(nameKeys),
    type: find(typeKeys),
    lane: find(laneKeys),
    next: nextCol,
    prev: prevCol,
    memo: find(memoKeys)
  };
}

function normalizeId(id) {
  if (id == null || id === '') return '';
  const n = parseFloat(String(id));
  return Number.isFinite(n) && Math.floor(n) === n ? String(Math.floor(n)) : String(id).trim();
}

function rowToRecord(row, indices) {
  const get = (idx) => {
    if (idx < 0 || idx >= row.length) return '';
    const v = row[idx];
    if (v == null) return '';
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    return String(v).trim();
  };
  const no = get(indices.no >= 0 ? indices.no : 0);
  const nameRaw = get(indices.name >= 0 ? indices.name : 1);
  let type = get(indices.type >= 0 ? indices.type : 2);
  const lane = get(indices.lane >= 0 ? indices.lane : 3);
  const nextCol = indices.next >= 0 ? indices.next : -1;
  const prevCol = indices.prev >= 0 ? indices.prev : -1;
  const sameCol = nextCol >= 0 && prevCol >= 0 && nextCol === prevCol;
  const nextVal = get(nextCol);
  const prevVal = sameCol ? '' : get(prevCol);
  const memo = indices.memo >= 0 ? get(indices.memo) : '';

  if (!nameRaw && !no) return null;

  type = type || 'Task';
  const typeLower = type.toLowerCase().trim();
  const typeNorm = type.trim();
  if (typeLower.includes('start') || typeNorm === '시작') type = 'Start';
  else if (typeLower.includes('end') || typeNorm === '종료') type = 'End';
  else if (typeLower.includes('gateway') || typeLower.includes('网关') || typeNorm === '网关' || typeNorm === '게이트웨이') type = 'Gateway';
  else if (typeLower.includes('user') || typeLower.includes('task') || typeNorm === '작업' || typeNorm === '태스크') type = 'UserTask';
  else type = 'UserTask';

  const splitIds = (s) => {
    if (s == null) return [];
    const raw = String(s).trim();
    if (raw === '' || raw === '-') return [];
    return raw
      .split(/[,，\s;；\n\t]+/)
      .map((x) => x.trim())
      .filter((x) => x && x !== '-');
  };
  const nextIds = splitIds(nextVal).map(normalizeId).filter(Boolean);
  const prevIds = splitIds(prevVal).map(normalizeId).filter(Boolean);

  const displayName = nameRaw && String(nameRaw).trim() ? String(nameRaw).trim() : `Activity_${no}`;
  return {
    no: no || String(Math.random()).slice(2, 8),
    name: displayName,
    type,
    lane: lane || '기본',
    nextIds,
    prevIds,
    memo: memo ? String(memo).trim() : ''
  };
}

const HEADER_LIKE_VALUES = new Set([
  'no', '번호', '순서', 'num', 'idx',
  'activity', 'activity 명', 'activity명', '액티비티', '이름', 'name', '명', '활동',
  'type', '타입', '유형', '종류',
  'lane', '레인', '역할', '담당조직',
  'next', '다음', '연결', 'to', 'target', '후행', '선행',
  '메모', 'memo', '비고', 'remark', 'note',
  '상세 업무 description', 'input', 'output', 'system', '핵심 data', '소요 시간', '참여자 수'
]);

function isHeaderLikeRow(row, indices) {
  const get = (idx) => {
    if (idx < 0 || idx >= row.length) return '';
    const v = row[idx];
    return (v != null ? String(v).trim() : '').toLowerCase();
  };
  const noVal = get(indices.no >= 0 ? indices.no : 0);
  const nameVal = get(indices.name >= 0 ? indices.name : 1);
  if (HEADER_LIKE_VALUES.has(noVal) || HEADER_LIKE_VALUES.has(nameVal)) return true;
  if (/^no\.?$/i.test(noVal) || /^activity\s*명$/i.test(nameVal)) return true;
  return false;
}

function normalizeExcelCellValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return normalizeExcelCellValue(value.result);
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item?.text || '').join('');
    }
    if (typeof value.text === 'string') return value.text;
    if (typeof value.hyperlink === 'string' && typeof value.tooltip === 'string') return value.tooltip;
  }
  return String(value);
}

function worksheetToRowArrays(worksheet) {
  const rows = [];
  const colCount = Math.max(worksheet?.actualColumnCount || 0, 1);
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const current = [];
    for (let col = 1; col <= colCount; col += 1) {
      current.push(normalizeExcelCellValue(row.getCell(col).value));
    }
    rows.push(current);
  });
  return rows;
}

/** 엑셀 워크북에서 첫 시트를 배열(행 배열)로 반환 */
export async function parseExcelFile(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) return [];
    return worksheetToRowArrays(firstSheet);
  } catch (err) {
    throw err instanceof Error ? err : new Error('파일을 읽을 수 없습니다.');
  }
}

// ----- ProcessDefinitionExcelImporter 형식 (uenginePhase 동일: No, Activity 명, 상세 업무 Description, 담당조직, 유형, 선행, 후행, 메모) -----
function findHeaderRowIndexImporter(rows) {
  const headerWithoutType = ['No', 'Activity 명', '상세 업무 Description', '담당조직', '선행', '후행', '메모'];
  const headerWithType = ['No', 'Activity 명', '상세 업무 Description', '담당조직', '유형', '선행', '후행', '메모'];
  return rows.findIndex((row) => {
    const normalized = (arr) => arr.every((value, idx) => String(row?.[idx] || '').trim() === value);
    return normalized(headerWithType) || normalized(headerWithoutType);
  });
}

function extractActivityRowsImporter(rows, startIndex, hasTypeCol = false) {
  const result = [];
  const prevIdx = hasTypeCol ? 5 : 4;
  const nextIdx = hasTypeCol ? 6 : 5;
  const memoIdx = hasTypeCol ? 7 : 6;
  for (let i = startIndex; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const no = String(row[0] || '').trim();
    const activityName = String(row[1] || '').trim();
    const description = String(row[2] || '').trim();
    const role = String(row[3] || '').trim();
    const typeRaw = hasTypeCol ? String(row[4] || '').trim() : '';
    const prev = String(row[prevIdx] || '').trim();
    const next = String(row[nextIdx] || '').trim();
    const memo = String(row[memoIdx] || '').trim();

    if (!no && !activityName && !description && !role && !prev && !next && !memo && !typeRaw) continue;
    if (!/^\d+$/.test(no) || !activityName) continue;

    const isGateway = typeRaw === '게이트웨이' || /gateway/i.test(typeRaw);
    result.push({ no, activityName, description, role, type: typeRaw, isGateway, prev, next, memo });
  }
  return result;
}

function parseNoListImporter(value) {
  if (!value) return [];
  return String(value).split(/[,，\s;；]+/).map((v) => v.trim()).filter((v) => /^\d+$/.test(v));
}

function buildConnectionsImporter(activityRows, elementByNo) {
  const set = new Set();
  const edges = [];
  const addEdge = (sourceNo, targetNo) => {
    const source = elementByNo.get(String(sourceNo));
    const target = elementByNo.get(String(targetNo));
    if (!source || !target) return;
    const key = `${source.id}->${target.id}`;
    if (set.has(key)) return;
    set.add(key);
    edges.push({ sourceId: source.id, targetId: target.id });
  };
  activityRows.forEach((row) => {
    parseNoListImporter(row.next).forEach((nextNo) => addEdge(row.no, nextNo));
    parseNoListImporter(row.prev).forEach((prevNo) => addEdge(prevNo, row.no));
  });
  return edges;
}

function toSnakeCaseImporter(value, fallbackPrefix = 'id') {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || `${fallbackPrefix}_${Date.now()}`;
}

function extractProcessNameFromFileNameImporter(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  return base || '엑셀 기반 프로세스';
}

/** ProcessDefinitionExcelImporter와 동일한 엑셀 형식 → processJson 반환 (uenginePhase 호환) */
function buildProcessDefinitionFromRows(rows, fileName = '') {
  const headerIndex = findHeaderRowIndexImporter(rows);
  if (headerIndex < 0) return null;

  const processName = String(rows[0]?.[2] || '').trim() || extractProcessNameFromFileNameImporter(fileName);
  const headerRow = rows[headerIndex] || [];
  const hasTypeCol = String(headerRow[4] || '').trim() === '유형';
  const activityRows = extractActivityRowsImporter(rows, headerIndex + 1, hasTypeCol);

  if (!activityRows.length) return null;

  const rolesMap = new Map();
  const activities = [];
  const gateways = [];
  const elementByNo = new Map();
  const memoAnnotations = [];

  activityRows.forEach((row) => {
    const roleName = row.role || '미지정';
    if (!rolesMap.has(roleName)) {
      rolesMap.set(roleName, {
        name: roleName,
        endpoint: toSnakeCaseImporter(roleName, 'role'),
        resolutionRule: `실제 ${roleName}을(를) 매핑`,
        origin: 'created',
      });
    }

    if (row.isGateway) {
      const gateway = {
        elementType: 'Gateway',
        id: `gateway_${row.no}`,
        name: row.activityName,
        role: roleName,
        source: '',
        type: 'ExclusiveGateway',
        description: row.description || row.memo || `${row.activityName} 분기`,
      };
      gateways.push(gateway);
      elementByNo.set(String(row.no), gateway);
    } else {
      const activity = {
        elementType: 'Activity',
        id: `activity_${row.no}`,
        name: row.activityName,
        type: 'UserActivity',
        source: '',
        description: row.description || row.memo || `${row.activityName} 단계`,
        instruction: row.memo || row.description || `${row.activityName} 업무를 수행한다.`,
        role: roleName,
        inputData: [],
        outputData: [`activity_${row.no}_result`],
        checkpoints: row.memo ? [row.memo] : [],
        duration: '5',
      };
      activities.push(activity);
      elementByNo.set(String(row.no), activity);
      if (row.memo) {
        memoAnnotations.push({ targetActivityId: activity.id, text: row.memo });
      }
    }
  });

  const connections = buildConnectionsImporter(activityRows, elementByNo);
  const incomingMap = new Map();
  const outgoingMap = new Map();
  connections.forEach(({ sourceId, targetId }) => {
    if (!incomingMap.has(targetId)) incomingMap.set(targetId, []);
    incomingMap.get(targetId).push(sourceId);
    if (!outgoingMap.has(sourceId)) outgoingMap.set(sourceId, []);
    outgoingMap.get(sourceId).push(targetId);
  });

  const allFlowElements = [...activities, ...gateways];
  const firstElement = allFlowElements[0];
  const startEvent = {
    elementType: 'Event',
    id: 'start_event',
    name: '프로세스 시작',
    role: firstElement?.role || '미지정',
    source: '',
    type: 'StartEvent',
    description: `${processName} 시작`,
    trigger: '',
  };
  const endEvent = {
    elementType: 'Event',
    id: 'end_event',
    name: '프로세스 종료',
    role: firstElement?.role || '미지정',
    source: '',
    type: 'EndEvent',
    description: `${processName} 종료`,
    trigger: '',
  };

  const sequenceElements = [];
  const sequenceSet = new Set();
  const addSequence = (source, target) => {
    const key = `${source}->${target}`;
    if (sequenceSet.has(key)) return;
    sequenceSet.add(key);
    sequenceElements.push({
      elementType: 'Sequence',
      id: `sequence_${source}_${target}`,
      name: `${source} -> ${target}`,
      source,
      target,
    });
  };

  allFlowElements.forEach((el) => {
    const incoming = incomingMap.get(el.id) || [];
    const outgoing = outgoingMap.get(el.id) || [];
    if (!incoming.length) {
      addSequence(startEvent.id, el.id);
      el.source = startEvent.id;
    } else {
      el.source = incoming[0];
    }
    if (!outgoing.length) addSequence(el.id, endEvent.id);
  });
  connections.forEach(({ sourceId, targetId }) => addSequence(sourceId, targetId));

  return {
    megaProcessId: '미분류',
    majorProcessId: '미분류',
    processDefinitionName: processName,
    processDefinitionId: toSnakeCaseImporter(processName, 'process_definition'),
    description: `${processName} 엑셀 템플릿 기반 자동 생성`,
    isHorizontal: true,
    data: [],
    roles: Array.from(rolesMap.values()),
    elements: [startEvent, ...activities, ...gateways, endEvent, ...sequenceElements],
    excelTextAnnotations: memoAnnotations,
  };
}

function sliceDataRow(row) {
  if (!Array.isArray(row)) return [];
  const end = Math.min(row.length, DATA_END_COL + 1);
  return row.slice(DATA_START_COL, end);
}

/** 엑셀 행 배열을 Activity 레코드 배열로 변환 */
export function excelRowsToActivities(rows) {
  if (!rows || rows.length <= DATA_START_ROW + 1) return [];
  const headerRow = sliceDataRow(rows[DATA_START_ROW]);
  const indices = findColumnIndices(headerRow);
  const activities = [];
  const noToRecord = new Map();

  for (let i = DATA_START_ROW + 1; i < rows.length; i++) {
    const row = sliceDataRow(rows[i]);
    if (isHeaderLikeRow(row, indices)) continue;
    let rec = rowToRecord(row, indices);
    if (!rec) continue;
    let noKey = normalizeId(rec.no);
    if (activities.length === 0 && (noKey === '-' || noKey === '' || !/^\d+$/.test(noKey))) {
      rec = { ...rec, no: '1' };
      noKey = '1';
    }
    if (noToRecord.has(noKey) && noToRecord.get(noKey) !== rec) {
      rec = { ...rec, no: String(activities.length + 1) };
      noKey = rec.no;
    }
    activities.push(rec);
    if (!noToRecord.has(noKey)) noToRecord.set(noKey, rec);
    if (!noToRecord.has(rec.name)) noToRecord.set(rec.name, rec);
  }

  for (const rec of activities) {
    rec.nextRefs = [];
    rec.prevRefs = [];
    for (const id of rec.nextIds) {
      const key = normalizeId(id);
      const target = noToRecord.get(key) || noToRecord.get(id);
      if (target) rec.nextRefs.push(target);
    }
    for (const id of rec.prevIds) {
      const key = normalizeId(id);
      const source = noToRecord.get(key) || noToRecord.get(id);
      if (source) rec.prevRefs.push(source);
    }
  }

  const hasAnyNext = activities.some((r) => r.nextRefs.length > 0);
  const hasAnyPrev = activities.some((r) => r.prevRefs.length > 0);
  if (!hasAnyNext && !hasAnyPrev && activities.length >= 2) {
    for (let i = 0; i < activities.length - 1; i++) {
      activities[i].nextRefs.push(activities[i + 1]);
    }
  }

  return activities;
}

function topologicalSort(activities) {
  const idToAct = new Map();
  activities.forEach((a, i) => idToAct.set(`n${i}`, a));
  const actToId = (a) => 'n' + activities.indexOf(a);
  const inDegree = new Map();
  const out = new Map();
  activities.forEach((a, i) => {
    inDegree.set(`n${i}`, 0);
    out.set(`n${i}`, []);
  });

  for (const a of activities) {
    const nid = actToId(a);
    for (const t of a.nextRefs) {
      const tid = actToId(t);
      if (idToAct.has(tid)) {
        out.get(nid).push(tid);
        inDegree.set(tid, inDegree.get(tid) + 1);
      }
    }
  }

  const queue = activities.map((a) => actToId(a)).filter((id) => inDegree.get(id) === 0);
  const sorted = [];
  while (queue.length) {
    const id = queue.shift();
    const act = idToAct.get(id);
    if (act) sorted.push(act);
    for (const tid of out.get(id) || []) {
      inDegree.set(tid, inDegree.get(tid) - 1);
      if (inDegree.get(tid) === 0) queue.push(tid);
    }
  }

  const remaining = activities.filter((a) => !sorted.includes(a));
  return [...sorted, ...remaining];
}

/** Activity 목록으로 BPMN XML 생성 */
export function activitiesToBpmnXml(activities, processName = '엑셀에서 생성') {
  if (!activities || activities.length === 0) {
    throw new Error('액티비티가 없습니다. 엑셀에 최소 1개 행(헤더 제외)이 필요합니다.');
  }

  const defId = `Definitions_${Math.random().toString(36).slice(2, 10)}`;
  const collId = `Collaboration_${Math.random().toString(36).slice(2, 10)}`;
  const procId = `Process_${Math.random().toString(36).slice(2, 10)}`;
  const partId = `Participant_${Math.random().toString(36).slice(2, 10)}`;
  const laneSetId = `LaneSet_${Math.random().toString(36).slice(2, 10)}`;

  const lanes = [...new Set(activities.map((a) => a.lane))];
  const laneIds = {};
  lanes.forEach((name, i) => {
    laneIds[name] = `Lane_${i}_${Math.random().toString(36).slice(2, 6)}`;
  });

  const nodeIds = new Map();
  const flowIds = new Map();

  activities.forEach((a) => {
    if (a.type === 'Start') nodeIds.set(a, `Event_Start_${Math.random().toString(36).slice(2, 8)}`);
    else if (a.type === 'End') nodeIds.set(a, `Event_End_${Math.random().toString(36).slice(2, 8)}`);
    else if (a.type === 'Gateway') nodeIds.set(a, `Gateway_${Math.random().toString(36).slice(2, 8)}`);
    else nodeIds.set(a, `Activity_${Math.random().toString(36).slice(2, 8)}`);
  });

  const flows = [];
  const flowKey = (a, b) => `${nodeIds.get(a)}-${nodeIds.get(b)}`;
  const addFlow = (source, target) => {
    const key = flowKey(source, target);
    if (flowIds.has(key)) return;
    flowIds.set(key, `Flow_${Math.random().toString(36).slice(2, 8)}`);
    flows.push({ source, target, id: flowIds.get(key) });
  };
  activities.forEach((src) => {
    src.nextRefs.forEach((tgt) => addFlow(src, tgt));
  });
  activities.forEach((tgt) => {
    tgt.prevRefs.forEach((src) => addFlow(src, tgt));
  });

  const hasIncoming = (a) => flows.some((f) => f.target === a);
  const hasOutgoing = (a) => flows.some((f) => f.source === a);
  const needStartRaw = activities.filter((a) => a.type !== 'Start' && !hasIncoming(a));
  const needEndRaw = activities.filter((a) => a.type !== 'End' && !hasOutgoing(a));
  const needStart = needStartRaw.length > needEndRaw.length && needEndRaw.length > 0 ? needEndRaw : needStartRaw;
  const needEnd = needStartRaw.length > needEndRaw.length && needEndRaw.length > 0 ? needStartRaw : needEndRaw;

  const allNodes = [...activities];
  let syntheticStart = null;
  let syntheticEnd = null;

  if (needStart.length > 0) {
    syntheticStart = {
      type: 'Start',
      name: '시작',
      lane: needStart[0].lane || lanes[0]
    };
    nodeIds.set(syntheticStart, `Event_ProcessStart_${Math.random().toString(36).slice(2, 8)}`);
    allNodes.unshift(syntheticStart);
    needStart.forEach((tgt) => addFlow(syntheticStart, tgt));
  }

  if (needEnd.length > 0) {
    syntheticEnd = {
      type: 'End',
      name: '종료',
      lane: needEnd[0].lane || lanes[0]
    };
    nodeIds.set(syntheticEnd, `Event_ProcessEnd_${Math.random().toString(36).slice(2, 8)}`);
    allNodes.push(syntheticEnd);
    needEnd.forEach((src) => addFlow(src, syntheticEnd));
  }

  const escapeXml = (s) => {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const uengineJson = (obj) => escapeXml(JSON.stringify(obj));

  let laneSetXml = '';
  lanes.forEach((laneName) => {
    const lid = laneIds[laneName];
    const refs = allNodes.filter((a) => (a.lane || '기본') === laneName).map((a) => nodeIds.get(a));
    laneSetXml += `
    <bpmn:lane id="${lid}" name="${escapeXml(laneName)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${refs.map((r) => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('\n      ')}
    </bpmn:lane>`;
  });

  let nodesXml = '';
  let flowsXml = '';
  for (const a of allNodes) {
    const nid = nodeIds.get(a);
    const role = a.lane || '기본';
    const incoming = flows.filter((f) => f.target === a).map((f) => f.id);
    const outgoing = flows.filter((f) => f.source === a).map((f) => f.id);

    if (a.type === 'Start') {
      nodesXml += `
    <bpmn:startEvent id="${nid}" name="${escapeXml(a.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${outgoing.map((id) => `<bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n      ')}
    </bpmn:startEvent>`;
    } else if (a.type === 'End') {
      nodesXml += `
    <bpmn:endEvent id="${nid}" name="${escapeXml(a.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${incoming.map((id) => `<bpmn:incoming>${id}</bpmn:incoming>`).join('\n      ')}
    </bpmn:endEvent>`;
    } else if (a.type === 'Gateway') {
      nodesXml += `
    <bpmn:exclusiveGateway id="${nid}" name="${escapeXml(a.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${incoming.map((id) => `<bpmn:incoming>${id}</bpmn:incoming>`).join('\n      ')}
      ${outgoing.map((id) => `<bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n      ')}
    </bpmn:exclusiveGateway>`;
    } else {
      nodesXml += `
    <bpmn:userTask id="${nid}" name="${escapeXml(a.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${incoming.map((id) => `<bpmn:incoming>${id}</bpmn:incoming>`).join('\n      ')}
      ${outgoing.map((id) => `<bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n      ')}
    </bpmn:userTask>`;
    }
  }

  for (const f of flows) {
    flowsXml += `
    <bpmn:sequenceFlow id="${f.id}" sourceRef="${nodeIds.get(f.source)}" targetRef="${nodeIds.get(f.target)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"role":null}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:sequenceFlow>`;
  }

  const planeId = 'BPMNPlane_1';
  const diagramId = 'BPMNDiagram_1';

  const nodeCount = allNodes.length;
  let yLane = 80;
  const laneBounds = {};
  lanes.forEach((name) => {
    laneBounds[name] = { x: 100, y: yLane, width: Math.max(800, nodeCount * (NODE_WIDTH + HORIZONTAL_GAP)), height: LANE_HEIGHT };
    yLane += LANE_HEIGHT + LANE_LABEL_HEIGHT;
  });

  const participantWidth = 200 + nodeCount * (NODE_WIDTH + HORIZONTAL_GAP);
  const participantHeight = yLane + 40;

  let xByNode = new Map();
  const sorted = topologicalSort(activities);
  let x = 180;
  if (syntheticStart) {
    xByNode.set(nodeIds.get(syntheticStart), x);
    x += NODE_WIDTH + HORIZONTAL_GAP;
  }
  for (const a of sorted) {
    xByNode.set(nodeIds.get(a), x);
    x += NODE_WIDTH + HORIZONTAL_GAP;
  }
  if (syntheticEnd) {
    xByNode.set(nodeIds.get(syntheticEnd), x);
  }

  let shapesXml = '';
  let edgesXml = '';

  shapesXml += `
      <bpmndi:BPMNShape id="${partId}_di" bpmnElement="${partId}" isHorizontal="true">
        <dc:Bounds x="70" y="60" width="${participantWidth}" height="${participantHeight}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;

  lanes.forEach((name) => {
    const b = laneBounds[name];
    shapesXml += `
      <bpmndi:BPMNShape id="${laneIds[name]}_di" bpmnElement="${laneIds[name]}" isHorizontal="true">
        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;
  });

  const laneYCenter = (name) => {
    const b = laneBounds[name];
    return b.y + b.height / 2;
  };

  for (const a of allNodes) {
    const nid = nodeIds.get(a);
    const lname = a.lane || '기본';
    const b = laneBounds[lname];
    const xPos = xByNode.get(nid) || 200;
    const yCenter = b.y + b.height / 2;

    if (a.type === 'Start' || a.type === 'End') {
      const sy = yCenter - EVENT_SIZE / 2;
      shapesXml += `
      <bpmndi:BPMNShape id="${nid}_di" bpmnElement="${nid}">
        <dc:Bounds x="${xPos}" y="${sy}" width="${EVENT_SIZE}" height="${EVENT_SIZE}" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${xPos - 20}" y="${sy + EVENT_SIZE + 4}" width="${EVENT_SIZE + 40}" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`;
    } else if (a.type === 'Gateway') {
      const gy = yCenter - GATEWAY_SIZE / 2;
      shapesXml += `
      <bpmndi:BPMNShape id="${nid}_di" bpmnElement="${nid}" isMarkerVisible="true">
        <dc:Bounds x="${xPos}" y="${gy}" width="${GATEWAY_SIZE}" height="${GATEWAY_SIZE}" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${xPos - 20}" y="${gy + GATEWAY_SIZE + 4}" width="${GATEWAY_SIZE + 40}" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`;
    } else {
      const ty = yCenter - NODE_HEIGHT / 2;
      shapesXml += `
      <bpmndi:BPMNShape id="${nid}_di" bpmnElement="${nid}">
        <dc:Bounds x="${xPos}" y="${ty}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;
    }
  }

  for (const f of flows) {
    const srcId = nodeIds.get(f.source);
    const tgtId = nodeIds.get(f.target);
    const srcX = xByNode.get(srcId) || 200;
    const tgtX = xByNode.get(tgtId) || 200;
    const srcLane = f.source.lane || '기본';
    const tgtLane = f.target.lane || '기본';
    const ySrc = laneYCenter(srcLane);
    const yTgt = laneYCenter(tgtLane);

    const isEvent = (a) => a.type === 'Start' || a.type === 'End';
    const sx = isEvent(f.source) ? srcX + EVENT_SIZE : srcX + NODE_WIDTH;
    const tx = isEvent(f.target) ? tgtX : tgtX;

    edgesXml += `
      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">
        <di:waypoint x="${sx}" y="${ySrc}" />
        <di:waypoint x="${tx}" y="${yTgt}" />
      </bpmndi:BPMNEdge>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="${defId}" name="${escapeXml(processName)}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="16.4.0">
  <bpmn:collaboration id="${collId}">
    <bpmn:participant id="${partId}" name="${escapeXml(lanes[0] || 'Process')}" processRef="${procId}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:participant>
  </bpmn:collaboration>
  <bpmn:process id="${procId}" isExecutable="true">
    <bpmn:extensionElements>
      <uengine:properties>
        <uengine:json>${uengineJson({ definitionName: processName, version: '0.1', shortDescription: { text: '' } })}</uengine:json>
      </uengine:properties>
    </bpmn:extensionElements>
    <bpmn:laneSet id="${laneSetId}">
      ${laneSetXml}
    </bpmn:laneSet>
    ${nodesXml}
    ${flowsXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="${diagramId}">
    <bpmndi:BPMNPlane id="${planeId}" bpmnElement="${collId}">
      ${shapesXml}
      ${edgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  const annotations = allNodes
    .filter((a) => a.memo && String(a.memo).trim())
    .map((a) => ({ targetActivityId: nodeIds.get(a), text: a.memo }));
  if (annotations.length > 0) {
    return attachTextAnnotationsToXml(xml, annotations);
  }
  return xml;
}

/**
 * BPMN XML에 메모(텍스트 어노테이션)를 붙여 반환.
 * annotations: [{ targetActivityId, text }]
 */
function attachTextAnnotationsToXml(xmlString, annotations) {
  if (!xmlString || !Array.isArray(annotations) || !annotations.length) {
    return xmlString;
  }
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
  const process = xmlDoc.getElementsByTagName('bpmn:process')[0];
  const plane = xmlDoc.getElementsByTagName('bpmndi:BPMNPlane')[0];
  if (!process || !plane) return xmlString;

  const readBounds = (shape) => {
    if (!shape) return null;
    const b = shape.getElementsByTagName('dc:Bounds')[0];
    if (!b) return null;
    return {
      x: Number(b.getAttribute('x') || 0),
      y: Number(b.getAttribute('y') || 0),
      width: Number(b.getAttribute('width') || 0),
      height: Number(b.getAttribute('height') || 0),
    };
  };
  const getShapeByElementId = (elementId) => {
    const shapes = Array.from(xmlDoc.getElementsByTagName('bpmndi:BPMNShape'));
    return shapes.find((shape) => shape.getAttribute('bpmnElement') === elementId) || null;
  };

  annotations.forEach((annotation, index) => {
    const targetId = annotation?.targetActivityId;
    const text = String(annotation?.text || '').trim();
    if (!targetId || !text) return;

    const textAnnotationId = `TextAnnotation_${targetId}_${index + 1}`;
    const associationId = `Association_${targetId}_${index + 1}`;

    const textAnnotation = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:textAnnotation');
    textAnnotation.setAttribute('id', textAnnotationId);
    const textElement = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:text');
    textElement.setAttribute('textFormat', 'text/plain');
    textElement.textContent = text;
    textAnnotation.appendChild(textElement);
    process.appendChild(textAnnotation);

    const association = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:association');
    association.setAttribute('id', associationId);
    association.setAttribute('sourceRef', targetId);
    association.setAttribute('targetRef', textAnnotationId);
    process.appendChild(association);

    const targetShape = getShapeByElementId(targetId);
    const targetBounds = readBounds(targetShape);
    const annotationX = targetBounds ? targetBounds.x + targetBounds.width + 70 : 600 + index * 40;
    const annotationY = targetBounds ? Math.max(40, targetBounds.y - 10) : 120 + index * 40;
    const annotationWidth = 180;
    const annotationHeight = 80;

    const annotationShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
    annotationShape.setAttribute('id', `BPMNShape_${textAnnotationId}`);
    annotationShape.setAttribute('bpmnElement', textAnnotationId);
    const annotationBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
    annotationBounds.setAttribute('x', String(annotationX));
    annotationBounds.setAttribute('y', String(annotationY));
    annotationBounds.setAttribute('width', String(annotationWidth));
    annotationBounds.setAttribute('height', String(annotationHeight));
    annotationShape.appendChild(annotationBounds);
    plane.appendChild(annotationShape);

    const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
    edge.setAttribute('id', `BPMNEdge_${associationId}`);
    edge.setAttribute('bpmnElement', associationId);
    const sourceX = targetBounds ? targetBounds.x + targetBounds.width : annotationX - 30;
    const sourceY = targetBounds ? targetBounds.y + targetBounds.height / 2 : annotationY + 20;
    const targetX = annotationX;
    const targetY = annotationY + annotationHeight / 2;
    const wp1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
    wp1.setAttribute('x', String(sourceX));
    wp1.setAttribute('y', String(sourceY));
    const wp2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
    wp2.setAttribute('x', String(targetX));
    wp2.setAttribute('y', String(targetY));
    edge.appendChild(wp1);
    edge.appendChild(wp2);
    plane.appendChild(edge);
  });

  return new XMLSerializer().serializeToString(xmlDoc);
}

/** ProcessDefinitionExcelImporter 형식 processJson → BPMN XML (uenginePhase와 동일) */
function processDefinitionToBpmnXml(processJson, processName = '') {
  if (!processJson || !Array.isArray(processJson.elements) || processJson.elements.length === 0) {
    throw new Error('프로세스 정의가 비어 있습니다.');
  }
  const name = processName || processJson.processDefinitionName || '엑셀 프로세스';
  const elements = processJson.elements;
  const flowNodes = elements.filter((el) => el.elementType === 'Event' || el.elementType === 'Activity' || el.elementType === 'Gateway');
  const sequences = elements.filter((el) => el.elementType === 'Sequence');
  const roles = processJson.roles || [];
  const laneNames = roles.length ? roles.map((r) => r.name) : ['미지정'];
  const laneIds = {};
  laneNames.forEach((laneName, i) => {
    laneIds[laneName] = `Lane_${i}_${Math.random().toString(36).slice(2, 6)}`;
  });

  const escapeXml = (s) => {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  const uengineJson = (obj) => escapeXml(JSON.stringify(obj));

  const incomingMap = new Map();
  const outgoingMap = new Map();
  sequences.forEach((seq) => {
    if (!incomingMap.has(seq.target)) incomingMap.set(seq.target, []);
    incomingMap.get(seq.target).push(seq.id);
    if (!outgoingMap.has(seq.source)) outgoingMap.set(seq.source, []);
    outgoingMap.get(seq.source).push(seq.id);
  });

  let laneSetXml = '';
  laneNames.forEach((laneName) => {
    const refs = flowNodes.filter((n) => (n.role || '미지정') === laneName).map((n) => n.id);
    const lid = laneIds[laneName];
    laneSetXml += `
    <bpmn:lane id="${lid}" name="${escapeXml(laneName)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${refs.map((r) => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('\n      ')}
    </bpmn:lane>`;
  });

  let nodesXml = '';
  flowNodes.forEach((el) => {
    const role = el.role || '미지정';
    const incoming = incomingMap.get(el.id) || [];
    const outgoing = outgoingMap.get(el.id) || [];
    if (el.type === 'StartEvent') {
      nodesXml += `
    <bpmn:startEvent id="${el.id}" name="${escapeXml(el.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${outgoing.map((id) => `<bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n      ')}
    </bpmn:startEvent>`;
    } else if (el.type === 'EndEvent') {
      nodesXml += `
    <bpmn:endEvent id="${el.id}" name="${escapeXml(el.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${incoming.map((id) => `<bpmn:incoming>${id}</bpmn:incoming>`).join('\n      ')}
    </bpmn:endEvent>`;
    } else if (el.elementType === 'Gateway' && (el.type === 'ExclusiveGateway' || !el.type)) {
      nodesXml += `
    <bpmn:exclusiveGateway id="${el.id}" name="${escapeXml(el.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${incoming.map((id) => `<bpmn:incoming>${id}</bpmn:incoming>`).join('\n      ')}
      ${outgoing.map((id) => `<bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n      ')}
    </bpmn:exclusiveGateway>`;
    } else {
      nodesXml += `
    <bpmn:userTask id="${el.id}" name="${escapeXml(el.name)}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>${uengineJson({ role })}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      ${incoming.map((id) => `<bpmn:incoming>${id}</bpmn:incoming>`).join('\n      ')}
      ${outgoing.map((id) => `<bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n      ')}
    </bpmn:userTask>`;
    }
  });

  let flowsXml = '';
  sequences.forEach((seq) => {
    flowsXml += `
    <bpmn:sequenceFlow id="${seq.id}" sourceRef="${seq.source}" targetRef="${seq.target}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"role":null}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:sequenceFlow>`;
  });

  const defId = `Definitions_${Math.random().toString(36).slice(2, 10)}`;
  const collId = `Collaboration_${Math.random().toString(36).slice(2, 10)}`;
  const procId = `Process_${Math.random().toString(36).slice(2, 10)}`;
  const partId = `Participant_${Math.random().toString(36).slice(2, 10)}`;
  const laneSetId = `LaneSet_${Math.random().toString(36).slice(2, 10)}`;
  const nodeCount = flowNodes.length;
  let yLane = 80;
  const laneBounds = {};
  laneNames.forEach((laneName) => {
    laneBounds[laneName] = { x: 100, y: yLane, width: Math.max(800, nodeCount * (NODE_WIDTH + HORIZONTAL_GAP)), height: LANE_HEIGHT };
    yLane += LANE_HEIGHT + LANE_LABEL_HEIGHT;
  });
  const participantWidth = 200 + nodeCount * (NODE_WIDTH + HORIZONTAL_GAP);
  const participantHeight = yLane + 40;
  const xStep = NODE_WIDTH + HORIZONTAL_GAP;
  let x = 180;
  const xByNode = new Map();
  flowNodes.forEach((n) => {
    xByNode.set(n.id, x);
    x += xStep;
  });
  const laneYCenter = (laneName) => {
    const b = laneBounds[laneName] || laneBounds[laneNames[0]];
    return b.y + b.height / 2;
  };

  let shapesXml = '';
  let edgesXml = '';
  shapesXml += `
      <bpmndi:BPMNShape id="${partId}_di" bpmnElement="${partId}" isHorizontal="true">
        <dc:Bounds x="70" y="60" width="${participantWidth}" height="${participantHeight}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;
  laneNames.forEach((laneName) => {
    const b = laneBounds[laneName];
    const lid = laneIds[laneName];
    shapesXml += `
      <bpmndi:BPMNShape id="${lid}_di" bpmnElement="${lid}" isHorizontal="true">
        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;
  });
  flowNodes.forEach((el) => {
    const lname = el.role || '미지정';
    const b = laneBounds[lname] || laneBounds[laneNames[0]];
    const xPos = xByNode.get(el.id) || 200;
    const yCenter = b.y + b.height / 2;
    if (el.type === 'StartEvent' || el.type === 'EndEvent') {
      const sy = yCenter - EVENT_SIZE / 2;
      shapesXml += `
      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}">
        <dc:Bounds x="${xPos}" y="${sy}" width="${EVENT_SIZE}" height="${EVENT_SIZE}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;
    } else if (el.elementType === 'Gateway') {
      const gy = yCenter - GATEWAY_SIZE / 2;
      shapesXml += `
      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}" isMarkerVisible="true">
        <dc:Bounds x="${xPos}" y="${gy}" width="${GATEWAY_SIZE}" height="${GATEWAY_SIZE}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;
    } else {
      const ty = yCenter - NODE_HEIGHT / 2;
      shapesXml += `
      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}">
        <dc:Bounds x="${xPos}" y="${ty}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`;
    }
  });
  sequences.forEach((seq) => {
    const srcNode = flowNodes.find((n) => n.id === seq.source);
    const tgtNode = flowNodes.find((n) => n.id === seq.target);
    const srcLane = srcNode?.role || '미지정';
    const tgtLane = tgtNode?.role || '미지정';
    const srcX = xByNode.get(seq.source) || 200;
    const tgtX = xByNode.get(seq.target) || 200;
    const ySrc = laneYCenter(srcLane);
    const yTgt = laneYCenter(tgtLane);
    const isEvent = (n) => n && (n.type === 'StartEvent' || n.type === 'EndEvent');
    const srcWidth = isEvent(srcNode) ? EVENT_SIZE : (srcNode?.elementType === 'Gateway' ? GATEWAY_SIZE : NODE_WIDTH);
    const sx = srcX + srcWidth;
    const tx = isEvent(tgtNode) ? tgtX : tgtX;
    edgesXml += `
      <bpmndi:BPMNEdge id="${seq.id}_di" bpmnElement="${seq.id}">
        <di:waypoint x="${sx}" y="${ySrc}" />
        <di:waypoint x="${tx}" y="${yTgt}" />
      </bpmndi:BPMNEdge>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="${defId}" name="${escapeXml(name)}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="16.4.0">
  <bpmn:collaboration id="${collId}">
    <bpmn:participant id="${partId}" name="${escapeXml(laneNames[0] || 'Process')}" processRef="${procId}">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:participant>
  </bpmn:collaboration>
  <bpmn:process id="${procId}" isExecutable="true">
    <bpmn:extensionElements>
      <uengine:properties>
        <uengine:json>${uengineJson({ definitionName: name, version: '0.1', shortDescription: { text: '' } })}</uengine:json>
      </uengine:properties>
    </bpmn:extensionElements>
    <bpmn:laneSet id="${laneSetId}">
      ${laneSetXml}
    </bpmn:laneSet>
    ${nodesXml}
    ${flowsXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collId}">
      ${shapesXml}
      ${edgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

/** 파일 객체를 받아 BPMN XML 문자열로 변환 (전체 파이프라인). uenginePhase와 동일 형식 우선 시도 */
export async function excelFileToBpmnXml(file, processName) {
  const rows = await parseExcelFile(file);
  const name = processName || (file.name || '').replace(/\.[^.]+$/, '').trim() || '엑셀 프로세스';

  const processJson = buildProcessDefinitionFromRows(rows, file?.name);
  if (processJson && processJson.elements && processJson.elements.length > 0) {
    let xml = processDefinitionToBpmnXml(processJson, name);
    if (processJson.excelTextAnnotations && processJson.excelTextAnnotations.length > 0) {
      xml = attachTextAnnotationsToXml(xml, processJson.excelTextAnnotations);
    }
    return xml;
  }

  const activities = excelRowsToActivities(rows);
  if (!activities || activities.length === 0) {
    throw new Error('엑셀에서 액티비티를 찾을 수 없습니다. 헤더: No, Activity 명, 상세 업무 Description, 담당조직, 유형(선택), 선행, 후행, 메모 또는 5행 헤더 형식을 확인해 주세요.');
  }
  return activitiesToBpmnXml(activities, name);
}
