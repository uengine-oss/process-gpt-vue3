import { test, expect, type Page } from '@playwright/test';

const fixture = '/playwright/fixtures/policy-documents.html';
const original = { id: 'policy-1', tenant_id: 'policy-test', name: '공통 정책.pdf', kind: 'file', file_path: 'uploads/shared.pdf', file_bucket: 'private-docs', file_size_bytes: 42, domains: [], created_at: '2026-09-09T00:00:00Z' };

async function mockLibrary(page: Page, options: { failRegistration?: boolean; failList?: boolean } = {}) {
    const rows: any[] = [{ ...original }];
    const uploads: string[] = [], removals: string[] = [];
    const usages = [
            { policy_id: 'policy-1', process_id: 'process-a', element_id: 'D1', process: { name: '구매 프로세스', domain_id: 'manufacturing' } },
            { policy_id: 'policy-1', process_id: 'process-a', element_id: 'D2', process: { name: '구매 프로세스', domain_id: 'manufacturing' } },
            { policy_id: 'policy-1', process_id: 'process-b', element_id: 'D3', process: { name: '승인 프로세스', domain_id: 'finance' } }
        ];
    await page.route('**/__policy-test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace('/__policy-test/', '');
        if (path.startsWith('storage/')) {
            if (request.method() === 'POST') {
                uploads.push(path);
                return route.fulfill({ json: { path: path.split('/').slice(2).join('/') } });
            }
            if (request.method() === 'DELETE') { removals.push(request.postData() || ''); return route.fulfill({ json: [] }); }
            return route.fulfill({ body: 'file contents', contentType: 'application/pdf' });
        }
        if (path === 'users') return route.fulfill({ json: { username: '테스터', email: 'test@example.test' } });
        if (path === 'policy_document_usage') return route.fulfill({ json: usages });
        if (path === 'audit_policy') {
            expect(url.searchParams.get('tenant_id') || request.postDataJSON()?.tenant_id).toBe('policy-test');
            if (request.method() === 'POST') {
                if (options.failRegistration) return route.fulfill({ status: 500, json: { message: 'Unavailable' } });
                const row = { ...request.postDataJSON(), id: 'policy-' + (rows.length + 1), created_at: '2026-09-09T00:00:00Z' };
                rows.push(row);
                return route.fulfill({ json: row });
            }
            if (options.failList) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
            return route.fulfill({ json: rows });
        }
        return route.fulfill({ json: [] });
    });
    return { rows, uploads, removals, usages };
}

test('diagram upload becomes a library file; library file can be attached without another upload', async ({ page }) => {
    const state = await mockLibrary(page);
    await page.goto(fixture);
    await page.locator('input[type=file]').setInputFiles({ name: '순서도 지침.pdf', mimeType: 'application/pdf', buffer: Buffer.from('guide') });
    await expect(page.getByRole('button', { name: '순서도 지침.pdf', exact: true })).toBeVisible();
    expect(state.rows).toHaveLength(2);
    expect(state.rows[1]).toMatchObject({ name: '순서도 지침.pdf', file_bucket: 'files', file_size_bytes: 5 });
    expect(await page.evaluate(() => (window as any).policyTestModel.dataAttachmentFile.policyId)).toBe('policy-2');
    await page.getByTitle('첨부 해제').click();
    expect(state.removals).toHaveLength(0);
    await page.getByRole('button', { name: '사내 정책문서에서 선택' }).click();
    await page.getByRole('textbox', { name: /문서명 검색/ }).fill('공통');
    await page.getByRole('listbox').getByText('공통 정책.pdf', { exact: true }).click();
    await page.getByRole('button', { name: '선택', exact: true }).click();
    expect(await page.evaluate(() => (window as any).policyTestModel.dataAttachmentFile)).toMatchObject({ policyId: 'policy-1', path: 'uploads/shared.pdf', bucket: 'private-docs' });
    expect(state.uploads).toHaveLength(1);
    await page.goto(fixture + '?view=library');
    await expect(page.getByRole('link', { name: '순서도 지침.pdf' })).toBeVisible();
    await expect(page.getByRole('link', { name: '구매 프로세스' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: '승인 프로세스' })).toHaveAttribute('href', '/process-hierarchy?id=process-b');
    const usedRow = page.getByRole('row').filter({ hasText: '공통 정책.pdf' });
    await expect(usedRow.locator('button').last()).toBeDisabled();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: '공통 정책.pdf' }).click();
    expect((await download).suggestedFilename()).toBe('공통 정책.pdf');
});

test('policy page uploads are selectable in a diagram', async ({ page }) => {
    const state = await mockLibrary(page);
    await page.goto(fixture + '?view=library');
    await page.getByRole('button', { name: '문서 등록', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: '사내 정책.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('policy') });
    await page.getByRole('button', { name: '등록', exact: true }).click();
    await expect(page.getByRole('link', { name: '사내 정책.docx' })).toBeVisible();
    await page.goto(fixture);
    await page.getByRole('button', { name: '사내 정책문서에서 선택' }).click();
    await page.getByRole('textbox', { name: /문서명 검색/ }).fill('사내 정책');
    await page.getByRole('listbox').getByText('사내 정책.docx', { exact: true }).click();
    await page.getByRole('button', { name: '선택', exact: true }).click();
    expect(await page.evaluate(() => (window as any).policyTestModel.dataAttachmentFile.path)).toBe(state.rows[1].file_path);
    expect(state.uploads).toHaveLength(1);
});

test('registration failure cleans storage and never creates a dangling attachment', async ({ page }) => {
    const state = await mockLibrary(page, { failRegistration: true });
    await page.goto(fixture);
    await page.locator('input[type=file]').setInputFiles({ name: '실패.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test') });
    await expect(page.getByText('파일 업로드 중 오류가 발생했습니다.')).toBeVisible();
    expect(await page.evaluate(() => (window as any).policyTestModel.dataAttachmentFile)).toBeNull();
    expect(state.removals).toHaveLength(1);
});

test('readonly fields cannot upload/select and query failures are visible', async ({ page }) => {
    await mockLibrary(page, { failList: true });
    await page.goto(fixture + '?readonly=true');
    await expect(page.getByRole('button', { name: '파일 업로드', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '사내 정책문서에서 선택' })).toHaveCount(0);
    await page.goto(fixture);
    await page.getByRole('button', { name: '사내 정책문서에서 선택' }).click();
    await expect(page.getByText('정책문서 목록을 불러오지 못했습니다. 다시 시도해 주세요.')).toBeVisible();
});

test('large libraries paginate and multiple attachments do not duplicate selected files', async ({ page }) => {
    await mockLibrary(page);
    const offsets: number[] = [];
    await page.route('**/__policy-test/audit_policy?*', async route => {
        const offset = Number(new URL(route.request().url()).searchParams.get('offset'));
        offsets.push(offset);
        const rows = offset === 0
            ? Array.from({ length: 500 }, (_, i) => ({ ...original, id: 'bulk-' + i, name: `문서 ${i}.pdf`, file_path: `uploads/${i}.pdf` }))
            : [{ ...original, name: '마지막 정책.pdf' }];
        return route.fulfill({ json: rows });
    });
    await page.goto(fixture + '?multiple=true');
    for (let i = 0; i < 2; i++) {
        await page.getByRole('button', { name: '사내 정책문서에서 선택' }).click();
        await page.getByRole('textbox', { name: /문서명 검색/ }).fill('마지막');
        await page.getByRole('listbox').getByText('마지막 정책.pdf', { exact: true }).click();
        await page.getByRole('button', { name: '선택', exact: true }).click();
    }
    expect(offsets).toEqual([0, 500, 0, 500]);
    expect(await page.evaluate(() => (window as any).policyTestModel.dataAttachmentFile)).toHaveLength(1);
});


test('document size and all current process domains appear, refresh and filter correctly', async ({ page }) => {
    const state = await mockLibrary(page);
    state.rows[0].file_size_bytes = 19372;
    state.rows[0].domains = ['manual'];
    await page.goto(fixture + '?view=library');
    const row = page.getByRole('row').filter({ hasText: '공통 정책.pdf' });
    await expect(row.getByText('18.9 KB', { exact: true })).toBeVisible();
    await expect(row.getByText('제조', { exact: true })).toHaveCount(1);
    await expect(row.getByText('재무', { exact: true })).toBeVisible();
    await expect(row.getByText('공통', { exact: true })).toBeVisible();
    state.usages.splice(0, 2);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(row.getByText('제조', { exact: true })).toHaveCount(0);
    await expect(row.getByText('공통', { exact: true })).toBeVisible();
    await page.getByPlaceholder('도메인·문서명·작성자·프로세스').fill('재무');
    await expect(row).toBeVisible();
});
