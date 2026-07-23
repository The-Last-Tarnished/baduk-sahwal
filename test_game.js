/* 게임 코어 시나리오 테스트 */
const { PROBLEMS } = require("./problems.js");
const { makeGame } = require("./game.js");
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ✔ " + msg); } else { fail++; console.log("  ✘ " + msg); } };

// 1) 직삼 살리기: 정답 → 즉시 성공(두 눈)
{
  console.log("[live-straight3]");
  const g = makeGame(PROBLEMS.find(p => p.id === "live-straight3"));
  const r = g.userMove(24);
  ok(r.ok && r.verdict === "win", "정답 (3,3) → win");
  ok(g.state().done && g.state().result === "success", "즉시 완생 종료");
}
// 2) 직삼 살리기: 오답 → 반박 시연 → 되돌리기 → 재시도 성공
{
  console.log("[live-straight3 오답→재시도]");
  const g = makeGame(PROBLEMS.find(p => p.id === "live-straight3"));
  const r = g.userMove(23);
  ok(r.ok && r.verdict === "lose", "오답 (2,3) → lose");
  ok(r.refute === 24, "반박수 = 급소 (3,3): " + r.refute);
  ok(g.state().moveCount === 2, "시연 2수 반영");
  g.undoToRetry();
  ok(g.state().moveCount === 0, "되돌리기 후 원위치");
  const r2 = g.userMove(24);
  ok(r2.verdict === "win" && g.state().done, "재시도 성공");
}
// 3) 잡기 다수 진행: kill-flower6 — 정답 후 백 저항 → 계속 정답 수순
{
  console.log("[kill-flower6 전체 수순]");
  const g = makeGame(PROBLEMS.find(p => p.id === "kill-flower6"));
  let r = g.userMove(31); // 중앙 치중
  ok(r.ok && r.verdict === "win", "치중 → win, 백 저항: " + r.oppMove);
  let guard = 0;
  while (!g.state().done && guard++ < 10) {
    // 다음 정답 탐색: region 중 아무 winner나 (여기선 solve로 대신: 모든 빈 점 시도)
    const st = g.state();
    let played = false;
    for (const m of st.region) {
      if (st.cells[m] !== 0) continue;
      const rr = g.userMove(m);
      if (!rr.ok) continue;
      if (rr.verdict === "win") { played = true; break; }
      g.undoToRetry(); // 오답이면 되돌리고 다음 후보
    }
    if (!played) break;
  }
  ok(g.state().done && g.state().result === "success", "백 전멸까지 진행 완료 (수순 " + g.state().moveCount + "수)");
}
// 4) 빅: 정답 → 백 패스 종료
{
  console.log("[live-seki]");
  const g = makeGame(PROBLEMS.find(p => p.id === "live-seki"));
  const r = g.userMove(25);
  ok(r.ok && r.verdict === "win", "빅 만들기 → win");
  ok(g.state().done, "종료 (백 저항 불가): terminal=" + r.terminal + " oppPassed=" + !!r.oppPassed);
}
// 5) 이음: 오답 → 백이 따냄 시연
{
  console.log("[connect-atari 오답]");
  const g = makeGame(PROBLEMS.find(p => p.id === "connect-atari"));
  const r = g.userMove(16); // (2,2) 오답
  ok(r.verdict === "lose" && r.refute === 17, "백 반박 = 이음 자리 따냄 (3,2)");
}
console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
