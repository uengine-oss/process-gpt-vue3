// memento 지식베이스 호출 — 화면은 에이전트가 보는 지도(/folders/*)와 같은 응답을 쓴다.
import axios from 'axios';
import { getTenantId } from '@/utils/tenant';

const BASE = '/memento';

function form(fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
        if (v === undefined || v === null || v === '') continue;
        if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
        else fd.append(k, v);
    }
    return fd;
}

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export function tenantId() {
    return getTenantId();
}

export function requester() {
    return {
        uid: localStorage.getItem('uid') || '',
        name: localStorage.getItem('userName') || localStorage.getItem('email') || '',
        isAdmin: localStorage.getItem('isAdmin') === 'true' || localStorage.getItem('role') === 'superAdmin'
    };
}

export async function fetchTree({ docRole, depth = 6 } = {}) {
    const { data } = await axios.get(`${BASE}/folders/tree`, {
        params: { tenant_id: tenantId(), doc_role: docRole, depth }
    });
    return data;
}

// 관리 화면은 에이전트보다 큰 목록을 감당하므로 나열 임계를 서버 상한(2000)까지 올린다.
export async function openFolder(folderPath, { docRole, query, limit = 300, listThreshold = 2000 } = {}) {
    const { data } = await axios.get(`${BASE}/folders/open`, {
        params: {
            tenant_id: tenantId(),
            folder_path: folderPath,
            doc_role: docRole,
            query: query || undefined,
            limit,
            list_threshold: listThreshold,
            include_refs: true
        }
    });
    return data;
}

export async function fetchFolderCard(folderPath, docRole) {
    const { data } = await axios.get(`${BASE}/folders/card`, {
        params: { tenant_id: tenantId(), folder_path: folderPath, doc_role: docRole }
    });
    return data;
}

export async function listEmptyFolders() {
    const { data } = await axios.get(`${BASE}/knowledge/folders`, { params: { tenant_id: tenantId() } });
    return data?.folders || [];
}

export async function fetchCounts() {
    const { data } = await axios.get(`${BASE}/knowledge/files/counts`, { params: { tenant_id: tenantId() } });
    return data || {};
}

export async function ingestStatus() {
    const { data } = await axios.get(`${BASE}/knowledge/ingest/status`, { params: { tenant_id: tenantId() } });
    return data || {};
}

export async function checkHash(fileHash) {
    const { data } = await axios.get(`${BASE}/knowledge/files/check-hash`, {
        params: { tenant_id: tenantId(), file_hash: fileHash }
    });
    return !!(data?.exists && data.existing);
}

export async function uploadFile(file, { folderPath, fileHash, docRole }) {
    const who = requester();
    const baseName = (file.name || 'file').replace(/\\/g, '/').split('/').pop() || 'file';
    const fd = form({
        tenant_id: tenantId(),
        folder_path: folderPath,
        file_hash: fileHash,
        doc_role: docRole,
        uploaded_by_uid: who.uid,
        uploaded_by_name: who.name
    });
    fd.append('file', file, baseName);
    await axios.post(`${BASE}/knowledge/files/upload`, fd, multipart);
}

export async function createFolder(folderPath, docRole) {
    const { data } = await axios.post(
        `${BASE}/knowledge/folders`,
        form({ tenant_id: tenantId(), folder_path: folderPath, doc_role: docRole, requester_uid: requester().uid }),
        multipart
    );
    return data;
}

export async function renameFolder(oldPath, newPath, docRole) {
    const { data } = await axios.post(
        `${BASE}/knowledge/folders/rename`,
        form({ tenant_id: tenantId(), old_path: oldPath, new_path: newPath, doc_role: docRole, requester_uid: requester().uid }),
        multipart
    );
    return data;
}

export async function deleteFolder(folderPath, docRole) {
    const { data } = await axios.delete(`${BASE}/knowledge/folders`, {
        params: { tenant_id: tenantId(), folder_path: folderPath, doc_role: docRole, requester_uid: requester().uid }
    });
    return data;
}

export async function refreshFolderCards(folderPaths, docRole) {
    await axios.post(
        `${BASE}/knowledge/folders/refresh-cards`,
        form({ tenant_id: tenantId(), folder_paths: folderPaths, doc_role: docRole }),
        multipart
    );
}

export async function deleteFile(doc) {
    await axios.delete(`${BASE}/knowledge/files`, {
        params: {
            tenant_id: tenantId(),
            source_type: doc.source_type || 'upload',
            source_ref: doc.source_ref,
            requester_uid: requester().uid
        }
    });
}

export async function fileUrl(doc) {
    const { data } = await axios.get(`${BASE}/knowledge/files/url`, {
        params: {
            tenant_id: tenantId(),
            source_type: doc.source_type || 'upload',
            source_ref: doc.source_ref,
            file_name: doc.file_name || ''
        }
    });
    return data?.url || '';
}

export async function reindexFile(doc) {
    const { data } = await axios.post(
        `${BASE}/knowledge/files/reindex`,
        form({
            tenant_id: tenantId(),
            source_type: doc.source_type || 'upload',
            source_ref: doc.source_ref,
            requester_uid: requester().uid
        }),
        multipart
    );
    return data;
}

export async function rebuildCard(doc) {
    const { data } = await axios.post(
        `${BASE}/knowledge/files/resummarize`,
        form({
            tenant_id: tenantId(),
            source_type: doc.source_type || 'upload',
            source_ref: doc.source_ref,
            requester_uid: requester().uid
        }),
        multipart
    );
    return data;
}

export async function storedPages(doc) {
    const { data } = await axios.get(`${BASE}/parse/stored`, {
        params: { tenant_id: tenantId(), source_ref: doc.source_ref }
    });
    return data?.pages || [];
}

export async function sha256(file) {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export function errorText(e, fallback = '요청 실패') {
    return e?.response?.data?.detail || e?.message || fallback;
}
