---
name: ci-pass-impact-aware-tests
description: >-
  Keeps GitHub Actions frontend workflow green by running the same checks as CI
  before push (build, license, SAST when relevant). Runs slow tests (e.g. Playwright
  E2E) only when changes plausibly affect those areas. Use before commits/PRs,
  when fixing CI, or when the user mentions build, workflow, or test strategy.
---

# CI 통과 · 영향 기반 검증

## 근거 워크플로

`main` 푸시 시 `.github/workflows/deploy.yaml`의 **`build-and-deploy`** 잡은 대략 다음 순서다.

1. `npm ci` (또는 `yarn install --frozen-lockfile`)
2. `npm run license:check`
3. `npm run sast:vue:report`
4. **`npm run build`** → `vue-tsc --noEmit` 후 `vite build`

**PR/푸시 전 “통과해야 하는” 핵심은 4번**이며, 로그에서 자주 터지는 단계명은 **「Type check and build」** 이다.

---

## 에이전트가 코드 변경 후 수행할 검증 (느린 것부터 줄이기)

### 항상 권장 (CI와 동일한 실패 지점)

- **`npm run build`** 와 동등: 타입 검사 + 프로덕션 번들 생성.  
  - Windows에서 `npm run build`가 `NODE_OPTIONS` 때문에 실패하면 Git Bash/WSL에서 실행하거나, `npx vue-tsc --noEmit && npx vite build` 로 분리 실행하고 필요 시 `NODE_OPTIONS=--max-old-space-size=4096` 만 설정한다.

변경이 **문서만**이거나 **`.md`만**이면 빌드 생략 가능. **그 외 `src/`·설정·의존성**이면 빌드 권장.

### 의존성·라이선스에 손댄 경우

- `package.json` / `package-lock.json` / 신규 npm 패키지 추가·업그레이드 시: **`npm run license:check`** 를 추가로 실행한다.

### SAST 리포트 단계와 맞추고 싶을 때

- `src/**/*.vue|js|ts` 대량 수정·Semgrep 규칙 관련 시: **`npm run sast:vue:report`** (로컬에서 시간이 든다면 CI에 맡기되, **푸시 직전 최소 1회**는 권장).

---

## 느린 테스트(Playwright E2E 등) — **영향 있을 때만**

아래에 해당할 때만 **로컬에서 E2E/스모크**를 돌린다. 매 커밋마다 돌리지 않는다.

| 조건 (하나라도 해당) | 실행 예 |
|----------------------|---------|
| `playwright/`·`*.spec.ts` 수정 | 해당 스펙 또는 `npm run test:e2e:smoke` |
| 라우터·로그인·`main.ts`·루트 `App`·인증 플로우 변경 | `npm run test:e2e:smoke:simple` 또는 팀이 쓰는 스모크 |
| 배포 후 스모크와 동일하게 확인해야 할 UX 변경 | 사용자가 요청했을 때만 전체 스모크 |

**해당 없으면** E2E는 생략하고, 위 **빌드(및 필요 시 license/SAST)** 만으로 충분하다고 가정한다.

> 참고: 워크플로 후반의 Playwright 잡은 **배포 파이프라인**에 있으며, 로컬에서 매번 돌릴 필요는 없다.

---

## 완료 보고 시

- **빌드(및 선택적 license/SAST)** 를 실제로 실행했다면 그 결과를 근거로 말한다.  
- 실행하지 않았다면 **“CI에서 `npm run build` 단계 확인 필요”** 라고 명시한다.  
- 느린 E2E는 **영향 범위가 있을 때만** 실행했는지 한 줄로 구분한다.

---

## 다른 스킬과의 관계

- 오프라인/외부 리소스(번들·CDN): [offline-first-external-resources](../offline-first-external-resources/SKILL.md)
- 백엔드 Strategy: [process-gpt-backend-strategy](../process-gpt-backend-strategy/SKILL.md)
