// Storage identity (bucket + path) is shared by the library and BPMN attachments.
export type PolicyFile = {
    id: string;
    name: string;
    file_path: string;
    file_bucket: string;
    file_size_bytes: number | null;
};

export async function listPolicyDocuments(filesOnly = false) {
    const client = window.$supabase;
    const tenant = window.$tenantName;
    if (!client || !tenant) throw new Error('문서 저장소에 연결할 수 없습니다.');
    const rows: any[] = [];
    // PostgREST caps responses: paginate so larger libraries remain selectable.
    for (let offset = 0; ; offset += 500) {
        let query = client.from('audit_policy').select('*').eq('tenant_id', tenant).is('deleted_at', null);
        if (filesOnly) query = query.eq('kind', 'file');
        const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) return rows;
    }
}

export function policyFileAttachment(policy: PolicyFile) {
    return {
        policyId: policy.id,
        fileName: policy.name,
        path: policy.file_path,
        bucket: policy.file_bucket || 'files',
        size: policy.file_size_bytes
    };
}

export async function registerPolicyAttachment(file: { fileName: string; path: string; bucket: string; size: number }) {
    const { data, error } = await window.$supabase.from('audit_policy').insert({
        tenant_id: window.$tenantName,
        name: file.fileName,
        kind: 'file',
        file_path: file.path,
        file_bucket: file.bucket,
        file_size_bytes: file.size,
        author_id: localStorage.getItem('uid') || null,
        author_name: localStorage.getItem('userName') || localStorage.getItem('email') || null
    }).select('*').single();
    if (error) throw error;
    return { ...file, policyId: data.id };
}

export async function listPolicyUsages() {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
        const { data, error } = await window.$supabase.from('policy_document_usage')
            .select('policy_id, process_id, element_id, process:proc_def!inner(id,name,domain_id,isdeleted,deleted_at)')
            .eq('tenant_id', window.$tenantName)
            .eq('process.isdeleted', false).is('process.deleted_at', null)
            .order('policy_id').order('process_id').order('element_id').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) return rows;
    }
}
