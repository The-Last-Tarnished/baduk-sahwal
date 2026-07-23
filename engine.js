/* engine.js — 바둑 규칙 엔진 (작은 판 전용)
 * 값: 0=빈점, 1=흑, 2=백
 * node/브라우저 겸용 (전역 BadukEngine)
 */
(function (global) {
  "use strict";

  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const other = (c) => (c === BLACK ? WHITE : BLACK);

  function makeBoard(w, h, cells) {
    return { w, h, cells: cells ? Uint8Array.from(cells) : new Uint8Array(w * h) };
  }
  function cloneBoard(b) {
    return { w: b.w, h: b.h, cells: Uint8Array.from(b.cells) };
  }
  function idx(b, x, y) { return y * b.w + x; }
  function xy(b, i) { return [i % b.w, Math.floor(i / b.w)]; }
  function inside(b, x, y) { return x >= 0 && y >= 0 && x < b.w && y < b.h; }

  function neighbors(b, i) {
    const [x, y] = xy(b, i);
    const out = [];
    if (x > 0) out.push(i - 1);
    if (x < b.w - 1) out.push(i + 1);
    if (y > 0) out.push(i - b.w);
    if (y < b.h - 1) out.push(i + b.w);
    return out;
  }

  // i가 속한 연결 그룹(같은 색)과 그 활로(liberties) 계산
  function groupAt(b, i) {
    const color = b.cells[i];
    if (color === EMPTY) return null;
    const stones = [], libs = new Set(), seen = new Uint8Array(b.w * b.h);
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      stones.push(p);
      for (const n of neighbors(b, p)) {
        const v = b.cells[n];
        if (v === EMPTY) libs.add(n);
        else if (v === color && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    return { color, stones, libs };
  }

  // 착수 시도. 성공: {board(새 객체), captured:[제거된 좌표], key} / 실패: null
  // banned: Set<positionKey> — 동형반복(superko) 금지 위치
  function tryPlay(b, i, color, banned) {
    if (b.cells[i] !== EMPTY) return null;
    const nb = cloneBoard(b);
    nb.cells[i] = color;
    const captured = [];
    // 상대 돌 따냄
    for (const n of neighbors(nb, i)) {
      if (nb.cells[n] === other(color)) {
        const g = groupAt(nb, n);
        if (g && g.libs.size === 0) {
          for (const s of g.stones) { if (nb.cells[s] !== EMPTY) { nb.cells[s] = EMPTY; captured.push(s); } }
        }
      }
    }
    // 자살수 금지
    const own = groupAt(nb, i);
    if (own.libs.size === 0) return null;
    const key = posKey(nb, other(color)); // 다음 둘 차례 포함
    if (banned && banned.has(key)) return null; // superko
    return { board: nb, captured, key };
  }

  function posKey(b, toMove) {
    // 정확 키(충돌 없음): 셀 문자열 + 차례
    let s = "";
    for (let i = 0; i < b.cells.length; i++) s += b.cells[i];
    return s + "|" + toMove;
  }

  /* ---------- Benson 무조건 완생 판정 ----------
   * 반환: Set<index> — color 돌 중 '무조건 산' 돌의 좌표 집합
   */
  function bensonAlive(b, color) {
    const N = b.w * b.h;
    // color 체인들
    const chainId = new Int32Array(N).fill(-1);
    const chains = [];
    for (let i = 0; i < N; i++) {
      if (b.cells[i] === color && chainId[i] === -1) {
        const g = groupAt(b, i);
        const id = chains.length;
        for (const s of g.stones) chainId[s] = id;
        chains.push({ stones: g.stones, libs: g.libs });
      }
    }
    if (!chains.length) return new Set();
    // 지역(region): color가 아닌 점들의 연결 성분
    const regionId = new Int32Array(N).fill(-1);
    const regions = [];
    for (let i = 0; i < N; i++) {
      if (b.cells[i] !== color && regionId[i] === -1) {
        const pts = [], stack = [i];
        regionId[i] = regions.length;
        while (stack.length) {
          const p = stack.pop();
          pts.push(p);
          for (const n of neighbors(b, p)) {
            if (b.cells[n] !== color && regionId[n] === -1) {
              regionId[n] = regions.length;
              stack.push(n);
            }
          }
        }
        regions.push({ pts });
      }
    }
    // 각 지역의 인접 체인 / 빈점
    for (const r of regions) {
      r.adjChains = new Set();
      r.empties = [];
      for (const p of r.pts) {
        if (b.cells[p] === EMPTY) r.empties.push(p);
        for (const n of neighbors(b, p)) {
          if (b.cells[n] === color) r.adjChains.add(chainId[n]);
        }
      }
    }
    // vital(R, X): R의 모든 빈점이 X의 활로
    const vital = (r, ci) => {
      if (r.empties.length === 0) return false; // 빈 점 없는 지역은 눈이 될 수 없음
      const libs = chains[ci].libs;
      for (const e of r.empties) if (!libs.has(e)) return false;
      return r.adjChains.has(ci);
    };
    let aliveChains = new Set(chains.map((_, i) => i));
    let aliveRegions = new Set(regions.map((_, i) => i));
    let changed = true;
    while (changed) {
      changed = false;
      // 지역: 인접 체인이 모두 aliveChains에 있어야 유지
      for (const ri of Array.from(aliveRegions)) {
        for (const ci of regions[ri].adjChains) {
          if (!aliveChains.has(ci)) { aliveRegions.delete(ri); changed = true; break; }
        }
      }
      // 체인: vital 지역 2개 미만이면 제거
      for (const ci of Array.from(aliveChains)) {
        let cnt = 0;
        for (const ri of aliveRegions) if (vital(regions[ri], ci)) cnt++;
        if (cnt < 2) { aliveChains.delete(ci); changed = true; }
      }
    }
    const out = new Set();
    for (const ci of aliveChains) for (const s of chains[ci].stones) out.add(s);
    return out;
  }

  const api = {
    EMPTY, BLACK, WHITE, other,
    makeBoard, cloneBoard, idx, xy, inside, neighbors,
    groupAt, tryPlay, posKey, bensonAlive,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.BadukEngine = api;
})(typeof self !== "undefined" ? self : globalThis);
