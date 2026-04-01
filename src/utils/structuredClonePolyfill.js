function cloneValue(value, seen) {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (typeof value === 'function') {
        throw new TypeError('structuredClone fallback does not support functions');
    }

    if (seen.has(value)) {
        return seen.get(value);
    }

    if (value instanceof Date) {
        return new Date(value.getTime());
    }

    if (value instanceof RegExp) {
        return new RegExp(value.source, value.flags);
    }

    if (value instanceof Map) {
        const clonedMap = new Map();
        seen.set(value, clonedMap);
        value.forEach((entryValue, entryKey) => {
            clonedMap.set(cloneValue(entryKey, seen), cloneValue(entryValue, seen));
        });
        return clonedMap;
    }

    if (value instanceof Set) {
        const clonedSet = new Set();
        seen.set(value, clonedSet);
        value.forEach((entryValue) => {
            clonedSet.add(cloneValue(entryValue, seen));
        });
        return clonedSet;
    }

    if (value instanceof ArrayBuffer) {
        return value.slice(0);
    }

    if (ArrayBuffer.isView(value)) {
        if (value instanceof DataView) {
            return new DataView(cloneValue(value.buffer, seen), value.byteOffset, value.byteLength);
        }
        return new value.constructor(value);
    }

    if (Array.isArray(value)) {
        const clonedArray = [];
        seen.set(value, clonedArray);
        value.forEach((item, index) => {
            clonedArray[index] = cloneValue(item, seen);
        });
        return clonedArray;
    }

    const prototype = Object.getPrototypeOf(value);
    const clonedObject = Object.create(prototype);
    seen.set(value, clonedObject);

    Reflect.ownKeys(value).forEach((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) return;

        if ('value' in descriptor) {
            descriptor.value = cloneValue(descriptor.value, seen);
        }

        Object.defineProperty(clonedObject, key, descriptor);
    });

    return clonedObject;
}

export function fallbackStructuredClone(value) {
    return cloneValue(value, new WeakMap());
}

export function ensureStructuredClone(target = globalThis) {
    if (typeof target.structuredClone !== 'function') {
        target.structuredClone = fallbackStructuredClone;
    }

    return target.structuredClone;
}

ensureStructuredClone(globalThis);
