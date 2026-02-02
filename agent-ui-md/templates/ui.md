# 표준 UI Cookbook (Vue3 + Vuetify3)

**범위**: 레이아웃·버튼·다이얼로그·폼·카드. 비즈니스로직·API 제외.
**아이콘**: `<v-icon>mdi-xxx</v-icon>` 또는 `<Icons :icon="'xxx'" :size="20" />` 사용.
**Icons 컴포넌트**: 전역 컴포넌트라 **import 불필요**. 지침에 Icons 사용 시 그대로 적용.
**v-row/v-col 기본값**: `<v-row class="ma-0 pa-0">`, `<v-col class="pa-0">`

---

## 기존 화면 수정 규칙

| 허용 (UI 스타일만) | 금지 (데이터/로직) |
|------|------|
| 커스텀 CSS → Vuetify 클래스 | 컬럼 구조 변경 |
| `<button>` → `<v-btn>` | 테이블 헤더/컬럼 순서 변경 |
| `<table>` → `<v-table>` | 데이터 바인딩 변경 |
| class, style, variant, density 추가 | 이벤트 핸들러 변경 |

**데이터 바인딩 기존 유지 (절대 변경 금지)**:
- `v-model`, `:model-value`, `@update:model-value`
- `:value`, `@input`, `@change`
- `:items`, `item-title`, `item-value`
- `ref`, `@click`, `@keyup`, `@submit` 등 모든 이벤트

---

## isMobile 우선순위

1. `this.globalIsMobile?.value` (main.ts)
2. `computed(() => window.innerWidth <= 768)`
3. `useDisplay().mobile`

---

## 버튼

**배치 규칙**: 추가/생성 버튼은 기본적으로 **우측 배치** (`<v-spacer />` or 상위 컴포넌트가 d-flex일 때 class="ml-auto" 활용)

### [BLOCK:button.primary.v1]
주요 액션 버튼 (저장, 확인, 추가 등).

```vue
<v-btn color="primary" rounded variant="flat">
    <!-- 기존 @click, :disabled, 텍스트/아이콘 유지 -->
</v-btn>
```

### [BLOCK:button.secondary.v1]
보조 버튼 (취소, 선택 등 주요 액션이 아닐 때).

```vue
<v-btn color="gray" rounded="pill" variant="flat">
    <!-- 기존 @click, 텍스트 유지 -->
</v-btn>
```

### [BLOCK:button.icon.v1]
아이콘 버튼 - 테이블 액션, 다이얼로그 닫기 등.

```vue
<v-btn variant="text" density="compact" icon>
    <!-- 기존 @click, 아이콘 유지 -->
</v-btn>
```

### [BLOCK:button.icon.header.v1]
아이콘 버튼 - 헤더, 툴바 등 (툴팁 + Icons 컴포넌트).

```vue
<v-tooltip>
    <!-- 기존 :text, 툴팁 내용 유지 -->
    <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon>
            <!-- 기존 @click, Icons 유지 -->
        </v-btn>
    </template>
</v-tooltip>
```

### [BLOCK:button.icon.action.v1]
아이콘 버튼 - 삭제, 복원 등 액션 (툴팁 + mdi 아이콘).

```vue
<v-tooltip location="bottom">
    <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" density="comfortable">
            <!-- 기존 @click, 아이콘 유지 -->
        </v-btn>
    </template>
    <!-- 기존 툴팁 텍스트 유지 -->
</v-tooltip>
```

---

## 탭

### [BLOCK:tabs.v1]
| 환경 | 컴포넌트 | 선택 스타일 |
|------|----------|-------------|
| 데스크톱 | `<v-tabs>` + `<v-tab>` | `color="primary"` |
| 모바일 | `<v-btn>` 반복 | `background: #808080; color: white;` |

```vue
<!-- 데스크톱: v-if="!isMobile" -->
<v-tabs v-model="tab" color="primary">
    <v-tab v-for="item in tabItems" :key="item.value" :value="item.value">
        {{ $t(item.label) }}
    </v-tab>
</v-tabs>

<!-- 모바일: v-else -->
<div class="d-flex flex-wrap ga-2">
    <v-btn v-for="item in tabItems" :key="item.value"
        :variant="tab === item.value ? 'flat' : 'text'"
        :style="tab === item.value ? 'background: #808080; color: white;' : ''"
        size="small" @click="tab = item.value">
        {{ $t(item.label) }}
    </v-btn>
</div>
```

---

## 다이얼로그

### [BLOCK:dialog.container.v1]

```vue
<v-dialog :fullscreen="isMobile" :max-width="isMobile ? '100%' : '500px'" persistent>
    <!-- 기존 v-model 유지 -->
    <v-card>
        <!-- header, body, footer -->
    </v-card>
</v-dialog>
```

### [BLOCK:dialog.header.v1]

```vue
<v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
    <!-- 기존 타이틀 유지 -->
    <v-btn variant="text" density="compact" icon>
        <!-- 기존 @click 유지 -->
        <v-icon>mdi-close</v-icon>
    </v-btn>
</v-card-title>
```

### [BLOCK:dialog.body.v1]

```vue
<v-card-text class="pa-4 pb-0">
    <!-- 기존 폼 필드 유지 -->
</v-card-text>
```

### [BLOCK:dialog.footer.v1]

```vue
<v-card-actions class="d-flex justify-end align-center pa-4">
    <!-- 기존 @click, :disabled, 텍스트 유지 -->
    <v-btn variant="text"><!-- 취소 --></v-btn>
    <v-btn color="primary" rounded variant="flat"><!-- 확인 --></v-btn>
</v-card-actions>
```

---

## 폼/필드

### [BLOCK:field.search.v1]
검색창 (pill 스타일, Icons 전역 컴포넌트 사용).

```vue
<div class="d-flex align-center border border-borderColor header-search rounded-pill px-5"
    style="max-width: 246px; min-width: 160px;"
>
    <Icons :icon="'magnifer-linear'" :size="20" />
    <v-text-field
        <!-- 기존 데이터 바인딩 유지 (v-model 등) -->
        variant="plain"
        density="compact"
        class="position-relative pt-0 ml-3 custom-placeholer-color"
        <!-- 기존 placeholder 유지 -->
        single-line
        hide-details
    />
</div>
```

### [BLOCK:field.select.v1]
필터/선택용 셀렉트 (너비 제한).

```vue
<v-select
    <!-- 기존 데이터 바인딩 유지 (v-model, :items, item-title, item-value 등) -->
    clearable
    variant="outlined"
    density="compact"
    hide-details
    class="flex-grow-0"
    style="min-width: 250px;"
/>
```

### [BLOCK:form.two-column.v1]

```vue
<div class="d-flex ga-2">
    <!-- 기존 v-model, :label 유지 -->
    <v-text-field variant="outlined" />
    <v-text-field variant="outlined" />
</div>
```

### [BLOCK:field.combobox.v1]

```vue
<v-combobox multiple chips clearable closable-chips variant="outlined" hide-details="auto">
    <!-- 기존 v-model, :label, :items 유지 -->
</v-combobox>
```

---

## 레이아웃

### [BLOCK:alert.info.v1]

```vue
<v-alert dense outlined type="info" color="gray" class="mb-4 pa-4 pt-2 pb-2">
    <!-- 기존 메시지 유지 -->
    <span class="text-body-1"></span>
</v-alert>
```

### [BLOCK:card.container.v1]

```vue
<v-card class="pa-0" elevation="10">
    <!-- 기존 내용 유지 -->
</v-card>
```

### [BLOCK:page.header.v1]

```vue
<div class="d-flex align-center mb-4">
    <!-- 기존 타이틀 유지 -->
    <v-spacer />
    <v-btn color="primary" rounded variant="flat">
        <!-- 기존 @click, 텍스트 유지 -->
    </v-btn>
</div>
```

---

## 참조

- **테이블**: `agent-ui-md/templates/table-component.md`
- **도움말**: `agent-ui-md/templates/info-component.md`
- **다국어**: `agent-ui-md/templates/i18n-locales.md`
