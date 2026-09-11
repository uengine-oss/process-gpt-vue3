"""Exercise approval RLS/RPCs against PostgreSQL, rolling back all test accounts.

Run from process-gpt-completion with its venv and .env. The migration is also
rolled back, unless it was applied before this test.
"""
import json
import uuid
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env')
from dashboard_api import _get_conn

MIGRATION = Path(__file__).parents[1] / 'migrations/20260908000001_membership_approvals.sql'


def run():
    conn = _get_conn()
    try:
        with conn.cursor() as q:
            q.execute("SELECT to_regprocedure('public.my_membership()')")
            if q.fetchone()[0] is None:
                q.execute(MIGRATION.read_text())
            q.execute("SELECT id FROM public.tenants WHERE id = 'tym'")
            assert q.fetchone(), 'Run against the local test deployment with the tym tenant'
            admin, applicant, rejected = [str(uuid.uuid4()) for _ in range(3)]

            def identity(uid, tenant='tym'):
                q.execute('RESET ROLE')
                q.execute("SELECT set_config('request.jwt.claims', %s, true)",
                          (json.dumps({'sub': uid, 'role': 'authenticated', 'app_metadata': {'tenant_id': tenant}}),))
                q.execute('SET LOCAL ROLE authenticated')

            def privileged():
                q.execute('RESET ROLE')
                q.execute("SELECT set_config('request.jwt.claims', '{}', true)")

            def blocked(sql, params=(), code='42501'):
                q.execute('SAVEPOINT denied')
                try:
                    q.execute(sql, params)
                except psycopg2.Error as exc:
                    assert exc.pgcode == code, (exc.pgcode, str(exc))
                    q.execute('ROLLBACK TO SAVEPOINT denied')
                else:
                    raise AssertionError('Unexpectedly allowed: ' + sql)
                q.execute('RELEASE SAVEPOINT denied')

            for uid in (admin, applicant, rejected):
                q.execute("INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES (%s,%s,%s,%s)",
                          (uid, f'{uid}@approval-test.invalid', json.dumps({'tenant_id': 'tym'}), json.dumps({'name': 'Approval test', 'tenant_id': 'tym'})))
            q.execute("UPDATE public.users SET membership_status='approved',role='admin',is_admin=true WHERE id=%s", (admin,))
            q.execute("UPDATE public.signup_requests SET status='approved' WHERE user_id=%s", (admin,))
            q.execute("SELECT user_id,id FROM public.signup_requests WHERE user_id IN (%s,%s)", (applicant, rejected))
            signup_ids = dict(q.fetchall())

            identity(applicant)
            q.execute('SELECT public.my_membership()')
            assert q.fetchone()[0]['status'] == 'pending'
            q.execute('SELECT count(*) FROM public.configuration')
            assert q.fetchone()[0] == 0, 'Pending members must not read tenant data'
            blocked("UPDATE public.users SET membership_status='approved',role='admin',is_admin=true WHERE id=%s", (applicant,))
            blocked("SELECT public.request_membership_role('editor','test')")
            blocked('SELECT public.membership_request_counts()')
            blocked("SELECT public.review_membership_request('signup',%s,'approved')", (signup_ids[applicant],))

            identity(admin)
            q.execute("SELECT public.review_membership_request('signup',%s,'approved','','reviewer')", (signup_ids[applicant],))
            blocked("SELECT public.review_membership_request('signup',%s,'approved')", (signup_ids[applicant],), '23505')
            identity(applicant)
            q.execute('SELECT public.my_membership()')
            assert q.fetchone()[0]['role'] == 'reviewer'
            blocked("SELECT public.request_membership_role('superadmin','test')", code='22023')
            q.execute("SELECT public.request_membership_role('editor','Process modeling')")
            request_id = q.fetchone()[0]['id']
            blocked("SELECT public.request_membership_role('owner','duplicate')", code='23505')
            blocked("UPDATE public.users SET role='admin' WHERE id=%s", (applicant,))
            blocked("INSERT INTO public.admin_requests(user_id,tenant_id,email,reason,requested_role) VALUES (%s,'tym','test','test','admin')", (applicant,))

            identity(admin)
            q.execute('SELECT public.membership_request_counts()')
            counts = q.fetchone()[0]
            assert counts['total'] == counts['signup'] + counts['role'] and counts['total'] >= 2
            blocked("SELECT public.review_membership_request('signup',%s,'rejected','')", (signup_ids[rejected],), '22023')
            q.execute("SELECT public.review_membership_request('role',%s,'approved')", (request_id,))
            q.execute("SELECT public.review_membership_request('signup',%s,'rejected','신청 정보 확인 필요')", (signup_ids[rejected],))
            identity(applicant)
            q.execute('SELECT public.my_membership()')
            assert q.fetchone()[0]['role'] == 'editor'
            identity(rejected)
            q.execute('SELECT public.my_membership()')
            assert q.fetchone()[0]['status'] == 'rejected'
            q.execute('SELECT count(*) FROM public.admin_requests')
            assert q.fetchone()[0] == 0

            # Same identity cannot borrow another tenant's administrator privileges.
            identity(admin, 'unrelated-approval-test')
            blocked('SELECT public.membership_request_counts()')
            q.execute('SELECT count(*) FROM public.signup_requests')
            assert q.fetchone()[0] == 0

            # Normal profile upserts preserve previously approved memberships.
            privileged()
            q.execute("INSERT INTO public.users(id,tenant_id,email,role,is_admin) VALUES (%s,'tym','updated@test.invalid','editor',false) ON CONFLICT (id,tenant_id) DO UPDATE SET role=excluded.role,email=excluded.email", (applicant,))
            identity(applicant)
            q.execute('SELECT public.my_membership()')
            assert q.fetchone()[0]['role'] == 'editor'
            print('PASS: signup queue, pending/rejected isolation, role approval, rejection reasons, duplicate decisions, combined counts, tenant isolation, profile upsert')
    finally:
        conn.rollback()
        conn.close()


if __name__ == '__main__':
    run()
