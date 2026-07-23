/* gen_problems.js — 눈 모양 전수 → 포위 보드 구축 → 솔버 검증 → 수련장 문제 출력
 * 실행: node gen_problems.js [maxSize]  (기본 6)
 * 출력: problems_gen.js (검증 통과작만), gen_report.txt
 */
"use strict";
const fs = require("fs");
const E = require("./engine.js");
const S = require("./solver.js");
const { enumerate } = require("./gen_shapes.js");

const MAXN = parseInt(process.argv[2] || "6", 10);

/* 모양(셀 목록) + 내부 공격돌 위치(없으면 null) → 보드 구성
 * 반환: {w,h,cells,region,diagram} — cells: 0빈 1흑벽자리 아님… 여기선 색 미정(수비/공격 역할만)
 * 역할: shape 셀 = 눈 공간, 인접 = 수비벽(DEF), 나머지 = 공격벽(ATK), 맨 윗줄 = 공기(~, 공격벽 전용)
 */
function buildBoard(shape, intr) {
  const xs = shape.map(c => c[0]), ys = shape.map(c => c[1]);
  const bw = Math.max(...xs) + 1, bh = Math.max(...ys) + 1;
  const w = bw + 6, h = bh + 7; // 좌우 여백3(수비2+공격1), 위 4(공기1+공격1+수비2), 아래 3
  const OX = 3, OY = 4;
  const AIR = 9, DEF = 1, ATK = 2, EMP = 0;
  const g = new Array(w * h).fill(ATK);
  for (let x = 0; x < w; x++) g[x] = AIR; // y=0 공기
  const inShape = new Set(shape.map(([x, y]) => (y + OY) * w + (x + OX)));
  for (const i of inShape) g[i] = EMP;
  // 수비벽: 눈 공간에서 4방 BFS 거리 1~2 → 두 겹 연결 벽(한 덩어리, 활로=눈 공간 전체)
  const dist = new Map();
  const q = [...inShape];
  for (const i of inShape) dist.set(i, 0);
  while (q.length) {
    const i = q.shift();
    const d = dist.get(i);
    if (d >= 2) continue;
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 1 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist.has(j)) continue;
      dist.set(j, d + 1);
      q.push(j);
    }
  }
  for (const [i, d] of dist) if (d >= 1 && g[i] === ATK) g[i] = DEF;
  const region = [...inShape];
  if (intr) for (const it of intr) {
    const idx = (it.pos[1] + OY) * w + (it.pos[0] + OX);
    g[idx] = it.kind === "def" ? 4 : 3; // 3=내부 공격돌, 4=내부 수비돌
  }
  return { w, h, g, region, AIR, DEF, ATK, EMP };
}

/* 역할 보드 → 실제 색 보드 (mode: "LIVE" 수비=흑 / "KILL" 수비=백) */
function toColored(bd, mode) {
  const board = E.makeBoard(bd.w, bd.h);
  const defC = mode === "LIVE" ? E.BLACK : E.WHITE;
  const atkC = mode === "LIVE" ? E.WHITE : E.BLACK;
  for (let i = 0; i < bd.g.length; i++) {
    const v = bd.g[i];
    if (v === bd.DEF) board.cells[i] = defC;
    else if (v === bd.ATK) board.cells[i] = atkC;
    else if (v === 3) board.cells[i] = atkC; // 내부 치중돌 = 공격색
    else if (v === 4) board.cells[i] = defC; // 내부 수비돌(잡혀도 되는 돌 — target 제외)
  }
  const target = [];
  for (let i = 0; i < board.cells.length; i++) if (board.cells[i] === defC && bd.g[i] === bd.DEF) target.push(i);
  return { board, defC, atkC, target };
}

function diagramOf(bd, mode) {
  const defCh = mode === "LIVE" ? "X" : "O";
  const atkCh = mode === "LIVE" ? "O" : "X";
  const rows = [];
  for (let y = 0; y < bd.h; y++) {
    const r = [];
    for (let x = 0; x < bd.w; x++) {
      const v = bd.g[y * bd.w + x];
      r.push(v === bd.AIR ? "~" : v === bd.DEF ? defCh : v === bd.ATK ? atkCh : v === 3 ? atkCh : v === 4 ? defCh : ".");
    }
    rows.push(r.join(" "));
  }
  return "\n" + rows.join("\n") + "\n";
}

/* 검증: 사용자(흑) 선 → want, 상대 선 → 반대 여야 성립 */
function verify(bd, mode, nodeCap) {
  const { board, defC, target } = toColored(bd, mode);
  const want = mode === "LIVE" ? "ALIVE" : "DEAD";
  const solver = S.makeSolver({ region: bd.region, nodeCap: nodeCap || 4000000 });
  const rUser = solver.solve(board, E.BLACK, defC, target, new Set());
  if (rUser.status !== want) return null;
  const rOpp = solver.solve(board, E.WHITE, defC, target, new Set());
  if (rOpp.status === want || rOpp.status === "UNKNOWN") return null; // 긴장 없음/미확정
  // 정답 첫 수 목록
  const winners = [];
  for (const m of bd.region) {
    if (board.cells[m] !== E.EMPTY) continue;
    const r = E.tryPlay(board, m, E.BLACK, new Set());
    if (!r) continue;
    const nb = new Set([r.key]);
    let st;
    let cnt = 0; for (const t of target) if (r.board.cells[t] === defC) cnt++;
    if (mode === "KILL" && cnt === 0) st = "DEAD";
    else st = solver.solve(r.board, E.WHITE, defC, target, nb).status;
    if (st === want) winners.push(m);
  }
  if (winners.length === 0) return null;
  return { winners, pv: rUser.pv, why: rUser.why, stats: solver.stats };
}

/* 자동 해설: 계산된 사실만 사용 */
function autoTexts(bd, mode, winners, intrDesc) {
  const w = bd.w;
  const co = i => `${(i % w) + 1}열 ${((i / w) | 0) + 1}행`;
  // 각 빈 칸의 '빈 칸 인접 수'
  const emptySet = new Set(bd.region.filter(i => bd.g[i] === bd.EMP));
  const deg = i => [[1,0],[-1,0],[0,1],[0,-1]].reduce((n,[dx,dy]) => {
    const j = ((i / w | 0) + dy) * w + (i % w + dx);
    return n + (emptySet.has(j) ? 1 : 0);
  }, 0);
  let maxDeg = -1; for (const i of emptySet) maxDeg = Math.max(maxDeg, deg(i));
  const n = emptySet.size;
  const side = mode === "LIVE" ? "흑" : "백";
  const act = mode === "LIVE" ? "살리세요" : "잡으세요";
  const intro =
    `${side}의 집 모양은 빈 ${n}칸${intrDesc ? " — " + intrDesc : ""}. ` +
    (mode === "LIVE" ? "손 빼면 죽는 모양입니다. 반드시 두어야 할 자리를 찾아 살리세요."
                     : "그대로 두면 살아버립니다. 급소를 찾아 잡으세요.");
  const allMax = winners.every(m => deg(m) === maxDeg);
  const outro =
    (winners.length === 1
      ? `정답은 ${co(winners[0])} 한 곳.`
      : `정답은 ${winners.map(co).join(", ")} — ${winners.length}곳.`) +
    (allMax && maxDeg > 0
      ? ` 모두 빈 칸 ${maxDeg}곳과 닿는 최다 접점 자리입니다. 급소를 찾을 땐 '빈 칸들과 가장 많이 닿는 점'부터 보세요.`
      : ` 접점 수만으로는 안 보이는 급소입니다 — 수순을 끝까지 읽어야 하는 모양입니다.`) +
    (mode === "LIVE" ? " 이 점을 빼앗기면 남는 공간이 하나로 이어져 두 집이 나오지 않습니다."
                     : " 이 점을 차지하면 상대는 어떻게 막아도 공간을 둘로 가르지 못합니다.");
  return { intro, outro };
}

/* 실행 */
function main() {
  const bySize = enumerate(MAXN);
  const out = [];
  const report = [];
  let cand = 0;
  const t0 = Date.now();
  for (let nsz = 3; nsz <= MAXN; nsz++) {
    for (let si = 0; si < bySize[nsz].length; si++) {
      const shape = bySize[nsz][si];
      // 변형 목록: 없음 / 공격돌1(n>=4) / 공격돌2(n>=5) / 수비돌1(n>=4)
      const variants = [{ list: null, tag: "", desc: null }];
      if (nsz >= 4) for (let a = 0; a < shape.length; a++)
        variants.push({ list: [{ pos: shape[a], kind: "atk" }], tag: "-a" + a, desc: "이미 상대 돌 하나가 들어와 있습니다" });
      if (nsz >= 5) for (let a = 0; a < shape.length; a++) for (let b = a + 1; b < shape.length; b++)
        variants.push({ list: [{ pos: shape[a], kind: "atk" }, { pos: shape[b], kind: "atk" }], tag: "-a" + a + "b" + b, desc: "이미 상대 돌 둘이 들어와 있습니다" });
      if (nsz >= 4) for (let a = 0; a < shape.length; a++)
        variants.push({ list: [{ pos: shape[a], kind: "def" }], tag: "-d" + a, desc: (nszLiveDesc => null)(0) });
      for (const va of variants) {
        const bd = buildBoard(shape, va.list);
        for (const mode of ["LIVE", "KILL"]) {
          cand++;
          const t1 = Date.now();
          const v = verify(bd, mode, nsz >= 6 ? 6000000 : 3000000);
          const dt = Date.now() - t1;
          if (!v) { continue; }
          const desc = va.desc || (va.tag.startsWith("-d") ? (mode === "LIVE" ? "안에 내 돌 하나가 이미 놓여 있습니다" : "안에 백 돌 하나가 이미 놓여 있습니다") : null);
          const { intro, outro } = autoTexts(bd, mode, v.winners, desc);
          const emptyN = bd.region.filter(i => bd.g[i] === bd.EMP).length;
          const level = emptyN <= 3 ? "입문" : emptyN <= 4 ? "초급" : emptyN <= 5 ? "중급" : "상급";
          out.push({
            id: `g-s${nsz}-${si}${va.tag}-${mode.toLowerCase()}`,
            title: null, level,
            type: mode === "LIVE" ? "살리기" : "잡기",
            goal: mode, w: bd.w,
            diagram: diagramOf(bd, mode),
            region: bd.region.slice(),
            answers: v.winners,
            intro, outro,
            notes: {}, wrongNotes: {},
            sizeN: nsz, hasIntr: !!va.list, pvLen: v.pv.length, nWin: v.winners.length,
          });
          report.push(`OK   s${nsz}#${si}${va.tag} ${mode} 정답${v.winners.length} pv${v.pv.length} (${dt}ms)`);
        }
      }
    }
    console.log(`크기 ${nsz} 완료 — 누적 통과 ${out.length} / 후보 ${cand} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  // 난이도 정렬: 빈칸 수 → 정답 수 적은 순 → pv 긴 순
  out.sort((a, b) => a.sizeN - b.sizeN || (a.hasIntr ? 1 : 0) - (b.hasIntr ? 1 : 0) || a.nWin - b.nWin || b.pvLen - a.pvLen);
  out.forEach((p, i) => { p.title = `수련 제${i + 1}형`; });
  const body = "/* problems_gen.js — 자동 생성·전수 검증된 수련장 문제 (" + out.length + "문제) */\n" +
    "(function(global){\"use strict\";const GEN_PROBLEMS=" +
    JSON.stringify(out) +
    ";const api={GEN_PROBLEMS};if(typeof module!==\"undefined\"&&module.exports)module.exports=api;else global.BadukGenProblems=api;})(typeof self!==\"undefined\"?self:globalThis);\n";
  fs.writeFileSync("problems_gen.js", body);
  fs.writeFileSync("gen_report.txt", report.join("\n"));
  console.log(`\n총 ${out.length}문제 생성 (후보 ${cand}, ${((Date.now() - t0) / 1000).toFixed(1)}초)`);
  const byLv = {};
  for (const p of out) byLv[p.level] = (byLv[p.level] || 0) + 1;
  console.log("난이도 분포:", byLv);
}
main();
