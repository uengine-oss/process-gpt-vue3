import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'samples', 'tym');

const samples = [
    {
        file: 'P3.2.1_supplier_quality_claim.bpmn',
        id: 'P321',
        name: 'P3.2.1 협력사 품질 클레임 처리',
        description: '입고·생산 중 발견된 협력사 부품 부적합을 격리하고 원인분석, 개선 및 유효성 검증까지 관리한다.',
        tasks: ['부적합 접수', '대상 LOT 격리', '협력사 원인분석 요청', '개선대책 검토', '대책 실행', '재발 여부 검증', '클레임 종결']
    },
    {
        file: 'P4.1.2_incoming_inspection.bpmn',
        id: 'P412',
        name: 'P4.1.2 수입검사 및 부적합 처리',
        description: '구매 부품의 검사계획 수립부터 합격 입고 또는 부적합품 처리까지 표준화한다.',
        tasks: ['입고 등록', '검사기준 확인', '샘플링 검사', '검사결과 판정', '부적합품 식별·격리', '특채·반품 결정', 'ERP 결과 등록']
    },
    {
        file: 'P4.3.4_4m_change_management.bpmn',
        id: 'P434',
        name: 'P4.3.4 4M 변경관리',
        description: 'Man, Machine, Material, Method 변경의 위험을 사전 검토하고 승인·검증 후 양산에 반영한다.',
        tasks: ['변경 신청', '변경 영향성 평가', '품질 위험 검토', '변경 승인', '시험생산', '초도품 검증', '표준서 개정·양산 반영']
    },
    {
        file: 'P6.1.1_preventive_maintenance.bpmn',
        id: 'P611',
        name: 'P6.1.1 생산설비 예방보전',
        description: '생산설비의 정기점검과 이상조치를 통해 돌발 고장을 예방하고 설비가동률을 확보한다.',
        tasks: ['월간 보전계획 수립', '점검 대상·부품 확인', '설비 정지·안전조치', '예방점검 실시', '이상부위 정비', '시운전·품질 확인', '보전이력 등록']
    },
    {
        file: 'P1.1.1_demand_forecast.bpmn', id: 'P111', name: 'P1.1.1 수요예측 및 판매계획', description: '시장·판매 데이터를 기반으로 월별 수요와 공급계획을 확정한다.',
        tasks: ['판매실적 집계', '시장수요 분석', '차종별 수요예측', '생산능력 검토', '판매계획 합의', '경영진 승인', '기준계획 배포']
    },
    {
        file: 'P1.2.1_customer_order.bpmn', id: 'P121', name: 'P1.2.1 고객 주문 및 납기관리', description: '고객 주문 접수부터 납기 확정과 변경 통보까지 관리한다.',
        tasks: ['주문 접수', '사양·가격 확인', '재고 확인', '생산가능일 검토', '납기 확정', '주문 변경관리', '고객 통보']
    },
    {
        file: 'P2.1.1_apqp.bpmn', id: 'P211', name: 'P2.1.1 신제품 APQP', description: '신제품 기획부터 양산승인까지 품질선행 활동을 단계별로 수행한다.',
        tasks: ['개발 착수', '고객요구 분석', '제품·공정 설계', '시제품 제작', '설계 검증', '공정 유효성 확인', '양산 승인']
    },
    {
        file: 'P2.2.1_design_change.bpmn', id: 'P221', name: 'P2.2.1 설계변경 관리', description: '설계변경 요청의 영향성을 평가하고 승인된 도면과 BOM을 배포한다.',
        tasks: ['변경 요청', '기술 타당성 검토', '원가·품질 영향평가', '변경 승인', '도면·BOM 개정', '시제품 검증', '변경점 배포']
    },
    {
        file: 'P2.3.1_prototype_validation.bpmn', id: 'P231', name: 'P2.3.1 시제품 제작 및 검증', description: '시제품 제작계획을 수립하고 시험 결과를 설계에 반영한다.',
        tasks: ['제작계획 수립', '부품 조달', '시제품 조립', '기능 시험', '내구 시험', '문제점 개선', '검증 결과 승인']
    },
    {
        file: 'P2.4.1_ppap.bpmn', id: 'P241', name: 'P2.4.1 PPAP 승인', description: '신규·변경 부품의 양산 적합성을 검증하고 PPAP 승인을 관리한다.',
        tasks: ['PPAP 대상 선정', '제출자료 준비', '초도품 측정', '공정능력 평가', '고객 제출', '보완조치', '승인상태 등록']
    },
    {
        file: 'P3.1.1_supplier_selection.bpmn', id: 'P311', name: 'P3.1.1 신규 협력사 선정', description: '품질·원가·납기·기술 역량을 평가하여 신규 협력사를 승인한다.',
        tasks: ['후보사 발굴', '기본정보 조사', '현장실사', '품질·기술 평가', '가격·납기 협상', '선정심의', '협력사 등록']
    },
    {
        file: 'P3.1.2_purchase_order.bpmn', id: 'P312', name: 'P3.1.2 구매발주 및 납기추적', description: '소요량에 따라 발주하고 협력사 납기를 지속 추적한다.',
        tasks: ['구매요청 확인', '발주량 산정', '단가·계약 확인', '발주서 발행', '납기 회신 확인', '지연위험 조치', '입고 연계']
    },
    {
        file: 'P3.3.1_supplier_evaluation.bpmn', id: 'P331', name: 'P3.3.1 협력사 정기평가', description: '협력사의 품질·납기·원가 성과를 정기 평가하고 개선을 관리한다.',
        tasks: ['평가대상 확정', '성과자료 집계', '품질평가', '납기·원가평가', '등급 심의', '개선요청', '평가결과 통보']
    },
    {
        file: 'P4.2.1_master_production_schedule.bpmn', id: 'P421', name: 'P4.2.1 기준생산계획 수립', description: '판매계획과 자원 제약을 반영하여 주·일 생산계획을 확정한다.',
        tasks: ['수요계획 접수', '재고·수주 확인', '설비능력 분석', '자재가용성 확인', '생산계획 편성', '부하평준화', '계획 확정·배포']
    },
    {
        file: 'P4.2.2_work_order.bpmn', id: 'P422', name: 'P4.2.2 작업지시 및 생산실적', description: '작업지시 발행부터 생산실적·불량·공수 마감까지 관리한다.',
        tasks: ['작업지시 발행', '자재 불출', '작업 준비', '생산 수행', '실적 입력', '불량·공수 확인', '작업지시 마감']
    },
    {
        file: 'P4.3.1_first_article.bpmn', id: 'P431', name: 'P4.3.1 초도품 승인', description: '교대·금형·조건 변경 후 초도품 품질을 확인하고 생산을 승인한다.',
        tasks: ['초도 생산 준비', '조건 설정 확인', '초도품 생산', '치수·외관 검사', '결과 판정', '조건 보정', '양산 개시 승인']
    },
    {
        file: 'P4.3.2_line_changeover.bpmn', id: 'P432', name: 'P4.3.2 생산라인 교체작업', description: '품목 전환 시 자재·치공구·조건을 교체하고 라인을 재가동한다.',
        tasks: ['전환지시 확인', '이전 품목 정리', '자재·치공구 교체', '설비조건 설정', '시험가동', '초도 확인', '정상생산 전환']
    },
    {
        file: 'P5.1.1_inprocess_inspection.bpmn', id: 'P511', name: 'P5.1.1 공정검사', description: '공정 단계별 품질특성을 검사하고 이상 발생 시 즉시 조치한다.',
        tasks: ['검사계획 확인', '검사대상 채취', '치수 측정', '기능·외관 검사', '결과 판정', '이상 공정 통보', '검사실적 등록']
    },
    {
        file: 'P5.1.2_final_inspection.bpmn', id: 'P512', name: 'P5.1.2 완성품 검사 및 출하승인', description: '완성품의 법규·기능·외관 적합성을 확인하고 출하를 승인한다.',
        tasks: ['검사대상 확인', '법규항목 검사', '기능 시험', '외관 검사', '부적합 조치', '최종 판정', '출하 승인']
    },
    {
        file: 'P5.2.1_nonconforming_product.bpmn', id: 'P521', name: 'P5.2.1 부적합품 관리', description: '부적합품을 식별·격리하고 판정 결과에 따라 처리한다.',
        tasks: ['부적합 발견', '식별표 부착', '격리 보관', '원인·영향 검토', '처리방안 판정', '재작업·폐기', '처리결과 기록']
    },
    {
        file: 'P5.3.1_calibration.bpmn', id: 'P531', name: 'P5.3.1 검사장비 교정관리', description: '검사·측정 장비의 교정주기와 이상 장비 영향을 관리한다.',
        tasks: ['장비대장 확인', '교정대상 통보', '교정 의뢰', '성적서 검토', '합격라벨 부착', '이상영향 평가', '차기일정 등록']
    },
    {
        file: 'P5.4.1_capa.bpmn', id: 'P541', name: 'P5.4.1 시정·예방조치 CAPA', description: '품질문제의 근본원인을 제거하고 조치 효과를 검증한다.',
        tasks: ['문제 등록', '긴급조치', '근본원인 분석', '대책 수립', '대책 실행', '효과성 검증', 'CAPA 종결']
    },
    {
        file: 'P7.1.1_warehouse_receipt.bpmn', id: 'P711', name: 'P7.1.1 자재 입고 및 창고관리', description: '검사 합격 자재를 창고에 입고하고 위치·수량을 관리한다.',
        tasks: ['입고예정 확인', '수량 대조', '검사상태 확인', '바코드 부착', '적치 위치 배정', 'ERP 입고', '재고 정확성 확인']
    },
    {
        file: 'P7.2.1_inventory_count.bpmn', id: 'P721', name: 'P7.2.1 재고실사 및 차이조정', description: '정기·순환 실사를 통해 장부와 실물 재고 차이를 조정한다.',
        tasks: ['실사계획 수립', '재고이동 통제', '실물 수량 조사', '장부재고 비교', '차이 원인분석', '조정 승인', '재고 반영']
    },
    {
        file: 'P7.3.1_shipment.bpmn', id: 'P731', name: 'P7.3.1 완성차 출하 및 운송', description: '출하승인 차량을 배차하고 고객 인도까지 추적한다.',
        tasks: ['출하오더 확인', '차량·서류 대조', '출하 전 점검', '상차·배차', '출고 처리', '운송 추적', '고객 인도 확인']
    }
];

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function buildBpmn(sample) {
    const startX = 120;
    const stepX = 170;
    const y = 170;
    const nodes = [
        { id: `Start_${sample.id}`, tag: 'startEvent', name: '시작', width: 36, height: 36 },
        ...sample.tasks.map((name, index) => ({ id: `Task_${sample.id}_${index + 1}`, tag: 'task', name, width: 120, height: 70 })),
        { id: `End_${sample.id}`, tag: 'endEvent', name: '완료', width: 36, height: 36 }
    ];
    const positioned = nodes.map((node, index) => ({ ...node, x: startX + index * stepX, y: y + (70 - node.height) / 2 }));
    const flows = positioned.slice(0, -1).map((node, index) => ({
        id: `Flow_${sample.id}_${index + 1}`,
        source: node.id,
        target: positioned[index + 1].id
    }));
    const incoming = new Map();
    const outgoing = new Map();
    for (const flow of flows) {
        outgoing.set(flow.source, flow.id);
        incoming.set(flow.target, flow.id);
    }
    const processNodes = positioned
        .map((node) => {
            const children = [incoming.get(node.id) ? `      <bpmn:incoming>${incoming.get(node.id)}</bpmn:incoming>` : '', outgoing.get(node.id) ? `      <bpmn:outgoing>${outgoing.get(node.id)}</bpmn:outgoing>` : '']
                .filter(Boolean)
                .join('\n');
            return `    <bpmn:${node.tag} id="${node.id}" name="${escapeXml(node.name)}">\n${children}\n    </bpmn:${node.tag}>`;
        })
        .join('\n');
    const sequenceFlows = flows.map((flow) => `    <bpmn:sequenceFlow id="${flow.id}" sourceRef="${flow.source}" targetRef="${flow.target}" />`).join('\n');
    const shapes = positioned
        .map((node) => `      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}">\n        <dc:Bounds x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" />\n      </bpmndi:BPMNShape>`)
        .join('\n');
    const edges = flows
        .map((flow, index) => {
            const source = positioned[index];
            const target = positioned[index + 1];
            return `      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">\n        <di:waypoint x="${source.x + source.width}" y="${source.y + source.height / 2}" />\n        <di:waypoint x="${target.x}" y="${target.y + target.height / 2}" />\n      </bpmndi:BPMNEdge>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${sample.id}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Process GPT TYM Sample Generator">
  <bpmn:process id="Process_${sample.id}" name="${escapeXml(sample.name)}" isExecutable="true">
    <bpmn:documentation>${escapeXml(sample.description)}</bpmn:documentation>
${processNodes}
${sequenceFlows}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${sample.id}">
    <bpmndi:BPMNPlane id="Plane_${sample.id}" bpmnElement="Process_${sample.id}">
${shapes}
${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

await mkdir(outputDir, { recursive: true });
for (const sample of samples) {
    await writeFile(path.join(outputDir, sample.file), buildBpmn(sample), 'utf8');
}

const procDefId = (sample) => {
    const code = sample.id.slice(1).split('').join('.');
    const slug = sample.file.replace(/^[^_]+_/, '').replace(/\.bpmn$/, '').replaceAll('_', '-');
    return `p${code}-${slug}`;
};

const hierarchy = [
    {
        id: 'tym-customer-management', name: '고객·경영관리', majors: [
            { id: 'tym-sales-planning', name: '판매계획', prefixes: ['P11'] },
            { id: 'tym-order-management', name: '주문·납기관리', prefixes: ['P12'] }
        ]
    },
    {
        id: 'tym-product-development', name: '제품개발', majors: [
            { id: 'tym-new-product-development', name: '신제품 개발', prefixes: ['P21', 'P23'] },
            { id: 'tym-engineering-change', name: '설계변경·양산승인', prefixes: ['P22', 'P24'] }
        ]
    },
    {
        id: 'tym-procurement', name: '구매·협력사관리', majors: [
            { id: 'tym-purchasing', name: '구매·협력사 선정', prefixes: ['P31'] },
            { id: 'tym-supplier-quality', name: '협력사 품질·평가', prefixes: ['P32', 'P33'] }
        ]
    },
    {
        id: 'tym-production', name: '생산관리', majors: [
            { id: 'tym-material-inspection', name: '자재검사', prefixes: ['P41'] },
            { id: 'tym-production-control', name: '생산계획·실적', prefixes: ['P42'] },
            { id: 'tym-process-control', name: '공정·변경관리', prefixes: ['P43'] }
        ]
    },
    {
        id: 'tym-quality', name: '품질경영', majors: [
            { id: 'tym-quality-inspection', name: '품질검사', prefixes: ['P51'] },
            { id: 'tym-quality-assurance', name: '부적합·측정관리', prefixes: ['P52', 'P53'] },
            { id: 'tym-quality-improvement', name: '시정조치·내부심사', prefixes: ['P54'] }
        ]
    },
    {
        id: 'tym-facility', name: '설비·보전', majors: [
            { id: 'tym-maintenance', name: '설비보전', prefixes: ['P61'] }
        ]
    },
    {
        id: 'tym-logistics', name: '물류관리', majors: [
            { id: 'tym-warehouse', name: '입고·창고관리', prefixes: ['P71'] },
            { id: 'tym-inventory', name: '재고관리', prefixes: ['P72'] },
            { id: 'tym-shipping', name: '출하·운송', prefixes: ['P73'] }
        ]
    }
];

const manifest = samples.map((sample) => ({
    procDefId: procDefId(sample),
    processId: sample.id,
    name: sample.name,
    description: sample.description,
    file: sample.file
}));
manifest.push({
    procDefId: 'p5.4.3-internal-audit',
    processId: 'P543',
    name: 'P5.4.3 내부심사 프로세스',
    description: '품질·환경·안전보건 경영시스템의 준수성과 효과성을 점검하고 시정조치 및 수평전개까지 관리한다.',
    file: 'P5.4.3_internal_audit.bpmn'
});

const processMap = {
    mega_proc_list: hierarchy.map((mega) => ({
        id: mega.id,
        name: mega.name,
        domain_id: 'manufacturing',
        major_proc_list: mega.majors.map((major) => ({
            id: major.id,
            name: major.name,
            domain_id: 'manufacturing',
            sub_proc_list: manifest
                .filter((item) => major.prefixes.some((prefix) => item.processId.startsWith(prefix)))
                .map((item) => ({ id: item.procDefId, name: item.name }))
        }))
    }))
};

await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'process-map.json'), `${JSON.stringify(processMap, null, 2)}\n`, 'utf8');

console.log(`Generated ${samples.length} TYM BPMN samples and a ${manifest.length}-process hierarchy in ${outputDir}`);
