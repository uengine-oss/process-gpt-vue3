---
name: offline-first-external-resources
description: >-
  Prefers bundling or vendoring assets (no CDN/internet) for air-gapped deployments.
  Requires explicit user confirmation before adding or modifying code that depends on
  internet-only resources (external scripts, fonts, maps, third-party APIs). Use when
  writing or editing Vue/TS/HTML/CSS, adding dependencies, or when the user mentions
  offline, air-gapped, intranet, or no-internet environments.
---

# 오프라인(폐쇄망) 우선 · 외부 리소스

## 전제 (이 저장소)

배포 환경 중 **인터넷이 없는 폐쇄망**이 있다. 코드는 **기본적으로 인터넷 없이 동작**해야 한다.

## 에이전트가 지켜야 할 규칙

### 1. 리소스는 로컬·번들 우선

새 코드나 수정 시 **외부 URL에서만 가져오는 방식을 기본으로 두지 않는다.**

| 대상 | 권장 |
|------|------|
| JS/CSS 라이브러리 | `npm` 패키지 + `import` / Vite 번들 |
| 폰트·아이콘 | 패키지 또는 `public/` 정적 파일로 포함 |
| 이미지·문서 | 리포지토리 또는 빌드 산출물에 포함 |
| 폴리필·스크립트 | `index.html`에 CDN `<script src="https://...">` 추가 **지양** |

가능하면 **의존성으로 선언**하고, 불가피하면 **`public/`에 파일을 두고 상대 경로**로 참조한다.

### 1.1 `dist` 경로를 소스에서 import하지 않음

- 이 프로젝트의 **`dist/`** 는 **Vite 등으로 나온 배포 산출물**이며, **소스(SCSS/TS/Vue)에서 `dist/...`를 직접 import하지 않는다.**
- **npm 패키지**도 마찬가지로, 스타일·JS를 넣을 때 **`패키지명/dist/...`처럼 빌드 산출물 폴더만 가리키는 경로는 지양**한다. `dist`는 패키지 제작 측의 배포용 아티팩트 구역으로 보고, 가능하면 다음 순으로 맞춘다.
  - 패키지 **`package.json`의 `style` / `main` / `exports`** 에 맞는 공식 경로
  - 공개된 **`src/`** 아래 소스(예: `some-package/src/style.css`)
  - 문서에 안내된 **루트 기준 import** (번들러가 `node_modules`에서 해석)
- 빌드가 깨져 `dist`만 있다고 판단될 때는 **의존성 추가·버전 정렬·`public` 복사** 등으로 해결하고, **소스에 `.../dist/...` 고정**은 최후 수단으로만 쓰며, 그 경우 **사용자에게 한 줄 사유**를 남긴다.
- 일부 패키지 **`src/`** CSS는 webpack 전용 `~패키지명/...` import를 쓴다. Vite/PostCSS는 이를 해석하지 못할 수 있으므로, **`node_modules`에서 번들러가 직접 해석하는 `의존성명/공개 경로`**(예: `perfect-scrollbar/css/...`)로 바꾸거나, 동등한 스타일을 **공식 문서·`package.json` exports** 기준으로 맞춘다.

### 2. 인터넷이 **필수**인 기능이면 — **코드 수정 전에 사용자 확인**

아래에 해당하면 **파일을 고치기 전에** 사용자에게 짧게 확인한다.

- 외부 API(공개 HTTPS)만으로만 동작하는 호출을 **새로 넣거나** 기본값으로 만드는 경우
- CDN 전용 스크립트/스타일을 도입하는 경우
- 지도·번역·분석 등 **외부 SaaS 위젯**을 임베드하는 경우
- `fonts.googleapis.com`, `unpkg`, `jsdelivr` 등 **런타임 네트워크 로딩**을 추가하는 경우

**확인 예시 (한국어):**

> 이 변경은 런타임에 인터넷(외부 도메인) 접속이 필요합니다. 폐쇄망 배포에 포함할까요? (예: 대체 오프라인 방안 / 해당 기능만 비활성화 / 진행)

사용자가 **진행을 명시하기 전까지** 인터넷 의존 코드를 **추가·변경하지 않는다.**

### 3. 기존 코드에 이미 있는 외부 참조

- 리팩터·버그 수정 시 **가능하면** 같은 PR/범위에서 **로컬 번들로 치환**을 제안할 수 있다.
- 범위 밖이면 **메모만** 하고, 치환은 사용자가 요청할 때 수행한다.

### 4. 예외 (인터넷이 당연히 필요한 기능)

다음은 **제품 요구로 인터넷이 정의상 필요**할 수 있다. 그래도 **기본값·폴백**을 문서화하거나, 설정으로 끌 수 있게 하는 것이 좋다.

- LLM/채팅 완성 API 연동
- 외부 결제·본인인증
- 사용자가 명시적으로 “외부 연동만 허용”이라고 한 경우

이 경우에도 **폐쇄망 빌드**를 망가뜨리지 않도록 `env` 분기·기능 플래그를 권장한다.

## 빠른 체크리스트 (코드 작성 직전)

- [ ] 새 `https://` / `http://` URL이 **런타임**에 로드되는가? → **사용자 확인** 또는 로컬 자산화
- [ ] `index.html`에 CDN 한 줄 추가인가? → **지양**, 대안 제시
- [ ] npm으로 해결 가능한가? → **패키지 추가** 우선
- [ ] import 경로에 **`dist/`** (프로젝트·타 패키지)가 들어갔는가? → **제거**, 공식 엔트리·`src`·문서 권장 경로로 교체

## 다른 스킬과의 관계

- 백엔드 Strategy/모드 분기는 [process-gpt-backend-strategy](../process-gpt-backend-strategy/SKILL.md) 등과 별개다.
- 이 스킬은 **프론트·정적 리소스·외부 네트워크 의존성**에 초점을 둔다.
- **GitHub Actions 통과·영향 있을 때만 E2E**: [ci-pass-impact-aware-tests](../ci-pass-impact-aware-tests/SKILL.md)
