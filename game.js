/* game.js — 문제 진행 상태기계 (DOM 없음, worker/node 양쪽에서 사용)
 * 흐름: 사용자(흑) 착수 → 판정 → (정답) 백 최강 저항 or 종료 / (오답) 반박수 시연 → 되돌리기
 */
(function (global) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const E = isNode ? require("./engine.js") : global.BadukEngine;
  const S = isNode ? require("./solver.js") : global.BadukSolver;
  const PASS = -1;

  function parseProblem(p) {
    const rows = p.diagram.trim().split("\n").map(r => r.trim().split(/\s+/));
    const h = rows.length, w = rows[0].length;
    const board = E.makeBoard(w, h);
    const region = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x], i = y * w + x;
      if (ch === "X") board.cells[i] = E.BLACK;
      else if (ch === "O") board.cells[i] = E.WHITE;
      else if (ch === ".") region.push(i);
    }
    if (p.region) { region.length = 0; region.push(...p.region); }
    let target = [];
    if (p.target) { target = p.target.slice(); }
    else if (p.goal === "DEAD") {
      for (let i = 0; i < board.cells.length; i++) if (board.cells[i] === E.WHITE) target.push(i);
    } else if (p.targetPoint) {
      const g = E.groupAt(board, p.targetPoint[1] * w + p.targetPoint[0]);
      target = g.stones;
    } else {
      for (let i = 0; i < board.cells.length; i++) if (board.cells[i] === E.BLACK) target.push(i);
    }
    return { board, region, target, w, h };
  }

  function makeGame(p, opts) {
    const { board, region, target, w, h } = parseProblem(p);
    const want = p.goal === "LIVE" ? "ALIVE" : "DEAD";
    const defColor = p.goal === "LIVE" ? E.BLACK : E.WHITE;
    const solver = S.makeSolver({ region, nodeCap: (opts && opts.nodeCap) || 8000000 });
    const st = {
      board, banned: new Set(), history: [], // history: {board, banned, move, color}
      done: false, result: null,
    };

    function snapshot() {
      return { board: st.board, banned: new Set(st.banned) };
    }
    function pushHistory(move, color, captured) {
      st.history.push({ ...snapshot(), move, color, captured: captured || [] });
    }

    // 현재 국면 즉시 종료 판정 (착수 직후 호출)
    function terminalNow(b) {
      let n = 0;
      for (const t of target) if (b.cells[t] === defColor) n++;
      if (n === 0) return { status: "DEAD", why: "capture" };
      const alive = E.bensonAlive(b, defColor);
      let all = true;
      for (const t of target) if (b.cells[t] === defColor && !alive.has(t)) { all = false; break; }
      if (all) return { status: "ALIVE", why: "twoEyes" };
      return null;
    }

    /* 사용자 착수 시도. 반환:
     * {ok:false, reason} 불가 |
     * {ok:true, verdict:"win"|"lose", terminal?, oppMove?, refute?, why} */
    function userMove(idx) {
      if (st.done) return { ok: false, reason: "finished" };
      if (!region.includes(idx) || st.board.cells[idx] !== E.EMPTY)
        return { ok: false, reason: "illegal" };
      const r = E.tryPlay(st.board, idx, E.BLACK, st.banned);
      if (!r) return { ok: false, reason: "illegal" };

      // 착수 후 국면을 상대 차례로 평가
      const nbanned = new Set(st.banned); nbanned.add(r.key);
      const term0 = terminalNow(r.board);
      let verdictWin, evalAfter = null;
      if (term0) verdictWin = term0.status === want;
      else {
        evalAfter = solver.solve(r.board, E.WHITE, defColor, target, nbanned);
        verdictWin = evalAfter.status === want;
      }

      if (verdictWin) {
        // 확정 반영
        pushHistory(idx, E.BLACK, r.captured);
        st.board = r.board; st.banned = nbanned;
        if (term0) { st.done = true; st.result = "success"; return { ok: true, verdict: "win", terminal: term0.why }; }
        // 백 저항 선택: "가장 시험하는 수" — 흑의 오답 응수가 가장 많은 백 착수.
        // 그런 수가 하나도 없으면(어떤 저항에도 흑 전 응수가 정답) 백 포기 → 종료.
        if (evalAfter.why === "noKill") {
          st.done = true; st.result = "success";
          return { ok: true, verdict: "win", terminal: "noKill", oppPassed: true };
        }
        const targetCountOf = b => { let n = 0; for (const t of target) if (b.cells[t] === defColor) n++; return n; };
        let pick = null; // {move, rw, loseCnt}
        for (const wm of region) {
          if (st.board.cells[wm] !== E.EMPTY) continue;
          const rw0 = E.tryPlay(st.board, wm, E.WHITE, st.banned);
          if (!rw0) continue;
          const nb2 = new Set(st.banned); nb2.add(rw0.key);
          // 백이 이 수로 판을 뒤집으면 안 됨(정답 유지 확인) — verdictWin이므로 모든 백수는 지는 수지만 방어적으로 확인
          let loseCnt = 0, winCnt = 0, legal = 0;
          for (const m2 of region) {
            if (rw0.board.cells[m2] !== E.EMPTY) continue;
            const r2 = E.tryPlay(rw0.board, m2, E.BLACK, nb2);
            if (!r2) continue;
            legal++;
            const nb3 = new Set(nb2); nb3.add(r2.key);
            let s2;
            if (p.goal === "DEAD" && targetCountOf(r2.board) === 0) s2 = "DEAD";
            else {
              const t2 = terminalNow(r2.board);
              s2 = t2 ? t2.status : solver.solve(r2.board, E.WHITE, defColor, target, nb3).status;
            }
            if (s2 !== want) loseCnt++; else winCnt++;
          }
          // 흑이 '착수로' 이길 길이 있는 저항만 채택(정답이 패스뿐인 국면 방지)
          if (legal > 0 && loseCnt > 0 && winCnt > 0 && (!pick || loseCnt > pick.loseCnt)) pick = { move: wm, rw: rw0, loseCnt };
        }
        if (!pick) {
          st.done = true; st.result = "success";
          return { ok: true, verdict: "win", terminal: "resigned", oppPassed: true };
        }
        const best = pick.move, rw = pick.rw;
        pushHistory(best, E.WHITE, rw.captured);
        st.board = rw.board; st.banned.add(rw.key);
        const term1 = terminalNow(st.board);
        if (term1 && term1.status === want) { st.done = true; st.result = "success"; return { ok: true, verdict: "win", oppMove: best, terminal: term1.why }; }
        return { ok: true, verdict: "win", oppMove: best };
      }

      // 오답: 반박 1수 계산(반영은 시연용 — 호출측이 보여준 뒤 undo)
      let refute = null;
      if (!term0 && evalAfter && evalAfter.best != null && evalAfter.best !== PASS) refute = evalAfter.best;
      // 시연 반영
      pushHistory(idx, E.BLACK, r.captured);
      st.board = r.board; st.banned = nbanned;
      if (refute != null) {
        const rw = E.tryPlay(st.board, refute, E.WHITE, st.banned);
        if (rw) { pushHistory(refute, E.WHITE, rw.captured); st.board = rw.board; st.banned.add(rw.key); }
        else refute = null;
      }
      return { ok: true, verdict: "lose", refute, why: term0 ? term0.why : evalAfter.why };
    }

    /* 오답 시연 후 원위치: 마지막 사용자 착수 이전으로 */
    function undoToRetry() {
      // history에서 마지막 흑 착수 지점까지 되돌림
      while (st.history.length) {
        const last = st.history.pop();
        st.board = last.board; st.banned = last.banned;
        if (last.color === E.BLACK) break;
      }
      st.done = false; st.result = null;
    }

    function reset() {
      const fresh = parseProblem(p);
      st.board = fresh.board; st.banned = new Set(); st.history = [];
      st.done = false; st.result = null;
    }

    function state() {
      return {
        cells: Array.from(st.board.cells), w, h, region,
        done: st.done, result: st.result,
        lastMove: st.history.length ? st.history[st.history.length - 1].move : null,
        lastUserMove: (function () {
          for (let i = st.history.length - 1; i >= 0; i--)
            if (st.history[i].color === E.BLACK) return st.history[i].move;
          return null;
        })(),
        moveCount: st.history.length,
      };
    }

    return { userMove, undoToRetry, reset, state, want, defColor, region, w, h };
  }

  const api = { makeGame, parseProblem, PASS };
  if (isNode) module.exports = api;
  else global.BadukGame = api;
})(typeof self !== "undefined" ? self : globalThis);
