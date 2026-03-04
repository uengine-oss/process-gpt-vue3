/**
 * [6.2.1-2] IndexedDB 로컬 백업 유틸리티
 * - Save 실패 또는 offline 시 BPMN XML을 IndexedDB에 임시 저장
 * - 재접속 시 로컬 백업 발견 → Recovery Banner 표시
 */

const DB_NAME = 'processgpt_backup';
const DB_VERSION = 1;
const STORE_NAME = 'bpmn_backups';

interface BackupEntry {
    procDefId: string;
    xml: string;
    processName: string;
    timestamp: number;
    version?: string;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'procDefId' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * BPMN XML을 IndexedDB에 백업
 */
export async function saveBackup(entry: BackupEntry): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(entry);
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (e) {
        console.warn('[LocalBackup] Save failed:', e);
    }
}

/**
 * 특정 프로세스의 백업 조회
 */
export async function getBackup(procDefId: string): Promise<BackupEntry | null> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(procDefId);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                db.close();
                resolve(request.result || null);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn('[LocalBackup] Get failed:', e);
        return null;
    }
}

/**
 * 모든 백업 목록 조회
 */
export async function getAllBackups(): Promise<BackupEntry[]> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                db.close();
                resolve(request.result || []);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn('[LocalBackup] GetAll failed:', e);
        return [];
    }
}

/**
 * 백업 삭제
 */
export async function deleteBackup(procDefId: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(procDefId);
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (e) {
        console.warn('[LocalBackup] Delete failed:', e);
    }
}
