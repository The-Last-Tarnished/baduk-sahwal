# 사활첩 死活帖

바둑 사활을 두면서 배우는 학습장(PWA). 길잡이 10제(손 해설) + 수련장 262문제(자동 생성·전수 검증), 당신은 언제나 흑.
모든 정오 판정과 상대 응수는 **팻감 없음을 가정한 완전 탐색**으로 계산됩니다(해설 문장만 사람이 썼고, 승패·수순은 전부 엔진 검증).

## 구성
- `index.html` / `app.js` — 화면, 진행 흐름
- `worker.js` — 수읽기 전담 Web Worker (UI 안 멈춤)
- `engine.js` — 바둑 규칙(따냄·자살수 금지·순환 금지, Benson 완생 판정)
- `solver.js` — 사활 완전 탐색(순환 이력 포함 캐시)
- `game.js` — 문제 진행 상태기계(정답→백 최강 저항 / 오답→반박 시연→되돌리기)
- `problems.js` — 길잡이 10제 + 손 해설
- `problems_gen.js` — 수련장 262문제(자동 생성·검증본)
- `gen_shapes.js` / `gen_problems.js` — 문제 생성기. `node gen_problems.js 6` 재생성. 인자 7로 빈 7칸까지 시도 가능(수 시간 소요)
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — 오프라인·홈 화면 설치

## GitHub Pages 배포
1. GitHub에 **공개(public)** 저장소를 만든다 (예: `sahwal`).
2. 이 폴더의 파일 전부를 저장소 루트에 올린다.
   ```bash
   git init && git add . && git commit -m "사활첩 v1"
   git branch -M main
   git remote add origin https://github.com/<아이디>/sahwal.git
   git push -u origin main
   ```
3. 저장소 → Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `/ (root)` → Save.
4. 1–2분 뒤 `https://<아이디>.github.io/sahwal/` 접속.
5. 휴대폰 브라우저에서 열고 "홈 화면에 추가"하면 앱처럼 설치된다(오프라인 동작).

## 로컬에서 열어보기
Web Worker 때문에 파일 더블클릭(file://)으로는 동작하지 않습니다. 폴더에서:
```bash
python3 -m http.server 8000
```
→ http://localhost:8000

## 검증 스크립트 (Node)
```bash
node test_solver.js      # 규칙·판정 단위 테스트
node verify_problems.js  # 10문제 성립성(흑선/백선·정답 좌표) 전수 검증
node test_game.js        # 진행 흐름 시나리오
```

## 알려진 한계
- 팻감 없음 가정: 패 싸움이 바깥 팻감에 좌우되는 문제는 다루지 않는다.
- 자유 분석(임의 배치) 모드는 v1 미포함 — 순환 이력 정확 처리로 넓은 공간 탐색이 느려져, 문제 모드에 집중했다.
