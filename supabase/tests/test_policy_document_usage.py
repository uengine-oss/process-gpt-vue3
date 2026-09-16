"""Run migration/backfill and usage regressions in one rolled-back local transaction.

python3 supabase/tests/test_policy_document_usage.py
Requires the project's running local Supabase (no remote database is modified).
"""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
migration = (root / 'supabase/migrations/20260909000001_policy_document_usage.sql').read_text()
metadata_migration = (root / 'supabase/migrations/20260909000002_policy_document_file_metadata.sql').read_text()
regressions = (root / 'supabase/tests/policy_document_usage.sql').read_text()
regressions = regressions.replace('BEGIN;\n', '', 1).rsplit('ROLLBACK;', 1)[0]

# Recreate only this feature inside a transaction so the complete migration is
# exercised whether or not it has already been installed locally.
setup = '''BEGIN;
DROP TRIGGER IF EXISTS audit_policy_fill_file_size ON public.audit_policy;
DROP TRIGGER IF EXISTS proc_def_policy_documents ON public.proc_def;
DROP TRIGGER IF EXISTS audit_policy_protect_usage ON public.audit_policy;
DROP TABLE IF EXISTS public.policy_document_usage;
DROP POLICY IF EXISTS audit_policy_tenant_guard ON public.audit_policy;
DROP FUNCTION IF EXISTS public.protect_used_policy_document();
DO $$ DECLARE tenant text; BEGIN
    SELECT id INTO tenant FROM public.tenants LIMIT 1;
    INSERT INTO storage.objects(bucket_id, name, metadata) VALUES
        ('files', 'data-objects/__backfill_test.pdf', '{"size":19372}'::jsonb);
    INSERT INTO public.proc_def(id, name, tenant_id, bpmn) VALUES ('__policy_backfill_test', '기존 첨부', tenant,
        '<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:u="http://uengine"><b:process id="P"><b:dataObjectReference id="D"><b:extensionElements><u:properties json="{&quot;dataAttachmentFile&quot;:{&quot;path&quot;:&quot;data-objects/__backfill_test.pdf&quot;,&quot;fileName&quot;:&quot;기존 파일.pdf&quot;}}"/></b:extensionElements></b:dataObjectReference></b:process></b:definitions>');
END $$;
'''
backfill_assertion = '''
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM public.policy_document_usage WHERE process_id = '__policy_backfill_test') = 1,
        'Migration backfills existing diagrams without manual resaving';
    ASSERT (SELECT count(*) FROM public.audit_policy WHERE file_path = 'data-objects/__backfill_test.pdf') = 1,
        'Migration registers existing uploaded files';
    ASSERT (SELECT file_size_bytes FROM public.audit_policy WHERE file_path = 'data-objects/__backfill_test.pdf') = 19372,
        'Legacy size recovered from storage metadata';
    RAISE NOTICE 'PASS: complete migration and existing file/size backfill';
END $$;
'''
subprocess.run(
    ['docker', 'exec', '-i', 'supabase_db_process-gpt-vue3', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    input=setup + migration + metadata_migration + backfill_assertion + regressions + 'ROLLBACK;', text=True, check=True,
)
