// talk の props に書かれた profile 参照("$.timeline" など)を実データに置き換える。

export class RefError extends Error {
  constructor(ref) {
    super(`profile に参照先がありません: ${ref}`);
    this.ref = ref;
  }
}

export function isRef(value) {
  return typeof value === 'string' && (value === '$' || value.startsWith('$.'));
}

export function getPath(obj, ref) {
  if (ref === '$') return obj;
  let cur = obj;
  for (const key of ref.slice(2).split('.')) {
    if (cur === null || typeof cur !== 'object' || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function resolveRefs(value, profile) {
  if (isRef(value)) {
    const found = getPath(profile, value);
    if (found === undefined) throw new RefError(value);
    return found;
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, profile));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, profile)]));
  }
  return value;
}

// 検証用: 解決できない参照をすべて集める(最初の1件で止めず、まとめて直せるように)。
export function collectBrokenRefs(value, profile, out = []) {
  if (isRef(value)) {
    if (getPath(profile, value) === undefined) out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectBrokenRefs(v, profile, out));
  } else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((v) => collectBrokenRefs(v, profile, out));
  }
  return out;
}
