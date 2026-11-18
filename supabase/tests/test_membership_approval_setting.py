"""가입 승인 설정(20261119000001)을 실제 PostgreSQL 에서 켬·끔 두 경우로 확인한다. 모두 되돌린다.

    PGHOST=… PGPORT=… PGUSER=postgres PGPASSWORD=… PGDATABASE=postgres \
        python3 supabase/tests/test_membership_approval_setting.py [--bundle <운영 묶음 SQL>]

이주가 아직 없으면 20260908000001 → 20261119000001 → (Vault 가 있으면) 20261111000001 을 한 트랜잭션 안에서
적용하고 끝에 ROLLBACK 한다. --bundle 을 주면 운영 묶음(BEGIN; … COMMIT; 사이)을 대신 적용한다.
시험 중 모든 공개 테이블에 정책을 만들므로 그 짧은 동안 잠금이 걸린다(lock_timeout 5초).
"""
import json
import re
import sys
import uuid
from pathlib import Path

import psycopg2

MIGRATIONS = Path(__file__).parents[1] / 'migrations'
APPROVALS = MIGRATIONS / '20260908000001_membership_approvals.sql'
SETTING = MIGRATIONS / '20261119000001_membership_approval_setting.sql'
CLI_KEYS = MIGRATIONS / '20261111000001_cli_agent_credentials.sql'
GATED = ['todolist', 'proc_def', 'bpm_proc_inst', 'chat_rooms', 'notifications', 'form_def']

results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('  ok   ' if cond else '  FAIL ') + name + (f'  ({detail})' if detail and not cond else ''))


def main():
    bundle = sys.argv[sys.argv.index('--bundle') + 1] if '--bundle' in sys.argv else None
    conn = psycopg2.connect('')
    conn.autocommit = False
    q = conn.cursor()

    def one(sql, params=()):
        q.execute(sql, params)
        return q.fetchone()[0]

    def as_user(uid, tenant):
        q.execute('RESET ROLE')
        q.execute("SELECT set_config('request.jwt.claims', %s, true)",
                  (json.dumps({'sub': uid, 'role': 'authenticated', 'app_metadata': {'tenant_id': tenant}}),))
        q.execute('SET LOCAL ROLE authenticated')

    def privileged():
        q.execute('RESET ROLE')
        q.execute("SELECT set_config('request.jwt.claims', '{}', true)")

    def error_code(sql, params=()):
        q.execute('SAVEPOINT probe')
        try:
            q.execute(sql, params)
        except psycopg2.Error as exc:
            q.execute('ROLLBACK TO SAVEPOINT probe')
            return exc.pgcode
        q.execute('RELEASE SAVEPOINT probe')
        return None

    def visible(uid, tenant):
        as_user(uid, tenant)
        counts = {}
        for t in GATED:
            if one('SELECT to_regclass(%s) IS NOT NULL', (f'public.{t}',)):
                counts[t] = one(f'SELECT count(*) FROM public.{t}')
        counts['users'] = one('SELECT count(*) FROM public.users')
        privileged()
        return counts

    def gates():
        q.execute("""SELECT COALESCE(qual, with_check) FROM pg_policies WHERE schemaname='public'
                     AND policyname IN ('membership_access_gate', 'users_membership_read_gate')""")
        return {r[0] for r in q.fetchall()}

    def self_update(uid, tenant):
        as_user(uid, tenant)
        q.execute('SAVEPOINT self')
        try:
            q.execute('UPDATE public.users SET username = username WHERE id=%s AND tenant_id=%s', (uid, tenant))
            n = q.rowcount
            q.execute('RELEASE SAVEPOINT self')
        except psycopg2.Error as exc:
            q.execute('ROLLBACK TO SAVEPOINT self')
            n = f'{exc.pgcode} {exc.pgerror.strip()[:120]}'
        privileged()
        return n

    try:
        q.execute("SET LOCAL lock_timeout = '5s'")
        # 실제 데이터가 있는 회원 하나: 승인 기능을 넣기 전에 무엇이 보였는지 적어 둔다.
        q.execute("""SELECT u.id::text, u.tenant_id FROM public.users u
                     WHERE NOT COALESCE(u.is_agent, false)
                     ORDER BY (SELECT count(*) FROM public.users x WHERE x.tenant_id = u.tenant_id) DESC LIMIT 1""")
        real_uid, real_tenant = q.fetchone()
        before = visible(real_uid, real_tenant)
        role_before = None
        as_user(real_uid, real_tenant)
        role_before = one('SELECT public.current_user_role()')
        privileged()

        if bundle:
            text = Path(bundle).read_text()
            body = re.split(r'^BEGIN;$', text, maxsplit=1, flags=re.M)[1]
            body = re.split(r'^COMMIT;$', body, maxsplit=1, flags=re.M)[0]
            q.execute(body)
            print(f'applied bundle {bundle}')
        else:
            if one("SELECT to_regprocedure('public.membership_admin()') IS NULL"):
                # 승인 기능보다 먼저 있던 같은 이름의 테이블(예전 모양)은 운영 묶음처럼 이름을 바꿔 둔다
                for t in ('signup_requests', 'admin_requests'):
                    if one('SELECT to_regclass(%s) IS NOT NULL', (f'public.{t}',)):
                        q.execute('SELECT ic.relname FROM pg_index x JOIN pg_class ic ON ic.oid = x.indexrelid WHERE x.indrelid = %s::regclass', (f'public.{t}',))
                        for (ix,) in q.fetchall():
                            q.execute(f'ALTER INDEX public."{ix}" RENAME TO "before_approval_{ix}"')
                        q.execute(f'ALTER TABLE public.{t} RENAME TO {t}_before_approval')
                q.execute(APPROVALS.read_text())
            q.execute(SETTING.read_text())
            if one("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault')") \
                    and one("SELECT to_regclass('public.cli_agent_credentials') IS NULL"):
                q.execute(CLI_KEYS.read_text())
            q.execute('UPDATE public.membership_settings SET require_approval = false')
            print('applied migrations, approval off')

        # ---------------- 끔 (데모 서버) ----------------
        print('[off]')
        check('setting is off', one('SELECT public.membership_require_approval()') is False)
        check('existing users stay approved', one("SELECT count(*) FROM public.users WHERE membership_status <> 'approved'") == 0)
        after = visible(real_uid, real_tenant)
        check('a real member sees the same rows as before', before == after, f'{before} -> {after}')
        as_user(real_uid, real_tenant)
        check('current_user_role() same as before', one('SELECT public.current_user_role()') == role_before,
              f"{role_before} -> {one('SELECT public.current_user_role()')}")
        privileged()

        tenant, own_tenant = 'appr-test-' + uuid.uuid4().hex[:6], 'appr-own-' + uuid.uuid4().hex[:6]
        admin, member, newbie, owner, late = [str(uuid.uuid4()) for _ in range(5)]
        q.execute('INSERT INTO public.tenants (id, owner) VALUES (%s, NULL), (%s, %s)', (tenant, own_tenant, owner))

        def add_user(uid, tid, role, is_admin):
            q.execute('INSERT INTO public.users (id, tenant_id, username, email, role, is_admin) VALUES (%s,%s,%s,%s,%s,%s)',
                      (uid, tid, 'approval test', f'{uid}@approval-test.invalid', role, is_admin))
            return one('SELECT membership_status || \'/\' || role || \'/\' || is_admin::text FROM public.users WHERE id=%s AND tenant_id=%s', (uid, tid))

        check('new member: approved, role kept', add_user(member, tenant, 'editor', False) == 'approved/editor/false')
        check('new admin: approved, admin kept', add_user(admin, tenant, 'admin', True) == 'approved/admin/true')
        check('no signup request queued', one('SELECT count(*) FROM public.signup_requests WHERE tenant_id=%s', (tenant,)) == 0)
        q.execute("INSERT INTO public.signup_requests (user_id, tenant_id, username, email, status) VALUES (%s,%s,'x',%s,'pending')",
                  (member, tenant, f'{member}@approval-test.invalid'))
        check('a pending signup request is closed at once',
              one("SELECT status || '/' || reviewed_by FROM public.signup_requests WHERE user_id=%s", (member,)) == 'approved/system:approval-off')
        as_user(member, tenant)
        m = one('SELECT public.my_membership()')
        check('my_membership approved, approval_required false', m['status'] == 'approved' and m['approval_required'] is False, m)
        check('member is a member, not an admin', one('SELECT public.membership_approved()') and not one('SELECT public.membership_admin()'))
        check('member role as before approvals', one('SELECT public.current_user_role()') == one('SELECT public.current_user_role_before_approval()'))
        as_user(str(uuid.uuid4()), tenant)
        check('stranger is not a member', not one('SELECT public.membership_approved()'))
        privileged()
        check('gates are open (true) while off', gates() == {'true'}, gates())
        check('a real member can edit their own row while off', self_update(real_uid, real_tenant) == 1)
        as_user(admin, tenant)
        check('admin is membership_admin', one('SELECT public.membership_admin()') is True)
        if one("SELECT to_regprocedure('public.cli_agent_credential_set(text,text)') IS NOT NULL"):
            q.execute("SELECT public.cli_agent_credential_set('anthropic', %s)", ('sk-ant-approval-test-0000' + 'Z9q1',))
            q.execute('SELECT * FROM public.cli_agent_credential_status()')
            cols = [d[0] for d in q.description]
            rows = [dict(zip(cols, r)) for r in q.fetchall()]
            anth = next((r for r in rows if r.get('provider') == 'anthropic'), {})
            check('admin sets the company CLI key; status shows last4', anth.get('last4') == 'Z9q1', anth)
            as_user(member, tenant)
            check('member cannot set the CLI key', error_code("SELECT public.cli_agent_credential_set('anthropic','sk-x-1234567890')") == '42501')
        privileged()

        # ---------------- 켬 (설치형) ----------------
        print('[on]')
        q.execute('UPDATE public.membership_settings SET require_approval = true')
        check('new person: pending viewer', add_user(newbie, tenant, 'admin', True) == 'pending/viewer/false')
        check('signup request queued', one("SELECT count(*) FROM public.signup_requests WHERE tenant_id=%s AND status='pending'", (tenant,)) == 1)
        as_user(newbie, tenant)
        m = one('SELECT public.my_membership()')
        check('my_membership pending, approval_required true', m['status'] == 'pending' and m['approval_required'] is True, m)
        check('pending is not an approved member', one('SELECT public.membership_approved()') is False)
        check('pending has no role', one('SELECT public.current_user_role()') == '')
        code = error_code("UPDATE public.users SET role='admin', is_admin=true WHERE id=%s AND tenant_id=%s", (newbie, tenant))
        privileged()
        now = one("SELECT role || '/' || is_admin::text FROM public.users WHERE id=%s AND tenant_id=%s", (newbie, tenant))
        check('pending cannot make itself admin', code == '42501' and now == 'viewer/false', f'{code} {now}')
        check('pending can still edit its own name', self_update(newbie, tenant) == 1)
        check('an approved member can edit their own row while on', self_update(real_uid, real_tenant) == 1)
        check('gates use membership_approved() while on', all('membership_approved()' in g for g in gates()), gates())
        pending_uid = str(uuid.uuid4())
        add_user(pending_uid, real_tenant, 'editor', False)
        seen = visible(pending_uid, real_tenant)
        check('pending person in a real tenant sees no company rows',
              all(v == 0 for k, v in seen.items() if k != 'users') and seen['users'] <= 1, seen)
        check('tenant owner: approved with its role', add_user(owner, own_tenant, 'superAdmin', True) == 'approved/superAdmin/true')
        as_user(admin, tenant)
        check('admin role under approvals', one('SELECT public.current_user_role()') == 'admin')
        counts = one('SELECT public.membership_request_counts()')
        check('admin sees one signup waiting', counts['signup'] == 1, counts)
        rid = one("SELECT id::text FROM public.signup_requests WHERE tenant_id=%s AND user_id=%s", (tenant, newbie))
        q.execute("SELECT public.review_membership_request('signup', %s, 'approved', '', 'editor')", (rid,))
        privileged()
        check('approved by admin', one('SELECT membership_status || \'/\' || role FROM public.users WHERE id=%s AND tenant_id=%s', (newbie, tenant)) == 'approved/editor')

        # ---------------- 다시 끔: 대기 중이던 사람 ----------------
        print('[on -> off]')
        check('late person pending', add_user(late, tenant, 'editor', False) == 'pending/viewer/false')
        q.execute('UPDATE public.membership_settings SET require_approval = false')
        check('turning off approves waiting people',
              one('SELECT membership_status FROM public.users WHERE id=%s AND tenant_id=%s', (late, tenant)) == 'approved')
        check('their request is closed',
              one('SELECT status || \'/\' || reviewed_by FROM public.signup_requests WHERE user_id=%s', (late,)) == 'approved/system:approval-off')

        # ---------------- 다시 실행 ----------------
        print('[rerun]')
        q.execute('SAVEPOINT rerun')
        q.execute(SETTING.read_text())
        q.execute('RELEASE SAVEPOINT rerun')
        qual = one("SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_membership_read_gate'")
        check('read gate has no subquery', 'SELECT' not in qual.upper(), qual)
        check('gates still open after rerun', gates() == {'true'}, gates())
        check('setting still off after rerun', one('SELECT public.membership_require_approval()') is False)
    finally:
        conn.rollback()
        conn.close()

    failed = [r for r in results if not r[1]]
    print(f'{len(results) - len(failed)} passed, {len(failed)} failed (rolled back)')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
