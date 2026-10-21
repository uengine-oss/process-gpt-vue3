# UI 테두리·오버레이 트러블슈팅 가이드

2026-09-09, "페이지 전반에서 입력칸 상단이 가려지거나 빈 사각형으로 보이는" 증상을
디버깅하며 확인된 원인 3계열과 진단 방법을 정리한다. 비슷한 증상(선이 사라짐,
콘텐츠 일부가 가려짐, 화면·세션마다 다르게 보임)이 다시 나오면 이 순서로 좁힌다.

## 증상별 원인 3계열

### 1. fixed/absolute 오버레이가 콘텐츠를 덮는 경우

- **증상**: 페이지마다 같은 높이의 콘텐츠(주로 첫 입력칸)가 가려짐. 스크롤하면
  가려지는 대상이 바뀜.
- **사례**: `GlobalNoticeBanner`가 `position: fixed`로 떠서 레이아웃 공간을 차지하지
  않아 첫 입력 필드를 덮었음.
- **원칙**: 상시 노출 배너·알림류는 문서 흐름에 넣고(FullLayout이 콘텐츠 프레임
  위에 배치), PAL 고정 높이 컨테이너(`.pal-content-container`)는 flex column으로
  세로 공간을 나눈다. 오버레이는 일시적 요소(토스트, 메뉴)에만 쓴다.
- **진단**: DevTools에서 가려진 지점에 `document.elementsFromPoint(x, y)` — 덮는
  요소가 스택 최상단에 나온다(`pointer-events: none` 요소는 제외됨에 유의).

### 2. CSS 로드 순서 경합 (Vuetify 지연 주입 vs overrides.css)

- **증상**: 같은 코드인데 세션·방문 경로·HMR 이력에 따라 스타일이 다르게 보임.
  일부 속성만 디자인 시스템 값이고 나머지는 Vuetify 기본값인 혼합 상태.
- **원인**: vite-plugin-vuetify가 컴포넌트 CSS(VField.sass 등)를 컴포넌트 최초 로드
  시점에 주입 → `overrides.css`가 "마지막"이라는 보장이 없음. 동특이성 규칙은
  나중에 주입된 쪽이 이긴다.
- **해결(적용됨)**: `src/ds/vuetify-bridge/overrides.css` 전체를 CSS 중첩 `body { }`로
  감싸 모든 셀렉터에 +1 특이성. **이 파일에 규칙을 추가할 때는 반드시 body 래퍼
  안에 넣을 것.** Vuetify가 의도적으로 더 높은 특이성으로 덮는 규칙은 그대로
  Vuetify가 이기므로, 그런 규칙을 덮으려면 동일 특이성 이상으로 써야 한다
  (예: 포커스 시 `.v-field--variant-outlined.v-field--focused .v-field__outline`이
  (0,3,0)으로 세그먼트 두께를 되살리는 것을 같은 셀렉터로 다시 덮은 사례).
- **진단**: 콘솔에서
  `getComputedStyle(el).getPropertyValue('--변수')` / `borderTopWidth` / `opacity`를
  찍어 어느 쪽 값인지 확인. 스타일 주입 순서는
  `[...document.querySelectorAll('style')].map(s => s.getAttribute('data-vite-dev-id'))`.

### 3. 세그먼트 외곽선·헤어라인이 화면에서 사라지는 경우

- **증상**: 계산값(computed)은 정상인데 특정 변(주로 상단)만 화면에서 안 보임.
  dpr 1(비레티나)이나 브라우저 줌에서 발생, 스크롤 위치에 따라 변함.
  **3px 불투명 테두리조차 끊기면 100% 이 계열.**
- **원인 두 가지**:
  - Vuetify outlined 필드는 테두리를 start(12px)/notch(라벨 폭)/end **세 요소
    조각으로 이어 붙여** 그린다. 조각별 픽셀 스냅·이음새·폰트 메트릭에 따라
    특정 조각의 변만 끊길 수 있다.
  - 0.5px 헤어라인은 장치 픽셀로 나눠 담길 때(비정수 배율) 40/60%로 갈라지고,
    흰 배경 대비 32/255 수준의 연한 색은 그 순간 사실상 흰색이 된다.
- **해결(적용됨)**: 입력 필드는 세그먼트 테두리를 `--v-field-border-width: 0`으로
  전부 끄고 `.v-field` 요소 자체에 **연속된 사각형 테두리 하나**를 그린다. 떠 있는
  라벨은 노치 틈 대신 배경 패치(`--cds-surface-2`)를 깔아 선 위에 얹는다.
  0.5px 헤어라인은 `@media (min-resolution: 2dppx)`에서만 사용.
- **진단**: 콘솔에서 테두리를 `3px solid red`로 강제해 본다.
  - 빨간 선이 온전히 보이면 → 색/두께가 너무 연한 것 (색 보상)
  - 빨간 선도 끊기면 → 그리는 구조 문제 (연속 테두리로 전환)

## 아직 0.5px 헤어라인을 쓰는 곳 (같은 증상 후보)

`overrides.css`: `.v-btn--variant-outlined`, 카드/시트 variant 테두리, `.v-table`
th/td 하단선, `.v-navigation-drawer`, `.v-app-bar`, elevation 유틸리티.
`src/ds/components/`: PgCard, PgTable, PgTextField, PgTextarea, PgMenu, PgDivider 등.

이들에서 "선이 안 보인다"는 제보가 오면: 저밀도에서 1px + 진한 색
(`--cds-border-stronger`)으로 보상하고, 헤어라인은 `min-resolution: 2dppx`
미디어쿼리로 한정한다(입력 필드에 적용한 패턴과 동일).

## 진단용 원커맨드

문제 요소 위에서 콘솔에:

```js
(() => {
  const el = document.querySelector('여기에 셀렉터');
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    dpr: window.devicePixelRatio,                       // 1.8, 0.9 등이면 배율 문제 의심
    rect: `${r.x},${r.y} ${r.width}x${r.height}`,       // 소수점 y면 픽셀 스냅 위험
    borderTop: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
    opacity: cs.opacity,
    stack: document.elementsFromPoint(r.x + r.width/2, r.y + 1)
      .slice(0, 5).map(e => (e.className.baseVal ?? e.className).toString().slice(0, 50))
  };
})()
```

- computed가 비정상 → 계열 2 (CSS 경합)
- computed 정상 + 다른 요소가 스택 상단 → 계열 1 (오버레이)
- computed 정상 + 스택도 정상 → 계열 3 (렌더링), 3px red 테스트로 확정
