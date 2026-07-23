/* solver.js — 국소 사활 솔버
 * 목표: 지정한 수비측(defColor) 대상 그룹(target 좌표들)의 생사 판정.
 * - 착수 후보: region(빈 점 집합) + 패스
 * - 종료: 대상 전멸=DEAD / Benson 완생=ALIVE / 양측 연속 패스=ALIVE(더 못 잡음, 빅 포함)
 * - superko(동형반복 금지)로 패 무한반복 차단 → "팻감 없음" 가정의 국소 판정
 * 반환 status: "ALIVE" | "DEAD" | "UNKNOWN"(탐색량 초과)
 */
(function (global) {
  "use strict";
  const E = (typeof module !== "undefined" && module.exports)
    ? require("./engine.js")
    : global.BadukEngine;

  const PASS = -1;
  const ALIVE = 1, DEAD = -1, UNKNOWN = 0;

  function targetCount(board, target, defColor) {
    let n = 0;
    for (const t of target) if (board.cells[t] === defColor) n++;
    return n;
  }

  function regionEmpties(board, region) {
    const out = [];
    for (const p of region) if (board.cells[p] === E.EMPTY) out.push(p);
    return out;
  }

  function makeSolver(opts) {
    const nodeCap = (opts && opts.nodeCap) || 400000;

    function strHash(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }

    function solve(board, toMove, defColor, target, banned) {
      const tt = new Map();
      let nodes = 0, aborted = false;
      const atkColor = E.other(defColor);
      const targetSet = new Set(target);

      // 수 정렬 힌트: 대상 그룹 활로/인접점 우선
      function orderMoves(b, moves, ttBest) {
        const libSet = new Set();
        for (const t of target) {
          if (b.cells[t] === defColor) {
            const g = E.groupAt(b, t);
            if (g) for (const l of g.libs) libSet.add(l);
            break; // 대표 하나면 그룹 전체 커버(연결돼 있으면). 분리 대비 아래 보강
          }
        }
        for (const t of target) if (b.cells[t] === defColor) {
          const g2 = E.groupAt(b, t);
          if (g2) for (const l of g2.libs) libSet.add(l);
        }
        const score = (m) => {
          if (m === ttBest) return -100;
          let s = 0;
          if (libSet.has(m)) s -= 10;
          for (const n of E.neighbors(b, m)) if (b.cells[n] !== E.EMPTY) s -= 1;
          return s;
        };
        moves.sort((a, c) => score(a) - score(c));
        return moves;
      }

      // 반환: {v: ALIVE|DEAD|UNKNOWN (수비측 관점), best, pv}
      function search(b, tm, passStreak, banned, bhash) {
        nodes++;
        if (nodes > nodeCap) { aborted = true; return { v: UNKNOWN, best: PASS, pv: [] }; }

        // 종료 판정
        if (targetCount(b, target, defColor) === 0)
          return { v: DEAD, best: null, pv: [], why: "capture" };
        if (tm === atkColor) {
          const alive = E.bensonAlive(b, defColor);
          let all = true;
          for (const t of target) if (b.cells[t] === defColor && !alive.has(t)) { all = false; break; }
          if (all && targetCount(b, target, defColor) > 0)
            return { v: ALIVE, best: null, pv: [], why: "twoEyes" };
        }
        if (passStreak >= 2)
          return { v: ALIVE, best: null, pv: [], why: "noKill" };

        const key = E.posKey(b, tm) + "|" + passStreak + "|" + bhash;
        const hit = tt.get(key);
        if (hit) return hit;

        const isDef = tm === defColor;
        const want = isDef ? ALIVE : DEAD;
        let moves = regionEmpties(b, opts.region ? opts.region : defaultRegion(b));
        moves = orderMoves(b, moves, hit && hit.best);
        moves.push(PASS);

        let best = null, bestPv = [], sawUnknown = false;
        let fallback = null; // 지는 수 중 가장 오래 버티는 수(패스 제외)
        let passRes = null;
        for (const m of moves) {
          let nb, nbanned = banned, nbhash = bhash;
          if (m === PASS) {
            nb = b;
          } else {
            const r = E.tryPlay(b, m, tm, banned);
            if (!r) continue;
            nb = r.board;
            nbanned = new Set(banned); nbanned.add(r.key);
            nbhash = (bhash ^ strHash(r.key)) >>> 0;
          }
          const sub = search(nb, E.other(tm), m === PASS ? passStreak + 1 : 0, nbanned, nbhash);
          if (aborted) return { v: UNKNOWN, best: PASS, pv: [] };
          if (sub.v === UNKNOWN) { sawUnknown = true; continue; }
          if (sub.v === want) {
            const res = { v: want, best: m, pv: [m, ...sub.pv], why: sub.why };
            tt.set(key, res);
            return res;
          }
          if (m === PASS) { passRes = { v: sub.v, best: m, pv: [m, ...sub.pv], why: sub.why }; continue; }
          if (!fallback || sub.pv.length + 1 > fallback.pv.length) {
            fallback = { v: sub.v, best: m, pv: [m, ...sub.pv], why: sub.why };
          }
        }
        const res = sawUnknown
          ? { v: UNKNOWN, best: PASS, pv: [] }
          : (fallback || passRes || { v: -want, best: PASS, pv: [PASS], why: "noMove" });
        // fallback의 v는 상대가 원하는 값(-want)임
        if (!sawUnknown && fallback) res.v = -want;
        tt.set(key, res);
        return res;
      }

      function defaultRegion(b) {
        const out = [];
        for (let i = 0; i < b.cells.length; i++) if (b.cells[i] === E.EMPTY) out.push(i);
        return out;
      }

      const b0 = banned || new Set();
      let h0 = 0; for (const k of b0) h0 = (h0 ^ strHash(k)) >>> 0;
      const r = search(board, toMove, 0, b0, h0);
      return {
        status: r.v === ALIVE ? "ALIVE" : r.v === DEAD ? "DEAD" : "UNKNOWN",
        best: r.best, pv: r.pv, why: r.why,
        nodes, aborted,
      };
    }

    /* 각 후보 수의 결과 지도: [{move, status, pv, why}] — 해설 생성용 */
    function analyzeMoves(board, toMove, defColor, target, banned) {
      const out = [];
      const region = opts.region || null;
      const empties = [];
      for (let i = 0; i < board.cells.length; i++) {
        if (board.cells[i] === E.EMPTY && (!region || region.includes(i))) empties.push(i);
      }
      for (const m of empties.concat([PASS])) {
        let nb, nbanned = banned || new Set();
        if (m === PASS) nb = board;
        else {
          const r = E.tryPlay(board, m, toMove, nbanned);
          if (!r) continue;
          nb = r.board;
          nbanned = new Set(nbanned); nbanned.add(r.key);
        }
        const s = solve(nb, E.other(toMove), defColor, target, nbanned);
        out.push({ move: m, status: s.status, pv: s.pv, why: s.why });
      }
      return out;
    }

    return { solve, analyzeMoves, PASS };
  }

  const api = { makeSolver, PASS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.BadukSolver = api;
})(typeof self !== "undefined" ? self : globalThis);
