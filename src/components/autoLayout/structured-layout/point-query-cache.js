// One instance per routing search: reservations and allowed contacts stay fixed.
export function cachePointQuery(query, capacity = 50000) {
  const xs = new Map();
  let size = 0;
  return point => {
    const ys = xs.get(point.x);
    if (ys?.has(point.y)) return ys.get(point.y);
    const result = query(point);
    if (size >= capacity) { xs.clear(); size = 0; }
    let column = xs.get(point.x);
    if (!column) xs.set(point.x, column = new Map());
    column.set(point.y, result); size++;
    return result;
  };
}
