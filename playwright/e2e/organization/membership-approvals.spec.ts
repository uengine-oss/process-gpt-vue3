import { test, expect } from '@playwright/test';

const base = process.env.MEMBERSHIP_TEST_URL || 'http://127.0.0.1:5173';
const fixture = `${base}/playwright/fixtures/membership-approvals.html`;
const roleRow = { id: 'role1', user_id: 'applicant', username: '권한 신청자', email: 'role@example.test', requested_role: 'editor', reason: '모델링 작업', status: 'pending', created_at: '2026-09-08T00:00:00Z' };
const signupRow = { id: 'signup1', user_id: 'new-member', username: '가입 신청자', email: 'signup@example.test', status: 'pending', created_at: '2026-09-08T00:00:00Z' };

test('role submission records a request and disables duplicate submission', async ({ page }) => {
    let submitted: any = null;
    await page.route('**/__membership-test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/my_membership')) return route.fulfill({ json: { status: 'approved', role: 'viewer', tenant_id: 'tym' } });
        if (path.endsWith('/request_membership_role')) {
            submitted = route.request().postDataJSON();
            return route.fulfill({ json: { ...roleRow, requested_role: submitted.requested_role } });
        }
        return route.fulfill({ json: submitted ? [{ ...roleRow, requested_role: submitted.requested_role }] : [] });
    });
    await page.goto(`${fixture}?view=role`);
    await page.getByLabel('신청 사유').fill('프로세스 검토가 필요합니다.');
    await page.getByRole('button', { name: '권한 변경 신청', exact: true }).click();
    await expect(page.getByText('권한 변경 신청이 접수되었습니다. 관리자 승인 후 적용됩니다.')).toBeVisible();
    expect(submitted).toEqual({ requested_role: 'reviewer', reason: '프로세스 검토가 필요합니다.' });
    await expect(page.getByRole('button', { name: '권한 변경 신청', exact: true })).toBeDisabled();
    await expect(page.getByText('현재 권한: 뷰어 · 승인 전까지 현재 권한이 유지됩니다.')).toBeVisible();
});

test('organization approval panel approves roles and rejects signups with a reason', async ({ page }) => {
    let rolePending = true, signupPending = true;
    const decisions: any[] = [];
    await page.route('**/__membership-test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/membership_request_counts')) return route.fulfill({ json: { role: +rolePending, signup: +signupPending, total: +rolePending + +signupPending } });
        if (path.endsWith('/review_membership_request')) {
            const body = route.request().postDataJSON(); decisions.push(body);
            if (body.request_kind === 'role') rolePending = false; else signupPending = false;
            return route.fulfill({ json: { status: body.decision } });
        }
        return route.fulfill({ json: path.endsWith('/admin_requests') ? (rolePending ? [roleRow] : []) : (signupPending ? [signupRow] : []) });
    });
    await page.goto(`${fixture}?view=approval&admin=true`);
    await page.getByRole('button', { name: '승인', exact: true }).click();
    await page.getByRole('button', { name: '승인 확정' }).click();
    await expect(page.getByText('해당 상태의 신청이 없습니다.')).toBeVisible();
    await page.getByRole('tab', { name: /가입 신청/ }).click();
    await page.getByRole('button', { name: '반려', exact: true }).click();
    await expect(page.getByRole('button', { name: '반려 확정' })).toBeDisabled();
    await page.getByLabel('반려 사유').fill('소속 정보를 확인해 주세요.');
    await page.getByRole('button', { name: '반려 확정' }).click();
    await expect(page.getByText('해당 상태의 신청이 없습니다.')).toBeVisible();
    expect(decisions.map(d => [d.request_kind, d.decision, d.review_reason])).toEqual([
        ['role', 'approved', ''], ['signup', 'rejected', '소속 정보를 확인해 주세요.']
    ]);
});

test('admin badge displays the combined count and clears after polling', async ({ page }) => {
    await page.clock.install();
    let pending = true;
    await page.route('**/__membership-test/rpc/membership_request_counts', route => route.fulfill({ json: pending ? { role: 2, signup: 3, total: 5 } : { role: 0, signup: 0, total: 0 } }));
    await page.goto(`${fixture}?view=badge&admin=true`);
    await expect(page.getByLabel('승인 대기 5건')).toBeVisible();
    pending = false;
    await page.clock.fastForward(15000);
    await expect(page.getByLabel('승인 대기 5건')).toHaveCount(0);
});

test('signup pending page shows the rejection reason', async ({ page }) => {
    await page.route('**/__membership-test/rpc/my_membership', route => route.fulfill({ json: { status: 'rejected', reject_reason: '조직 확인 필요' } }));
    await page.goto(`${fixture}?view=pending`);
    await expect(page.getByRole('heading', { name: '가입 신청이 반려되었습니다' })).toBeVisible();
    await expect(page.getByText('조직 확인 필요', { exact: true })).toBeVisible();
});
