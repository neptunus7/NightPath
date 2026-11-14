# GitHub Pages 시연판 업로드 안내

- **메인 NIGHTPATH v0.8.13.0 소스와 동일한 HTML/CSS, 기존 경로 계산 및 광원 렌더링 모듈을 기반으로 합니다.** 데이터 파일과 로딩 경로·출처 문구만 공개용으로 변경했습니다.
- `docs/index.html`, `docs/app.mjs`, `docs/style.css`, `docs/routing.mjs`, `docs/light_canvas.mjs`, `docs/free_destination.mjs`, `docs/store_hours.mjs`, `docs/store_recommendations.mjs`, `docs/data/*` (ODbL OSM 1개 + 합성 JSON 3개), `.nojekyll`, `PAGES_DATA_LICENSE.md`를 경로 그대로 저장소에 올리세요.
- GitHub 저장소 **Settings → Pages → Build and deployment → Deploy from a branch → main /docs → Save**.
- 배포 후 GitHub Pages 주소는 **GitHub가 설정 화면에 실제로 제공한 URL을 확인**하세요. 주소를 미리 확정해서 주장하지 않습니다.
- 지도 타일·Leaflet CDN 로딩에 인터넷이 필요합니다. 모바일과 데스크톱 둘 다 열리지만 보행 후보망과 밝기 점수는 현장 검증 결과가 아닙니다.
- 기존 `nowon` 코드와 실데이터 없는 공개 저장소 파일은 건드리지 마세요. 메인 README 변경도 필수가 아닙니다.
- **안전 문구:** 실제 OSM 도로·편의점 기록을 이용하며 조명과 안심시설은 가상입니다. 지도 위 가상 광원의 위치와 실제 도로 환경은 일치하지 않을 수 있습니다.
