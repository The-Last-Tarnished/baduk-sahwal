/* app.js — DOM + 진행 흐름. 수읽기는 worker.js가 담당. */
(function () {
  "use strict";
  const PROBLEMS = BadukProblems.PROBLEMS;
  const $ = (id) => document.getElementById(id);
  const EMPTY = 0, BLACK = 1, WHITE = 2;

  /* ── 진행 저장 ── */
  const store = {
    read() { try { return JSON.parse(localStorage.getItem("sahwal.solved") || "{}"); } catch { return {}; } },
    markSolved(id) { try { const s = store.read(); s[id] = true; localStorage.setItem("sahwal.solved", JSON.stringify(s)); } catch {} },
  };

  /* ── 문제 파싱(표시용) ── */
  function parseDiagram(p) {
    const rows = p.diagram.trim().split("\n").map((r) => r.trim().split(/\s+/));
    const h = rows.length, w = rows[0].length;
    const cells = new Array(w * h).fill(EMPTY);
    const region = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x], i = y * w + x;
      if (ch === "X") cells[i] = BLACK;
      else if (ch === "O") cells[i] = WHITE;
      else if (ch === ".") region.push(i);
    }
    return { cells, region, w, h };
  }

  /* ── 보드 SVG ── */
  const SVGNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function buildBoard(host, w, h, region, onTap, mini) {
    const M = 0.72, cw = w - 1 + M * 2, chh = h - 1 + M * 2;
    const svg = el("svg", { viewBox: `${-M} ${-M} ${cw} ${chh}`, role: "img" });
    // 나무 바탕(연한 단색 — 그라디언트 참조 미사용: 숨김 화면 정의 참조 시 렌더 실패 방지)
    svg.appendChild(el("rect", { x: -M, y: -M, width: cw, height: chh, fill: "#EDC27A" }));
    // 결 무늬(은은한 가로줄)
    for (let i = 0; i < 5; i++) {
      svg.appendChild(el("rect", { x: -M, y: -M + (chh / 5) * i + 0.13 * (i % 2 ? 1 : 1.7), width: cw, height: 0.045, fill: "rgba(140,95,30,.12)" }));
    }
    // 선
    const g = el("g", { stroke: "#5A4020", "stroke-width": mini ? 0.045 : 0.032, "stroke-linecap": "round" });
    for (let x = 0; x < w; x++) g.appendChild(el("line", { x1: x, y1: 0, x2: x, y2: h - 1 }));
    for (let y = 0; y < h; y++) g.appendChild(el("line", { x1: 0, y1: y, x2: w - 1, y2: y }));
    svg.appendChild(g);
    // 착점 안내(문제 영역 점)
    const hintsG = el("g", {});
    svg.appendChild(hintsG);
    const stonesG = el("g", {});
    svg.appendChild(stonesG);
    const markG = el("g", {});
    svg.appendChild(markG);
    // 탭 영역
    if (onTap) {
      const tapG = el("g", {});
      for (const i of region) {
        const x = i % w, y = (i / w) | 0;
        const r = el("rect", { x: x - 0.5, y: y - 0.5, width: 1, height: 1, fill: "transparent" });
        r.style.cursor = "pointer";
        r.addEventListener("click", () => onTap(i));
        tapG.appendChild(r);
      }
      svg.appendChild(tapG);
    }
    host.innerHTML = "";
    host.appendChild(svg);
    return {
      svg,
      render(cells, lastMove, ghost) {
        stonesG.innerHTML = ""; markG.innerHTML = ""; hintsG.innerHTML = "";
        for (let i = 0; i < cells.length; i++) {
          const x = i % w, y = (i / w) | 0;
          if (cells[i] === EMPTY) {
            if (region.includes(i) && !mini)
              hintsG.appendChild(el("circle", { cx: x, cy: y, r: 0.07, fill: "rgba(74,53,23,.45)" }));
            continue;
          }
          const isB = cells[i] === BLACK;
          const cx = x, cy = y;
          stonesG.appendChild(el("circle", { cx, cy, r: 0.465,
            fill: isB ? "#1B1E26" : "#F6F2E8",
            stroke: isB ? "#000000" : "#A99D85", "stroke-width": 0.025 }));
          // 광택 하이라이트(단색 채움 유지, 참조 없음)
          stonesG.appendChild(el("ellipse", { cx: cx - 0.14, cy: cy - 0.17, rx: 0.16, ry: 0.11,
            fill: isB ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.85)" }));
        }
        if (lastMove != null && lastMove >= 0 && cells[lastMove] !== EMPTY) {
          const x = lastMove % w, y = (lastMove / w) | 0;
          markG.appendChild(el("circle", { cx: x, cy: y, r: 0.13, fill: "none", stroke: "#B2372B", "stroke-width": 0.075 }));
        }
        if (ghost != null) {
          const x = ghost % w, y = (ghost / w) | 0;
          markG.appendChild(el("circle", { cx: x, cy: y, r: 0.465, fill: "none", stroke: "#B2372B", "stroke-width": 0.05, "stroke-dasharray": "0.1 0.08" }));
        }
      },
    };
  }

  /* ── 홈 화면 ── */
  function renderHome() {
    const grid = $("grid");
    grid.innerHTML = "";
    const solved = store.read();
    PROBLEMS.forEach((p, i) => {
      const { cells, region, w, h } = parseDiagram(p);
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      const mini = document.createElement("div");
      card.appendChild(mini);
      const no = document.createElement("div");
      no.className = "no"; no.textContent = `第 ${i + 1} 題`;
      const h3 = document.createElement("h3");
      h3.textContent = p.title;
      const badges = document.createElement("div");
      badges.className = "badges";
      badges.innerHTML = `<span class="badge">${p.level}</span><span class="badge type-${p.type}">${p.type}</span>`;
      card.appendChild(no); card.appendChild(h3); card.appendChild(badges);
      if (solved[p.id]) {
        const seal = document.createElement("div");
        seal.className = "seal-mini";
        seal.textContent = p.goal === "LIVE" ? "生" : "死";
        card.appendChild(seal);
      }
      const b = buildBoard(mini, w, h, region, null, true);
      b.render(cells, null, null);
      b.svg.classList.add("mini");
      const go = () => { location.hash = "#p/" + (i + 1); };
      card.addEventListener("click", go);
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      grid.appendChild(card);
    });
  }

  /* ── 워커 ── */
  let worker = null;
  function getWorker() {
    if (!worker) {
      worker = new Worker("./worker.js");
      worker.onmessage = (e) => handleWorker(e.data);
      worker.onerror = (e) => { setThinking(false); note("bad", "오류", "수읽기 중 문제가 생겼습니다. 새로고침 후 다시 시도해 주세요."); };
    }
    return worker;
  }

  /* ── 문제 화면 상태 ── */
  const ui = { p: null, idx: -1, board: null, locked: true, failPending: false };

  function note(kind, kicker, text) {
    const n = $("note");
    n.classList.remove("flash"); void n.offsetWidth; n.classList.add("flash");
    $("noteKicker").textContent = kicker;
    $("noteKicker").className = "kicker" + (kind === "bad" ? " bad" : "");
    $("noteText").textContent = text;
  }
  function setThinking(on) {
    $("thinking").classList.toggle("on", on);
    $("boardbox").classList.toggle("busy", on);
    ui.locked = on || ui.failPending || (ui.state && ui.state.done);
  }
  function coName(i, w) { return i == null || i < 0 ? "패스" : `${(i % w) + 1}열 ${((i / w) | 0) + 1}행`; }

  function openProblem(n) {
    const p = PROBLEMS[n - 1];
    if (!p) { location.hash = ""; return; }
    ui.p = p; ui.idx = n - 1; ui.failPending = false; ui.state = null;
    $("home").classList.add("hidden");
    $("play").classList.remove("hidden");
    $("crumbText").textContent = `第 ${n} 題 · ${p.level} · ${p.type}`;
    $("ptitle").textContent = p.title;
    $("stamp").textContent = p.goal === "LIVE" ? "生" : "死";
    $("stampwrap").classList.remove("on");
    $("nextBtn").classList.add("hidden");
    $("retryBtn").classList.add("hidden");
    const { region, w, h } = parseDiagram(p);
    ui.board = buildBoard($("boardhost"), w, h, region, onTap, false);
    ui.w = w;
    note("", "문제", p.intro || "흑 차례입니다.");
    $("turnText").textContent = "흑 차례 — 판 위의 빈 점을 눌러 두세요";
    setThinking(true);
    getWorker().postMessage({ type: "load", id: p.id });
    window.scrollTo({ top: 0 });
  }

  function onTap(i) {
    if (ui.locked || ui.failPending) return;
    if (ui.state && ui.state.cells[i] !== EMPTY) return;
    setThinking(true);
    getWorker().postMessage({ type: "move", idx: i });
  }

  function handleWorker(msg) {
    if (msg.type === "error") { setThinking(false); note("bad", "오류", msg.message); return; }
    if (msg.type === "loaded" || msg.type === "state") {
      ui.state = msg.state;
      ui.board.render(msg.state.cells, msg.state.lastMove, null);
      setThinking(false);
      if (msg.type === "state") { // 되돌리기/리셋 후
        ui.failPending = false;
        $("retryBtn").classList.add("hidden");
        $("stampwrap").classList.remove("on");
        $("nextBtn").classList.add("hidden");
        note("", "다시", "같은 자리는 피하고, 급소를 다시 찾아보세요.");
        $("turnText").textContent = "흑 차례 — 판 위의 빈 점을 눌러 두세요";
      }
      return;
    }
    if (msg.type === "moved") {
      const { result, state } = msg;
      ui.state = state;
      setThinking(false);
      if (!result.ok) {
        note("bad", "둘 수 없는 자리", result.reason === "illegal" ? "그 자리는 둘 수 없습니다(활로 없음 또는 되돌이 수). 다른 자리를 찾아보세요." : "이미 끝난 문제입니다.");
        return;
      }
      const p = ui.p, w = ui.w;
      const userMove = findUserMove(state);
      ui.board.render(state.cells, state.lastMove, null);

      if (result.verdict === "win") {
        const noteTxt = (p.notes && p.notes[String(userMove)]) || "정답입니다!";
        if (state.done) {
          finish(noteTxt, result);
        } else {
          const oppTxt = result.oppMove != null ? ` 백은 ${coName(result.oppMove, w)}에 저항합니다. 계속 두세요.` : "";
          note("", "정답 수", noteTxt + oppTxt);
          $("turnText").textContent = "흑 차례 — 마무리까지 이어가세요";
        }
      } else {
        // 오답: 백의 반박이 이미 보드에 반영되어 옴
        ui.failPending = true;
        ui.locked = true;
        $("retryBtn").classList.remove("hidden");
        const wrong = (p.wrongNotes && p.wrongNotes[String(userMove)]) || "";
        const ref = result.refute != null ? `백이 ${coName(result.refute, w)}로 반박했습니다. ` : "";
        const whyTxt = whyText(result.why, p.goal, false);
        note("bad", "실패 — 이 수로는 안 됩니다", `${ref}${wrong || whyTxt} '되돌리고 다시'를 눌러 재도전하세요.`);
        $("turnText").textContent = "수읽기 결과: 실패 수순";
      }
      return;
    }
  }

  function findUserMove(state) {
    // history 기반이 없으므로: lastMove가 백 수일 수 있음 → 워커가 직접 알려주는 게 정석이나
    // 간단화: result에 없으면 lastMove 직전 흑 수를 셀 수 없어 notes 매칭 실패 가능 → 워커에서 보강함
    return state.lastUserMove != null ? state.lastUserMove : state.lastMove;
  }

  function whyText(why, goal, success) {
    const map = {
      capture: goal === "DEAD" ? "백이 전멸했습니다." : "돌이 잡히는 수순입니다.",
      twoEyes: goal === "LIVE" ? "떨어진 두 집(완생)이 확정됐습니다." : "백이 두 집을 내고 살아버립니다.",
      noKill: "서로 더 둘 수 없어 그대로 확정됩니다.",
      resigned: "백이 어떤 저항을 해도 흑의 모든 응수에 잡히므로, 백은 손을 뺍니다.",
    };
    return map[why] || "";
  }

  function finish(lastNote, result) {
    const p = ui.p;
    store.markSolved(p.id);
    $("stampwrap").classList.add("on");
    $("nextBtn").classList.toggle("hidden", ui.idx >= PROBLEMS.length - 1);
    const endTxt = whyText(result.terminal, p.goal, true);
    note("", p.goal === "LIVE" ? "살았습니다 — 生" : "잡았습니다 — 死", `${lastNote} ${endTxt} ${p.outro || ""}`.trim());
    $("turnText").textContent = "완료";
  }

  /* ── 라우팅/버튼 ── */
  function route() {
    const m = location.hash.match(/^#p\/(\d+)$/);
    if (m) openProblem(+m[1]);
    else {
      $("play").classList.add("hidden");
      $("home").classList.remove("hidden");
      renderHome();
    }
  }
  $("backBtn").addEventListener("click", () => { location.hash = ""; });
  $("brand").addEventListener("click", () => { location.hash = ""; });
  $("resetBtn").addEventListener("click", () => { setThinking(true); getWorker().postMessage({ type: "reset" }); });
  $("retryBtn").addEventListener("click", () => { setThinking(true); getWorker().postMessage({ type: "undo" }); });
  $("nextBtn").addEventListener("click", () => { location.hash = "#p/" + (ui.idx + 2); });
  window.addEventListener("hashchange", route);

  /* ── SW ── */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }

  route();
})();
