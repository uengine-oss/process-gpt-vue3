// 인용 뷰어용 memento 호출. 인용 앵커는 블록(file_id + start_block~end_block)이다.
import axios from 'axios';
import { getTenantId } from '@/utils/tenant';

const BASE = '/memento';
const PAGE_SCALE = 1.5;
const blockCache = new Map();

function fileParams(ref) {
    return ref.fileId ? { file_id: ref.fileId } : { path: ref.path };
}

export async function fetchBlocks(ref) {
    const key = ref.fileId || ref.path;
    if (!blockCache.has(key)) {
        const request = axios
            .get(`${BASE}/document/blocks`, { params: { tenant_id: getTenantId(), ...fileParams(ref) } })
            .then((r) => r.data);
        blockCache.set(key, request);
        request.catch(() => blockCache.delete(key));
    }
    return blockCache.get(key);
}

export async function locateQuote(ref, quote) {
    const { data } = await axios.get(`${BASE}/document/locate`, {
        params: { tenant_id: getTenantId(), quote, ...fileParams(ref) }
    });
    return data;
}

export function pageImageUrl(fileId, page) {
    const q = new URLSearchParams({ tenant_id: getTenantId(), file_id: fileId, page: String(page), scale: String(PAGE_SCALE) });
    return `${BASE}/document/page-image?${q}`;
}

// 이미지 픽셀 → PDF 포인트 비율. bbox 는 포인트 단위다.
export const PAGE_IMAGE_SCALE = PAGE_SCALE;
