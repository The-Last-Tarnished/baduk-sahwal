/* verify_problems.js — 각 문제를 솔버로 교차 검증
 * 출력: 초기 판정(내가 선/상대 선), 이기는 첫 수 목록 → answers와 대조
 */
const E = require("./engine.js");
const { makeSolver } = require("./solver.js");
const { PROBLEMS } = require("./problems.js");

function build(p) {
  const rows = p.diagram.trim().split("\n").map(r => r.trim().split(/\s+/));
  const h = rows.length, w = rows[0].length;
  if (w !== p.w) console.log(`  ⚠ ${p.id}: w 불일치 (선언 ${p.w}, 실제 ${w})`);
  const b = E.makeBoard(w, h);
  const region = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x], i = y * w + x;
    if (ch === "X") b.cells[i] = E.BLACK;
    else if (ch === "O") b.cells[i] = E.WHITE;
    else if (ch === ".") region.push(i);
  }
  // target
  let target = [];
  if (p.goal === "DEAD") {
    for (let i = 0; i < b.cells.length; i++) if (b.cells[i] === E.WHITE) target.push(i);
  } else if (p.targetPoint) {
    const g = E.groupAt(b, p.targetPoint[1] * w + p.targetPoint[0]);
    target = g.stones;
  } else {
    for (let i = 0; i < b.cells.length; i++) if (b.cells[i] === E.BLACK) target.push(i);
  }
  return { b, region, target, w, h };
}

const co = (w, i) => i < 0 ? "패스" : `(${i % w},${Math.floor(i / w)})`;

for (const p of PROBLEMS) {
  const { b, region, target, w } = build(p);
  const S = makeSolver({ region, nodeCap: 6000000 });
  const t0 = Date.now();
  const want = p.goal === "LIVE" ? "ALIVE" : "DEAD";
  const mine = S.solve(b, E.BLACK, p.goal === "DEAD" ? E.WHITE : E.BLACK, target);
  const theirs = S.solve(b, E.WHITE, p.goal === "DEAD" ? E.WHITE : E.BLACK, target);
  const am = S.analyzeMoves(b, E.BLACK, p.goal === "DEAD" ? E.WHITE : E.BLACK, target);
  const winners = am.filter(a => a.status === want && a.move !== -1).map(a => a.move);
  const ms = Date.now() - t0;
  const okInit = mine.status === want;
  // 상대 선이면 목표 달성 실패여야 "의미 있는" 문제 (예외: 빅은 상대 선도 삶일 수 있음)
  console.log(`\n[${p.id}] ${p.title} — goal=${p.goal} region=${region.length}칸 (${ms}ms, nodes=${mine.nodes + theirs.nodes})`);
  console.log(`  흑 선: ${mine.status} ${okInit ? "✔" : "✘ 문제 성립 안 함!"}  / 백 선: ${theirs.status}`);
  console.log(`  이기는 첫 수: ${winners.map(m => co(w, m)).join(" ") || "(없음)"}  [idx: ${winners.join(",")}]`);
  if (p.answers) {
    const a = [...p.answers].sort((x,y)=>x-y).join(",");
    const g = [...winners].sort((x,y)=>x-y).join(",");
    console.log(`  answers 대조: ${a === g ? "✔ 일치" : `✘ 선언=${a} vs 엔진=${g}`}`);
  }
}
