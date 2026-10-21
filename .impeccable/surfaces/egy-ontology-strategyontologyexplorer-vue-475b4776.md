---
version: 1
slug: "egy-ontology-strategyontologyexplorer-vue-475b4776"
primary_target: "src/components/strategy/ontology/StrategyOntologyExplorer.vue"
related_targets: []
---

# Surface brief — 온톨로지 익스플로러 (전략 보드 탭)

Scope: src/components/strategy/ontology/StrategyOntologyExplorer.vue (전략 보드 /strategy-board?view=explorer). Mode: Operate.
Audience: 경영기획·전략 담당, 프로세스 오너, 경영진(회의실 공유), 컨설턴트·영업(시연). Task: 위험 KPI에서 실행·병목·담당자까지 추적하고 화면만으로 설명한다.
Constraints: 기능·데이터·상호작용 유지(8열 워터폴, 체인 강조, 상세 패널, 원인 분석, 보기 설정, 드래그, 위험/주의/양호). 화려한 효과 금지. 밝은 화면(사무실·프로젝터 공용). 앱 다른 화면과 달라도 됨(사용자 허용).

## Direction contract

THESIS: 전략–실행 그래프를 오리엔티어링 지도로 읽는다 — 전체 데이터는 조용한 지형, 선택한 KPI의 결정적 경로만 번호 붙은 코스로 위에 얹힌다. 노드-링크 툴의 파스텔 칩·흐린 엣지 덩어리를 거부한다.
OWN-WORLD: ISOM 잉크 — 흰 바탕(달리기 숲), 단계 띠는 열린 땅 노랑·덤불 올리브·습지 파랑의 아주 옅은 틴트, 규칙선은 등고선 갈색 1px, 코스 퍼플(#7B2CBF)은 선택 경로·주 행동에만. 상태는 기호표: ▲ 위험·병목(적), ◆ 주의·지연(황토), 무표시 양호. 숫자·열 머리는 Barlow Condensed.
STORY: 열마다 지형 띠로 단계가 구분되어 보이고, KPI를 고르면 1번(전략)부터 끝(스킬)까지 번호 코스가 그어지며, 오른쪽 코스 설명표가 각 지점의 수치를 읽어 준다.
FIRST VIEWPORT: 상단 툴바(검색·보기 설정·동기화)와 기호표 범례 한 줄 → 좌측 넓은 지형 캔버스(전략·KPI·프로세스·태스크·실행 열, 띠 틴트, 열 머리 큰 응축 숫자) → 우측 340px 패널(선택 시 코스 설명표가 맨 위, 이어 원인 분석 퍼플 버튼).
FORM: 오리엔티어링 지도와 범례 — 경쟁 카드(로스터 외 챌린저 notation-diagram-systems-orienteering-map), seed a65d9fa9.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
