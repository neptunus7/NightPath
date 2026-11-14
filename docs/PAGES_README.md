# GitHub Pages 시연판 운영 안내

**현재 배포:** NIGHTPATH v0.8.13.0 · https://neptunus7.github.io/NightPath/ · 데스크톱 브라우저 최적화

- 페이지 시작 파일: `docs/index.html`
- GitHub 설정: `Settings → Pages → Deploy from a branch → main /docs`
- 시연판 코드: `docs/app.mjs`, `docs/style.css`, `docs/routing.mjs`, `docs/light_canvas.mjs`, `docs/free_destination.mjs` 등
- 공개 데이터: `docs/data/osm_nowon.json` (실제 OSM · ODbL 1.0)과 **합성 조명 2개 JSON + 합성 안심 1개 JSON**
- 지도 바탕 타일과 Leaflet은 외부에서 불러오므로 인터넷 연결이 필요합니다.
- 기존 `nowon/`은 로컬 연구용 코드 구조를 보관한 폴더입니다. 실제 정부 조명 위치와 로컬 자료는 공개 저장소에 올리지 않았습니다.
- 지도 위 빛 효과는 실제 밝기나 점등 여부를 뜻하지 않습니다. 경로 추천은 안전한 보행을 보장하지 않습니다.

## 업데이트 전 필수 확인

1. `python scripts/audit_public_repo.py`와 자동 테스트를 실행합니다.
2. `docs/PAGES_DATA_LICENSE.md`, `docs/DATA_POLICY.md`의 출처·공개 범위가 실제 데이터와 맞는지 확인합니다.
3. 비밀키·NGII 원본 및 NGII 추출 좌표·사적인 정보가 포함되지 않았는지 직접 재검사합니다.
4. README 이미지·웹 데모 링크가 열리고, 경로 추천이 의도대로 작동하는지 브라우저에서 확인합니다.

`docs/.nojekyll` 파일은 현재 배포에 필수는 아니며, 실제 저장소에 존재하지 않습니다.
