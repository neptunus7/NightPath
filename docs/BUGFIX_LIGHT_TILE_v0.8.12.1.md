# NIGHTPATH v0.8.12.1 — 광원 레이어 사라짐 회귀 오류 수정

## 증상
- 사용자 Windows 브라우저 v0.8.12에서 지도·경로 및 조명시설 데이터는 정상 로딩되지만 가로등·보안등 등의 광원 점/빛이 표시되지 않았음.

## 원인
- `nowon/light_canvas.mjs`의 `L.GridLayer.createTile(coords,done)`가 캔버스 그리기 **직후 동기적으로 `done(null,tile)` 호출**.
- Leaflet 1.9.4 내부 `_addTile`은 `createTile()` 반환 이후에 타일을 내부 `_tiles`에 등록함. 따라서 `done`으로 미리 호출한 `_tileReady`가 등록 전 타일을 찾지 못하고 종료됨.
- `createTile`이 두 인자(비동기 형식)를 선언했기 때문에 Leaflet 자체의 다음 프레임 완료 처리도 작동하지 않아, 타일이 'loaded' 상태가 되지 못하고 광원 레이어가 투명해졌음.

## 수정
- `createTile(coords)`라는 **동기 형식**으로 변경하고 수동 `done` 호출 제거.
- Leaflet이 타일 등록 후 다음 프레임에 `_tileReady`를 처리하도록 맡김.
- 밤빛 디자인과 가로등/보안등 색상, 사용자 영업시간 수동 입력, 경로 5개 추천 점수·OSM/NGII 데이터는 변경하지 않음.

## 테스트
- `tests/light-grid-visible-regression.test.mjs`에서 동기 타일 메서드 형식, 픽셀 드로잉 및 Leaflet 등록 순서와 호환성을 검사.
- 기존 라우팅·조명 테스트 및 Python 서버 테스트 회귀 검사.
- 개발 컨테이너 내 실제 Leaflet 전체 화면 접속은 브라우저 보안 제한(`ERR_BLOCKED_BY_ADMINISTRATOR`)으로 불가하여 최종 Windows 렌더링 검증은 사용자 PC에서 필요.

## 공식 참조
- Leaflet 1.9.4 GridLayer: https://leafletjs.com/reference-1.9.4.html
- Leaflet 1.9.4 source: https://app.unpkg.com/leaflet@1.9.4/files/dist/leaflet-src.esm.js

## 공개 주의
- 실행용 프로젝트에 NGII 파생 좌표 포함. 원천 데이터 공개 재배포 권한 확인 전 전체 ZIP을 GitHub 공개 저장소에 업로드하지 않음.
