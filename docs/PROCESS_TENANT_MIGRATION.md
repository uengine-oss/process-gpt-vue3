# 프로세스 데이터 테넌트 이관

`scripts/migrate-process-tenant.sh`는 한 테넌트의 프로세스 설계 데이터를 동일한 식별자와 연관관계를 유지한 채 다른 테넌트로 일괄 이관한다. 기본 대상 테넌트는 `tym`이다.

이 작업은 복사가 아니라 **테넌트 소유권 변경(move)** 이다. 원본 테넌트에 데이터를 남겨야 한다면 이 스크립트를 실행하지 말고 별도의 복제 작업을 사용해야 한다.

## 이관 범위

기본 범위:

- 프로세스 체계도와 지표 설정: `configuration(proc_map, metrics)`, `proc_map_history`
- 프로세스/BPMN 원본과 버전: `proc_def`, `proc_def_arcv`, `proc_def_version`
- 순서도 파싱 및 요소 UUID: `tb_bpmn_model`과 하위 모델 데이터, `bpmn_element_map`
- 폼과 편집 설정: `form_def`, `activity_config`, `fte_capacity`, `task_property_schema`, `palette_task_types`
- 검토/승인/스냅샷/Copilot: `proc_def_comments`, `proc_def_approval_*`, `proc_def_snapshots`, `proc_def_copilot_log`
- 설치 컴포넌트와 개선 제안: `installed_components`, `feedback_proposals`

`tb_bpmn_lane`, `tb_bpmn_node`, `tb_bpmn_link`, `tb_bpmn_version`, `tb_bpmn_model_lock`는 `model_id`로 부모 모델에 연결되어 있어 별도 `tenant_id` 변경 없이 함께 이관된다.

`--include-runtime`을 지정하면 다음 실행 데이터도 포함한다.

- `bpm_proc_inst`
- `todolist`
- `task_execution_properties`
- `fte_snapshot`

사용자, 조직, 권한, 채팅, 알림, 감사 로그, 스토리지 파일은 프로세스 데이터 범위에서 제외한다. 해당 데이터까지 옮겨야 한다면 사용자 FK와 접근권한을 포함한 별도 이관 계획이 필요하다.

대상 `tym` 테넌트에서 데이터를 조회·편집할 사용자는 별도로 `users.tenant_id = 'tym'` 소속과 필요한 역할을 갖고 있어야 한다.

## 실행

DB 관리자 접속 문자열을 전용 환경변수로 전달한다. 기본 실행은 전체 UPDATE와 제약조건을 실제로 검증한 뒤 롤백하는 미리보기다.

```sh
PROCESS_MIGRATION_DATABASE_URL='postgresql://...' \
  scripts/migrate-process-tenant.sh --source process-gpt
```

출력된 테이블별 건수와 충돌 여부를 확인한 뒤 한 번에 반영한다.

```sh
PROCESS_MIGRATION_DATABASE_URL='postgresql://...' \
  scripts/migrate-process-tenant.sh --source process-gpt --apply
```

실행 이력까지 포함하려면 다음과 같이 실행한다.

```sh
PROCESS_MIGRATION_DATABASE_URL='postgresql://...' \
  scripts/migrate-process-tenant.sh \
  --source process-gpt \
  --target tym \
  --include-runtime \
  --apply
```

## 안전장치

- 모든 변경과 대상 테넌트 생성은 하나의 트랜잭션에서 실행된다.
- SQL 오류나 FK/UNIQUE 충돌이 발생하면 전체 작업이 롤백된다.
- 테넌트 값만 바꾸는 동안 사용자 트리거를 일시 중지해 알림 생성과 `updated_at` 변경을 방지하며, FK 제약 트리거는 계속 검증한다.
- `proc_def`, `configuration`, `form_def`, `tb_bpmn_model`의 테넌트별 자연키 충돌은 변경 전에 차단한다.
- 대상 테넌트가 없으면 트랜잭션 안에서 생성하며, 이미 있으면 기존 테넌트 정보를 보존한다.
- 설치되지 않은 선택 테이블은 오류 대신 `skipped`로 결과에 표시한다.
- 적용 후 같은 명령을 다시 실행해도 원본 테넌트에 남은 대상 행이 없으므로 변경 건수는 0이다.

운영 반영 전에는 DB 스냅샷 또는 백업을 별도로 확보한다.
