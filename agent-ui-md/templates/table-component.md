# 테이블 컴포넌트 가이드

**선택 기준**: `v-table` (단순 목록) / `v-data-table` (정렬, 페이지네이션 필요 시)

---

## 기존 화면 수정 규칙

| 허용 (UI 스타일만) | 금지 (데이터/로직) |
|------|------|
| `<table>` → `<v-table>` | v-for, :key, v-if 변경 |
| class, style, density 추가 | :items, :headers, :loading 변경 |
| 카드 래퍼 추가 | 컬럼 구조/순서 변경 |

**데이터 바인딩 기존 유지 (절대 변경 금지)**:
- `v-for`, `:key`, `v-if`, `v-else-if`, `v-else`
- `:items`, `:headers`, `:loading`, `:hover`
- `:model-value`, `v-model`, `@click` 등 모든 이벤트
- 기존 데이터 참조 (`item.xxx`, `items.length` 등)

---

## [BLOCK:table.simple.v1] - v-table 단순 목록

```vue
<v-card class="pa-0" variant="outlined">
    <v-table density="comfortable">
        <thead>
            <!-- 기존 th 컬럼 유지 -->
        </thead>
        <tbody>
            <!-- 기존 v-if, v-for, 데이터 바인딩 유지 -->
            <!-- 로딩 행: class="text-center pa-8" -->
            <!-- 빈 데이터 행: class="text-center pa-8 text-medium-emphasis" -->
        </tbody>
    </v-table>
</v-card>
```

---

## [BLOCK:table.data.v1] - v-data-table 기본

```vue
<v-card class="pa-0" variant="outlined">
    <v-data-table density="comfortable" :hover="true">
        <!-- 기존 :headers, :items, :loading 유지 -->
        <template #no-data>
            <div class="text-center pa-8 text-medium-emphasis"><!-- 기존 메시지 유지 --></div>
        </template>
        <!-- 기존 슬롯 유지 -->
    </v-data-table>
</v-card>
```

---

## 커스텀 셀 슬롯 (UI 스타일만 적용)

| 패턴 | UI 스타일 |
|-----|------|
| 액션 버튼 | `variant="text" density="compact" icon` |
| 스위치 | `color="primary" density="compact" hide-details` |
| 상태 칩 | `size="small" variant="tonal"` |
| 아이콘+텍스트 | `class="d-flex align-center"`, `<v-icon size="16" class="mr-2">` |

**주의**: 기존 `:model-value`, `:color` 조건, `@click` 등은 그대로 유지

---

## 공통 규칙

- 카드 래퍼: `<v-card class="pa-0" variant="outlined">`
- 밀도: `density="comfortable"`
- 로딩: `size="32"`, 빈 데이터: `pa-8`
