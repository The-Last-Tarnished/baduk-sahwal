/* worker.js — 수읽기 전담 워커. UI 스레드는 멈추지 않는다. */
importScripts("engine.js", "solver.js", "problems.js", "game.js");

let game = null;
let problem = null;

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      problem = BadukProblems.PROBLEMS.find((p) => p.id === msg.id);
      game = BadukGame.makeGame(problem);
      post("loaded", { state: game.state() });
    } else if (msg.type === "move") {
      const result = game.userMove(msg.idx);
      post("moved", { result, state: game.state() });
    } else if (msg.type === "undo") {
      game.undoToRetry();
      post("state", { state: game.state() });
    } else if (msg.type === "reset") {
      game.reset();
      post("state", { state: game.state() });
    }
  } catch (err) {
    post("error", { message: String(err && err.stack || err) });
  }
};

function post(type, data) {
  self.postMessage(Object.assign({ type, reqId: undefined }, data));
}
