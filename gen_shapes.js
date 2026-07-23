/* gen_shapes.js — 크기 3~6 폴리오미노(눈 모양) 전수 열거 + 회전/반사 중복 제거 */
"use strict";
function norm(cells) { // cells: [[x,y]...] → 좌상단 정렬 + 정렬된 키
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  const s = cells.map(c => [c[0] - mx, c[1] - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return s;
}
const keyOf = (cells) => norm(cells).map(c => c.join(",")).join(";");
function transforms(cells) {
  const out = [];
  let cur = cells;
  for (let r = 0; r < 4; r++) {
    out.push(cur);
    out.push(cur.map(([x, y]) => [-x, y])); // 반사
    cur = cur.map(([x, y]) => [-y, x]);     // 90도 회전
  }
  return out;
}
const canon = (cells) => transforms(cells).map(keyOf).sort()[0];

function enumerate(maxN) {
  const bySize = { 1: [[[0, 0]]] };
  const seen = { 1: new Set([canon([[0, 0]])]) };
  for (let n = 2; n <= maxN; n++) {
    bySize[n] = []; seen[n] = new Set();
    for (const shape of bySize[n - 1]) {
      const cellSet = new Set(shape.map(c => c.join(",")));
      for (const [x, y] of shape) {
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (cellSet.has(nx + "," + ny)) continue;
          const ns = norm([...shape, [nx, ny]]);
          const ck = canon(ns);
          if (seen[n].has(ck)) continue;
          seen[n].add(ck);
          bySize[n].push(ns);
        }
      }
    }
  }
  return bySize;
}

if (require.main === module) {
  const bs = enumerate(6);
  for (let n = 3; n <= 6; n++) console.log(`크기 ${n}: ${bs[n].length}개`);
}
module.exports = { enumerate, canon, norm, transforms, keyOf };
