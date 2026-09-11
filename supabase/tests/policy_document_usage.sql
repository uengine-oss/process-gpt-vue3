-- Run against a local migrated Supabase database; all fixture changes roll back.
BEGIN;
DO $$
DECLARE tenant text; p uuid; p2 uuid; doc text; metadata jsonb; test_user text;
BEGIN
    SELECT tenant_id, id::text INTO tenant, test_user FROM public.users
        WHERE COALESCE(to_jsonb(users)->>'membership_status', 'approved') = 'approved' LIMIT 1;
    ASSERT tenant IS NOT NULL, 'A test tenant is required';
    metadata := jsonb_build_object('dataAttachmentFile', jsonb_build_object(
        'fileName', '정책 & 지침.pdf', 'path', 'data-objects/policy-regression.pdf', 'size', 42));
    doc := '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:u="http://uengine"><process id="P">'
        || '<dataObjectReference id="D1"><extensionElements><u:properties json="'
        || replace(replace(metadata::text, '&', '&amp;'), '"', '&quot;')
        || '"/></extensionElements></dataObjectReference></process></definitions>';
    ASSERT (SELECT count(*) FROM public.bpmn_policy_attachments(doc)) = 1, 'Attribute JSON decoded';
    INSERT INTO public.proc_def(id, name, tenant_id, bpmn) VALUES ('__policy_test_a', '프로세스 A', tenant, doc);
    SELECT id INTO p FROM public.audit_policy WHERE tenant_id = tenant AND file_path = 'data-objects/policy-regression.pdf';
    ASSERT p IS NOT NULL, 'Legacy upload registered on save';
    ASSERT (SELECT name FROM public.audit_policy WHERE id = p) = '정책 & 지침.pdf', 'Original Unicode name preserved';
    INSERT INTO public.proc_def(id, name, tenant_id, bpmn) VALUES ('__policy_test_b', '프로세스 B', tenant, replace(doc, 'D1', 'D2'));
    ASSERT (SELECT count(*) FROM public.audit_policy WHERE id = p) = 1;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p) = 2, 'One file shared by two processes';
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', test_user, 'role', 'authenticated',
        'app_metadata', jsonb_build_object('tenant_id', tenant))::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p) = 2, 'Authenticated tenant can read usages';
    ASSERT (SELECT count(*) FROM public.audit_policy WHERE id = p) = 1, 'Authenticated tenant can read library';
    BEGIN
        INSERT INTO public.policy_document_usage VALUES (tenant, p, '__policy_test_a', 'forged');
        RAISE EXCEPTION 'Direct usage write unexpectedly allowed' USING ERRCODE = 'ZX001';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', test_user, 'role', 'authenticated',
        'app_metadata', jsonb_build_object('tenant_id', '__other_tenant'))::text, true);
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p) = 0, 'Cross-tenant usages hidden';
    ASSERT (SELECT count(*) FROM public.audit_policy WHERE id = p) = 0, 'Cross-tenant documents hidden';
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '{}', true);
    UPDATE public.proc_def SET bpmn = bpmn WHERE id = '__policy_test_a' AND tenant_id = tenant;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p) = 2, 'Repeated save is idempotent';
    BEGIN
        UPDATE public.audit_policy SET deleted_at = now() WHERE id = p;
        RAISE EXCEPTION 'Unexpectedly deleted used document' USING ERRCODE = 'ZX001';
    EXCEPTION WHEN raise_exception THEN NULL; END;
    INSERT INTO public.audit_policy(tenant_id, name, kind, file_path, file_bucket)
        VALUES (tenant, 'Library document', 'file', 'uploads/policy-regression.pdf', 'private-docs') RETURNING id INTO p2;
    metadata := jsonb_build_object('dataAttachmentFile', jsonb_build_array(
        jsonb_build_object('path', 'data-objects/policy-regression.pdf'),
        jsonb_build_object('path', 'uploads/policy-regression.pdf', 'bucket', 'private-docs', 'policyId', p2)));
    doc := '<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:u="http://uengine"><b:process id="P">'
        || '<b:subProcess id="S"><b:dataObjectReference id="D3"><b:extensionElements><u:properties><u:json><![CDATA['
        || metadata::text || ']]></u:json></u:properties></b:extensionElements></b:dataObjectReference></b:subProcess></b:process></b:definitions>';
    UPDATE public.proc_def SET bpmn = doc WHERE id = '__policy_test_a' AND tenant_id = tenant;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p2) = 1, 'Existing library entry reused, CDATA/array/subprocess supported';
    UPDATE public.proc_def SET bpmn = NULL, definition = jsonb_build_object('tobe_bpmn', doc)
        WHERE id = '__policy_test_a' AND tenant_id = tenant;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p2) = 1, 'Current To-Be attachment tracked';
    UPDATE public.proc_def SET bpmn = doc, definition = '{}'::jsonb WHERE id = '__policy_test_a' AND tenant_id = tenant;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p AND element_id = 'D1') = 0, 'Removed element usage cleared';
    UPDATE public.proc_def SET isdeleted = true WHERE id = '__policy_test_b' AND tenant_id = tenant;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p) = 1, 'Soft deletion clears usages';
    UPDATE public.proc_def SET isdeleted = false WHERE id = '__policy_test_b' AND tenant_id = tenant;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id = p) = 2, 'Restore reindexes usages';
    DELETE FROM public.proc_def WHERE id IN ('__policy_test_a', '__policy_test_b') AND tenant_id = tenant;
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE policy_id IN (p,p2)) = 0, 'Hard deletion cascades usages';
    ASSERT (SELECT count(*) FROM public.audit_policy WHERE id IN (p,p2)) = 2, 'Detaching never deletes shared files';
    UPDATE public.audit_policy SET deleted_at = now() WHERE id = p2;
    BEGIN
        INSERT INTO public.proc_def(id, tenant_id, bpmn) VALUES ('__policy_test_stale', tenant, doc);
        RAISE EXCEPTION 'Stale attachment accepted' USING ERRCODE = 'ZX001';
    EXCEPTION WHEN raise_exception THEN NULL; END;
    RAISE NOTICE 'PASS: registration, reuse, multiple processes, XML formats, detach, delete, restore, stale references';
END;
$$;
DO $$
DECLARE tenant text; doc_id uuid;
BEGIN
    SELECT id INTO tenant FROM public.tenants LIMIT 1;
    INSERT INTO storage.objects(bucket_id, name, metadata) VALUES
        ('files', 'uploads/__zero_size_test.pdf', '{"size":0}'),
        ('files', 'uploads/__fallback_size_test.pdf', '{"size":"invalid","contentLength":73}');
    INSERT INTO public.audit_policy(tenant_id,name,kind,file_path)
        VALUES (tenant,'Empty file','file','uploads/__zero_size_test.pdf') RETURNING id INTO doc_id;
    ASSERT (SELECT file_size_bytes FROM public.audit_policy WHERE id=doc_id) = 0, 'Zero-byte file is not unknown size';
    INSERT INTO public.audit_policy(tenant_id,name,kind,file_path,file_size_bytes)
        VALUES (tenant,'Known size','file','uploads/__fallback_size_test.pdf',9) RETURNING id INTO doc_id;
    ASSERT (SELECT file_size_bytes FROM public.audit_policy WHERE id=doc_id) = 9, 'Existing size preserved';
    UPDATE public.audit_policy SET file_size_bytes=NULL WHERE id=doc_id;
    ASSERT (SELECT file_size_bytes FROM public.audit_policy WHERE id=doc_id) = 73, 'Missing size uses contentLength fallback';
    RAISE NOTICE 'PASS: file size enrichment, zero-byte file, preserved metadata';
END $$;
ROLLBACK;
