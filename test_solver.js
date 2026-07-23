/* test_solver.js — 알려진 사활 정답과 솔버 결과 대조 (변 배치: 벽에 바깥 공기 확보) */
const E = require("./engine.js");
const { makeSolver } = require("./solver.js");

function parse(diagram) {
  const rows = diagram.trim().split("\n").map(r => r.trim().split(/\s+/));
  const h = rows.length, w = rows[0].length;
  const b = E.makeBoard(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    b.cells[y * w + x] = ch === "X" ? E.BLACK : ch === "O" ? E.WHITE : E.EMPTY;
  }
  return b;
}
function stonesOf(b, color) {
  const out = [];
  for (let i = 0; i < b.cells.length; i++) if (b.cells[i] === color) out.push(i);
  return out;
}
function interiorEmpties(b) {
  // 맨 윗줄(공기)을 제외한 빈 점 = 문제 영역
  const out = [];
  for (let i = b.w; i < b.cells.length; i++) if (b.cells[i] === E.EMPTY) out.push(i);
  return out;
}

let pass = 0, fail = 0;
function check(name, got, want, extra) {
  if (got === want) { pass++; console.log(`  ✔ ${name}: ${got}`); }
  else { fail++; console.log(`  ✘ ${name}: got ${got}, want ${want} ${extra || ""}`); }
}

function run(name, diagram, cases) {
  const b = parse(diagram);
  const target = stonesOf(b, E.WHITE);
  const region = interiorEmpties(b);
  const S = makeSolver({ region, nodeCap: 3000000 });
  console.log(name + ":");
  for (const c of cases) {
    const r = S.solve(b, c.toMove, E.WHITE, target);
    check(c.name, r.status, c.want, `pv=${r.pv} nodes=${r.nodes}`);
    if (c.vital !== undefined) check(c.name + " 급소", r.pv[0], c.vital);
  }
}

/* 1. 직삼: 먼저 두는 쪽이 이김, 급소=중앙(24) */
run("직삼", `
. . . . . . .
X X X X X X X
O O O O O O O
O O . . . O O
`, [
  { name: "흑 선 → 죽음", toMove: E.BLACK, want: "DEAD", vital: 24 },
  { name: "백 선 → 삶", toMove: E.WHITE, want: "ALIVE", vital: 24 },
]);

/* 2. 사궁(2x2): 어느 쪽이 먼저든 죽음 */
run("사궁(2x2)", `
. . . . . .
X X X X X X
O O O O O O
O O . . O O
O O . . O O
`, [
  { name: "흑 선 → 죽음", toMove: E.BLACK, want: "DEAD" },
  { name: "백 선 → 죽음", toMove: E.WHITE, want: "DEAD" },
]);

/* 3. 직사(1x4): 어느 쪽이 먼저든 삶 */
run("직사(1x4)", `
. . . . . . . .
X X X X X X X X
O O O O O O O O
O O . . . . O O
`, [
  { name: "흑 선 → 삶", toMove: E.BLACK, want: "ALIVE" },
  { name: "백 선 → 삶", toMove: E.WHITE, want: "ALIVE" },
]);

/* 4. 오궁도화(십자 5집): 급소=중앙(31) */
run("오궁도화", `
. . . . . . .
X X X X X X X
O O O O O O O
O O O . O O O
O O . . . O O
O O O . O O O
`, [
  { name: "흑 선 → 죽음", toMove: E.BLACK, want: "DEAD", vital: 31 },
  { name: "백 선 → 삶", toMove: E.WHITE, want: "ALIVE", vital: 31 },
]);

/* 5. 직육궁(2x3): 흑 선이어도 삶 */
run("직육궁(2x3)", `
. . . . . . .
X X X X X X X
O O O O O O O
O O . . . O O
O O . . . O O
`, [
  { name: "흑 선 → 삶", toMove: E.BLACK, want: "ALIVE" },
]);

/* 6. 빅(세키): 백 고리 vs 안의 흑 두 점, 공유 활로 2 */
{
  const b = parse(`
. . . . . .
X X X X X X
X O O O O X
X O . . O X
X O X X O X
X O O O O X
`);
  const target = stonesOf(b, E.WHITE);
  const region = [3 * 6 + 2, 3 * 6 + 3];
  const S = makeSolver({ region });
  console.log("빅(세키):");
  check("흑 선 → 삶(빅)", S.solve(b, E.BLACK, E.WHITE, target).status, "ALIVE");
  check("백 선 → 삶(빅)", S.solve(b, E.WHITE, E.WHITE, target).status, "ALIVE");
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
