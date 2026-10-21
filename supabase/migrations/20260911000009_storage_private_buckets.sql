-- ============================================================================
-- Storage 버킷 비공개 전환 + 테넌트/역할 기준 RLS (files, chat-images)
--
-- [목표] 보안 확인표 항목 8(파일 다운로드 통제) / 9(업로드 파일 형식·크기 제한)
--        docs/security.md "3-1. files 버킷 비공개 전환"
--
-- ⚠️ [배포 주의] 이 마이그레이션은 **3-2 서명 URL 전환과 반드시 함께 배포해야 한다.**
--    버킷이 private 이 되는 순간 `getPublicUrl()` 로 만든 URL 은 전부 400 을 반환한다.
--    (`/storage/v1/object/public/...` 는 public 버킷에서만 동작)
--    현재 레포에 createSignedUrl 사용처는 0건이고, getPublicUrl 은 아래 4곳뿐이다.
--    이 4곳만 고치면 파생 사용처(아래 ②)는 함께 살아난다.
--      ① getPublicUrl 원천 4곳
--         · src/utils/StorageBaseSupabase.js:1477  getImageUrl   (chat-images)
--         · src/utils/StorageBaseSupabase.js:1522  getFileUrl    (files)
--         · src/utils/StorageBaseSupabase.js:1536  downloadFile  (files, public URL 을 fetch)
--         · src/components/ui/SchemaFieldInput.vue:787  업로드 후 publicUrl 을 폼 데이터에 저장
--      ② 그 URL 소비처(표시/다운로드가 깨지는 화면)
--         · src/views/policy-document/PolicyDocumentManager.vue, src/services/policyDocumentService.ts
--         · src/views/process-hierarchy/ProcessHierarchyProperties.vue:10916,10939 (window.open)
--         · .../panel/GPTUserTaskPanel.vue:839, PALUserTaskPanel.vue:326
--         · src/components/ui/Chat.vue (첨부 칩 다수), src/components/chat/ChatThread.vue:363
--         · src/views/chat/ChatRoomPage.vue, src/views/markdown/AgentMonitor.vue
--         · src/components/ui/EventTimeline.vue, src/components/apps/todolist/FormWorkItem.vue
--         · mobile/src/lib/attachments.js, mobile/src/lib/agentChat.js, mobile/src/lib/download.js
--      ③ .download() 호출부는 서명 URL 없이도 계속 동작한다(인증 세션으로 내려받음).
--         PolicyDocumentManager.vue:448,531 / SchemaFieldInput.vue:808
--    이미 DB/폼 데이터에 절대 public URL 이 저장돼 있는 건도 3-2 에서 "경로만 저장 +
--    표시 시점에 서명 URL 생성" 으로 정리한다.
--
-- [설계 요약]
--   1) files / chat-images 를 public = false 로 전환.
--   2) 버킷 단위 서버측 제한: file_size_limit + allowed_mime_types.
--      · files       50MB / 업무 문서·이미지·텍스트·압축 (supabase/config.toml 의
--                    전역 storage file_size_limit = 50MiB 과 동일하게 맞춤)
--      · chat-images 10MB / 래스터 이미지 전용
--   3) MIME 화이트리스트만으로는 부족하다. .hwp / .bpmn / .zip / .skill 같은 파일은
--      브라우저가 Content-Type 을 application/octet-stream(또는 빈 값)으로 보내므로
--      octet-stream 을 허용할 수밖에 없고, 그러면 .exe 도 같이 통과한다.
--      → INSERT 정책에서 **확장자 블랙리스트**(실행파일류)로 그 구멍을 막는다.
--   4) storage.objects RLS 를 테넌트 + 소유자 기준으로 재작성.
--      기존 정책(20260507_audit_policy.sql)은 `bucket_id = 'files'` 만 보고
--      anon 포함 전원에게 SELECT/INSERT/UPDATE/DELETE 를 열어둔 상태였다.
--
-- [테넌트 판별 방식 — 중요]
--   이 레포의 표준은 `public.tenant_id()` (JWT app_metadata.tenant_id) 이고
--   테이블 RLS 는 `tenant_id = public.tenant_id()` 로 비교한다
--   (20260709_process_component_marketplace.sql 등).
--   그런데 storage.objects 에는 tenant_id 컬럼이 없고, **현재 업로드 경로에
--   테넌트가 들어가지 않는다.**
--     · files       : `uploads/<ts>_<uuid8><ext>`  (StorageBaseSupabase.uploadFile)
--     · chat-images : `<fileName>`                 (StorageBaseSupabase.uploadImage)
--   그래서 객체의 테넌트를 아래 우선순위로 판정한다.
--     ① 경로 첫 세그먼트가 실제 tenants.id 이면 그 테넌트  (앞으로의 권장 경로 형식)
--     ② 아니면 업로더(owner)의 users.tenant_id
--     ③ 둘 다 없으면(레거시 객체 / owner 유실) 현재 테넌트로 간주해 통과
--   ③ 때문에 "소유자를 알 수 없는 기존 객체"는 여전히 테넌트 간 열람이 가능하다.
--   이를 완전히 닫으려면 업로드 경로를 `<tenant_id>/uploads/...` 로 바꾸고
--   기존 객체를 이관해야 한다(후속 과제, 아래 [TODO] 참고).
--
-- [알려진 동작 변화 — 3-2 / QA 체크리스트]
--   ① 익명(anon) 접근 전면 차단. 기존 정책은 role 제한이 없어 로그인 없이도
--      files 버킷에 업로드/삭제가 가능했다.
--   ② 남의 파일 덮어쓰기 차단. SchemaFieldInput.vue:784 는 name_strategy='original'
--      일 때 upsert:true 로 올린다. 이제 같은 경로의 기존 객체는 업로더 본인이나
--      관리자만 덮어쓸 수 있다(다른 사용자는 409/403).
--   ③ 커스텀 버킷 미지원. SchemaFieldInput.vue:770 / PropertySchemaStudio 의
--      file_bucket 은 자유 입력이라 'files' 외의 값을 넣을 수 있는데, 그런 버킷은
--      정책이 없어 전면 차단된다(원래도 'files' 전용 정책뿐이라 동작하지 않았다).
--      커스텀 버킷을 살리려면 4번 정책의 bucket_id IN (...) 에 추가할 것.
--   ④ process-components 버킷은 이 마이그레이션의 범위 밖이다(이미 private).
--      단, 그쪽 정책도 테넌트 스코프가 없어 별도 과제로 남는다.
--
-- [재실행 안전] 모든 구문이 idempotent (DROP POLICY IF EXISTS / ON CONFLICT /
--   CREATE OR REPLACE). 이미 적용된 DB 에서도 그대로 통과한다.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 버킷 보장 + 비공개 전환 + 서버측 형식/크기 제한
-- ---------------------------------------------------------------------------
-- files 는 20260507_audit_policy.sql 이 public=true 로 만들어 둔 상태.
-- chat-images 는 마이그레이션 없이 대시보드로만 만들어져 있어 여기서 함께 보장한다.
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false), ('chat-images', 'chat-images', false)
ON CONFLICT (id) DO NOTHING;

-- files: 업무 문서 중심.
--   확장자 근거(프론트 accept 속성 전수 조사):
--     · InstanceSource.vue / PolicyDocumentManager  : pdf doc docx hwp hwpx txt csv
--                                                     xls xlsx ppt pptx 이미지류
--     · KnowledgeFilesTab.vue roleAllowedExtensions : pdf hwp hwpx doc docx pptx txt csv xlsx
--     · Chat.vue 첨부                                : 위 + json md yaml xml html js ts py
--                                                     java go rs sql sh ini toml log zip
--     · BPMN import / 스킬·컴포넌트 zip              : bpmn xml zip skill  → octet-stream 경유
--   ※ text/html, image/svg+xml 은 Chat 첨부 accept 에 있어 유지한다. 비공개 버킷 +
--     서명 URL 이므로 앱 오리진이 아닌 스토리지 오리진에서 렌더되지만, 3-3 에서
--     다운로드 강제(Content-Disposition) 를 검토할 것.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 52428800,           -- 50MB
    allowed_mime_types = ARRAY[
        -- 문서
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
        'application/rtf',
        -- 한글(HWP/HWPX) — 브라우저마다 보내는 값이 달라 알려진 변형을 모두 허용
        'application/x-hwp',
        'application/haansofthwp',
        'application/vnd.hancom.hwp',
        'application/vnd.hancom.hwpx',
        'application/hwp',
        -- 텍스트/데이터
        'text/plain',
        'text/csv',
        'text/markdown',
        'text/html',
        'text/xml',
        'text/yaml',
        'text/x-yaml',
        'text/javascript',
        'text/x-python',
        'text/x-java-source',
        'text/x-sql',
        'application/json',
        'application/xml',
        'application/javascript',
        'application/x-yaml',
        'application/x-sh',
        -- 이미지
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/x-ms-bmp',
        'image/tiff',
        'image/svg+xml',
        -- 압축
        'application/zip',
        'application/x-zip-compressed',
        'application/gzip',
        'application/x-gzip',
        -- 확장자를 Content-Type 으로 표현하지 못하는 파일(.hwp/.bpmn/.zip/.skill 등).
        -- 이 항목 때문에 생기는 구멍은 아래 3번 확장자 블랙리스트로 막는다.
        'application/octet-stream'
    ]
WHERE id = 'files';

-- chat-images: 채팅 첨부 "이미지" 전용.
--   · 데스크톱 Chat.vue:6752 / 모바일 attachments.js:195 모두 isImage(file) 인 건만
--     이 버킷으로 올리고, 이미지가 아닌 첨부는 memento(/save-to-storage) 로 간다.
--     따라서 이미지 MIME 만 허용해도 기능이 깨지지 않는다.
--   · 크기 10MB — 모바일 첨부 상한(attachments.js MAX_BYTES = 25MB)보다 낮지만
--     이미지 한 장 기준으로는 충분하고, 문서는 애초에 이 버킷에 오지 않는다.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,           -- 10MB
    allowed_mime_types = ARRAY[
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/x-ms-bmp',
        'image/tiff',
        'image/heic',
        'image/heif',
        'image/svg+xml'   -- accept="image/*" 라 선택 가능. <img> 렌더라 스크립트는 실행 안 됨
    ]
WHERE id = 'chat-images';

-- ---------------------------------------------------------------------------
-- 2. 헬퍼 함수 — 객체의 테넌트 판정 / 위험 확장자 판정
--    RLS 조건 안에서 행마다 호출되므로 STABLE 로 선언(플랜 캐싱).
--    SECURITY DEFINER: 대상 테이블(tenants, users)의 RLS 에 좌우되지 않게 한다.
--    (20260403000001_role_based_rls.sql 의 current_user_role() 과 같은 방식)
-- ---------------------------------------------------------------------------

-- (2-1) 경로 첫 세그먼트가 실제 테넌트면 그 값을 반환. 아니면 NULL.
--       앞으로 업로드 경로를 `<tenant_id>/...` 로 바꾸면 자동으로 강한 격리가 걸린다.
CREATE OR REPLACE FUNCTION public.storage_path_tenant(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id
  FROM public.tenants t
  WHERE p_name IS NOT NULL
    AND position('/' IN p_name) > 0
    AND t.id = split_part(p_name, '/', 1)
  LIMIT 1;
$$;

-- (2-2) 업로더(storage.objects.owner = auth.uid())의 테넌트.
CREATE OR REPLACE FUNCTION public.storage_owner_tenant(p_owner uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.tenant_id
  FROM public.users u
  WHERE p_owner IS NOT NULL
    AND u.id = p_owner
  ORDER BY (u.tenant_id = public.tenant_id()) DESC   -- 다중 테넌트 소속이면 현재 테넌트 우선
  LIMIT 1;
$$;

-- (2-3) 객체가 현재 요청자의 테넌트에 속하는가.
--       경로 테넌트 > 업로더 테넌트 > (판정 불가 시) 현재 테넌트 순으로 결정.
CREATE OR REPLACE FUNCTION public.storage_object_in_tenant(p_name text, p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.tenant_id() IS NOT NULL
     AND COALESCE(
           public.storage_path_tenant(p_name),
           public.storage_owner_tenant(p_owner),
           public.tenant_id()
         ) = public.tenant_id();
$$;

-- (2-4) 실행파일류 확장자 차단.
--       allowed_mime_types 에 application/octet-stream 을 넣어야만 .hwp/.bpmn/.zip
--       업로드가 되는데, 그 틈으로 실행파일이 들어오는 것을 막는 2차 방어선.
--       ※ 여기 목록의 확장자는 프론트 어느 accept 속성에도 없다(기능 영향 없음).
CREATE OR REPLACE FUNCTION public.storage_has_blocked_extension(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(COALESCE(p_name, ''), '^.*\.', '')) IN (
    'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'msp', 'dll', 'sys',
    'vbs', 'vbe', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'hta', 'cpl', 'reg',
    'lnk', 'scf', 'inf', 'jar', 'apk', 'dmg', 'iso', 'deb', 'rpm'
  ) AND p_name ~ '\.';
$$;

COMMENT ON FUNCTION public.storage_path_tenant(text) IS
  '스토리지 객체 경로의 첫 세그먼트가 tenants.id 면 그 값을 반환 (아니면 NULL)';
COMMENT ON FUNCTION public.storage_owner_tenant(uuid) IS
  '스토리지 객체 업로더(owner)의 users.tenant_id 반환';
COMMENT ON FUNCTION public.storage_object_in_tenant(text, uuid) IS
  '스토리지 객체가 현재 요청자의 테넌트 소속인지 판정 (경로 > 업로더 > 레거시 허용)';
COMMENT ON FUNCTION public.storage_has_blocked_extension(text) IS
  '실행파일류 확장자 여부 — octet-stream 허용으로 생기는 MIME 우회를 막는다';

-- ---------------------------------------------------------------------------
-- 3. 기존 public 정책 제거
-- ---------------------------------------------------------------------------
-- (3-1) 20260507_audit_policy.sql 이 만든 전면 개방 정책
DROP POLICY IF EXISTS "files_bucket_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "files_bucket_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "files_bucket_public_update" ON storage.objects;
DROP POLICY IF EXISTS "files_bucket_public_delete" ON storage.objects;

-- (3-2) 대시보드에서 손으로 만든 정책은 이름을 알 수 없다(“Public Access”, “Give
--       anon users access …” 등). files / chat-images 를 언급하는 잔여 정책을
--       이름과 무관하게 걷어낸다. 아래 5번에서 만드는 정책(pgs_storage_*)과
--       다른 버킷(process-components 등)은 건드리지 않는다.
DO $$
DECLARE p record;
BEGIN
    FOR p IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname NOT LIKE 'pgs\_storage\_%'
          AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~ '''(files|chat-images)'''
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
        RAISE NOTICE 'dropped legacy storage policy: %', p.policyname;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. 새 정책 (files, chat-images 공통)
--    · SELECT : 인증 사용자 + 자기 테넌트 객체
--    · INSERT : 인증 사용자 + 자기 테넌트 경로 + 본인 소유 + 허용 확장자
--    · UPDATE : 업로더 본인 또는 관리자 (upsert / 메타데이터 갱신용)
--    · DELETE : 업로더 본인 또는 관리자
--    · anon   : 정책 없음 = 전면 차단
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pgs_storage_select_tenant"      ON storage.objects;
DROP POLICY IF EXISTS "pgs_storage_insert_tenant"      ON storage.objects;
DROP POLICY IF EXISTS "pgs_storage_update_own_admin"   ON storage.objects;
DROP POLICY IF EXISTS "pgs_storage_delete_own_admin"   ON storage.objects;

-- (4-1) SELECT — 같은 테넌트의 인증 사용자만.
CREATE POLICY "pgs_storage_select_tenant" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id IN ('files', 'chat-images')
        AND public.storage_object_in_tenant(name, owner)
    );

-- (4-2) INSERT — 자기 테넌트 경로에만, 본인 소유로, 허용 확장자만.
--       owner 는 storage-api 가 JWT sub 로 채운다. NULL 로 들어오는 경로(구버전
--       storage-api)도 있어 IS NULL 을 함께 허용한다.
CREATE POLICY "pgs_storage_insert_tenant" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('files', 'chat-images')
        AND public.tenant_id() IS NOT NULL
        AND COALESCE(public.storage_path_tenant(name), public.tenant_id()) = public.tenant_id()
        AND (owner IS NULL OR owner = auth.uid())
        AND NOT public.storage_has_blocked_extension(name)
    );

-- (4-3) UPDATE — 업로더 본인 또는 관리자. (upsert, 메타데이터 갱신)
--       관리자 판정은 레포 표준 헬퍼 + users 직접 조회 OR
--       (20260911000001_auth_audit_log.sql 과 동일한 이중 판정)
CREATE POLICY "pgs_storage_update_own_admin" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id IN ('files', 'chat-images')
        AND public.storage_object_in_tenant(name, owner)
        AND (
            owner = auth.uid()
            OR owner IS NULL
            OR public.current_user_role() IN ('admin', 'superadmin')
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = auth.uid()
                  AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
            )
        )
    )
    WITH CHECK (
        bucket_id IN ('files', 'chat-images')
        AND COALESCE(public.storage_path_tenant(name), public.tenant_id()) = public.tenant_id()
        AND NOT public.storage_has_blocked_extension(name)
    );

-- (4-4) DELETE — 업로더 본인 또는 관리자.
CREATE POLICY "pgs_storage_delete_own_admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id IN ('files', 'chat-images')
        AND public.storage_object_in_tenant(name, owner)
        AND (
            owner = auth.uid()
            OR public.current_user_role() IN ('admin', 'superadmin')
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = auth.uid()
                  AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
            )
        )
    );

-- ---------------------------------------------------------------------------
-- 5. 버킷 목록 조회
--    storage.buckets 에는 지금까지 정책이 하나도 없었다(= RLS 기본 차단).
--    supabase-js 의 storage.from(...).list()/upload() 는 버킷 메타데이터를
--    service_role 로 읽으므로 정책 없이도 동작한다. 여기서도 열지 않는다.
--    (listBuckets() 를 쓰는 화면이 생기면 그때 SELECT 정책을 추가할 것)
-- ---------------------------------------------------------------------------

COMMIT;

-- ============================================================================
-- [TODO — 후속]
--   · 3-2 서명 URL 전환: getPublicUrl → createSignedUrl(만료시간).
--     이 마이그레이션과 같은 배포에 포함되어야 한다.
--   · 업로드 경로를 `<tenant_id>/uploads/...` 로 변경 + 기존 객체 이관.
--     그 뒤 storage_object_in_tenant() 의 "판정 불가 시 통과" 폴백(COALESCE 마지막
--     인자)을 제거하면 테넌트 격리가 완전해진다.
--   · 3-3 다운로드 이력(file_download_log) 은 별도 마이그레이션.
--
-- [롤백]
--   UPDATE storage.buckets SET public = true, file_size_limit = NULL,
--          allowed_mime_types = NULL WHERE id IN ('files', 'chat-images');
--   DROP POLICY IF EXISTS "pgs_storage_select_tenant"    ON storage.objects;
--   DROP POLICY IF EXISTS "pgs_storage_insert_tenant"    ON storage.objects;
--   DROP POLICY IF EXISTS "pgs_storage_update_own_admin" ON storage.objects;
--   DROP POLICY IF EXISTS "pgs_storage_delete_own_admin" ON storage.objects;
--   CREATE POLICY "files_bucket_public_read"   ON storage.objects FOR SELECT USING (bucket_id = 'files');
--   CREATE POLICY "files_bucket_public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'files');
--   CREATE POLICY "files_bucket_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'files');
--   CREATE POLICY "files_bucket_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'files');
-- ============================================================================
