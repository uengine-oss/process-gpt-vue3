/**
 * Process ID (PID) utility functions.
 *
 * PID scheme: ParentId + '.' + SequentialIndex
 * e.g., Major Process "A.1.1" → Sub-processes: "A.1.1.1", "A.1.1.2", "A.1.1.3"
 *
 * Internal UID (used for proc_def records) is separate from the PID.
 * PID is for human-readable hierarchy identification and can be reused
 * (i.e., if a process is deleted its number slot can be reused).
 */

/**
 * Generate the next available PID for a new sub-process under a given Major Process.
 * Finds the current max sequential index among siblings and increments by 1.
 *
 * @param map     - full proc_map object { mega_proc_list: [...] }
 * @param megaId  - ID of the parent Mega Process
 * @param majorId - ID of the parent Major Process (becomes the PID prefix)
 * @returns generated PID string, or empty string if parent not found
 */
export function generateProcessId(map: any, megaId: string, majorId: string): string {
    if (!map?.mega_proc_list || !megaId || !majorId) return '';

    const mega = map.mega_proc_list.find((m: any) => m.id === megaId);
    if (!mega) return '';

    const major = (mega.major_proc_list || []).find((m: any) => m.id === majorId);
    if (!major) return '';

    const subList: any[] = major.sub_proc_list || [];
    const prefix = majorId + '.';

    const existingIndices: number[] = subList
        .map((sub: any) => {
            const id: string = sub.id || '';
            if (id.startsWith(prefix)) {
                const suffix = id.slice(prefix.length);
                // Only direct children (no additional dots)
                if (!suffix.includes('.')) {
                    const n = parseInt(suffix, 10);
                    return isNaN(n) ? null : n;
                }
            }
            return null;
        })
        .filter((n): n is number => n !== null);

    const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;
    return `${majorId}.${nextIndex}`;
}

/**
 * Collect all process IDs currently in the proc_map (mega, major, and sub levels).
 */
export function collectAllProcessIds(map: any): Set<string> {
    const ids = new Set<string>();
    if (!map?.mega_proc_list) return ids;
    for (const mega of map.mega_proc_list) {
        if (mega.id) ids.add(mega.id);
        for (const major of (mega.major_proc_list || [])) {
            if (major.id) ids.add(major.id);
            for (const sub of (major.sub_proc_list || [])) {
                if (sub.id) ids.add(sub.id);
            }
        }
    }
    return ids;
}

/**
 * Check if a PID is already in use anywhere in the proc_map.
 */
export function isPidInUse(map: any, pid: string): boolean {
    return collectAllProcessIds(map).has(pid);
}

/**
 * Find the hierarchy path for a given process definition ID.
 * Walks mega → major → sub to find where the procDefId sits.
 *
 * @param map       - full proc_map object { mega_proc_list: [...] }
 * @param procDefId - the unique ID of the process definition (sub-process)
 * @returns hierarchy path string e.g. "A.1.2.1", or empty string if not found
 */
export function findHierarchyPath(map: any, procDefId: string): string {
    if (!map?.mega_proc_list || !procDefId) return '';

    for (const mega of map.mega_proc_list) {
        for (const major of (mega.major_proc_list || [])) {
            for (const sub of (major.sub_proc_list || [])) {
                if (sub.id === procDefId || sub.proc_def_id === procDefId) {
                    return sub.id || '';
                }
            }
            // Check if procDefId is the major itself
            if (major.id === procDefId || major.proc_def_id === procDefId) {
                return major.id || '';
            }
        }
        if (mega.id === procDefId || mega.proc_def_id === procDefId) {
            return mega.id || '';
        }
    }
    return '';
}

/**
 * Generate a Business ID for a task element within a process.
 * Format: "{hierarchyPath}-T{nn}" where nn is max+1 (deleted numbers not reused).
 *
 * @param hierarchyPath - e.g. "A.1.2.1"
 * @param existingIds   - Set of already-assigned business IDs in this process
 * @param prefix        - task prefix, default "T"
 * @returns e.g. "A.1.2.1-T03"
 */
export function generateBusinessId(
    hierarchyPath: string,
    existingIds: Set<string>,
    prefix: string = 'T'
): string {
    if (!hierarchyPath) return '';

    const pattern = `${hierarchyPath}-${prefix}`;
    let maxNum = 0;

    existingIds.forEach(id => {
        if (id.startsWith(pattern)) {
            const suffix = id.slice(pattern.length);
            const n = parseInt(suffix, 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
        }
    });

    const nextNum = maxNum + 1;
    return `${pattern}${String(nextNum).padStart(2, '0')}`;
}
