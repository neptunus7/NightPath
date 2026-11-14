# NightPath Pages 공개 데모 — 데이터·라이선스

이 사이트는 **NIGHTPATH v0.8.13.0 UI와 경로 계산 코드를 유지한 공개 시연판**입니다. 로컬 최종 실행판과 다른 데이터로 실행되므로 결과 숫자는 동일하지 않습니다.

## 실제 자료로 사용하는 것
- **OpenStreetMap** 보행 후보도로·편의점 위치·일부 OSM 가로등 기록: `docs/data/osm_nowon.json`.
- 원본 출처: © OpenStreetMap contributors · https://www.openstreetmap.org/copyright
- 데이터 라이선스: Open Data Commons **ODbL 1.0** · https://opendatacommons.org/licenses/odbl/1-0/
- 도로망·POI JSON은 OSM 스냅샷을 줄여 만든 가공 데이터이며 **ODbL 1.0으로 배포**합니다. 이 문서와 JSON 메타데이터에 원출처와 라이선스를 명시합니다. 다른 코드의 MIT 라이선스는 OSM 데이터에 적용되지 않습니다.
- 배경 지도 타일은 OpenStreetMap 서비스에서 별도 요청합니다. 화면 내 OpenStreetMap 기여자 출처표시를 보존합니다. 대량 다운로드나 타일 재배포는 하지 않습니다.

## 실제 자료로 사용하지 않는 것
- `docs/data/lights_synthetic.json`: **NGII 2025 원본 또는 가공 좌표가 아닙니다.** 가상 조명 위치입니다. 기존 파일명은 원본 앱 코드와의 호환을 위해 유지했습니다.
- `docs/data/extra_lights_synthetic.json`: 실제 IoT·2022년 보안등 기록이 아닌 가상 자료입니다.
- `docs/data/safety_synthetic.json`: 실제 2022년 안심귀갓길·CCTV 자료가 아닙니다. 기존 함수와의 호환을 위한 가상 예시입니다.
- 실제 측정 조도(lux), 실제 점등 상태, CCTV/비상벨 현재 운영현황을 포함하지 않습니다.
- 가상 조명 지점은 공개 OSM 도로 기하를 사용해 **무작위·재현 가능하게 생성한 합성 자료**이며 ODbL 조건을 존중합니다. 실제 조명 기구와 위치가 일치한다는 주장은 하지 않습니다.

**중요:** 경로 근접도 결과는 실제 조명 밝기나 안전성을 나타내지 않습니다. 도로통행 가능 여부도 현장 검증되지 않았습니다. 실제 야간 길 안내 및 안전 판단에 사용하지 마세요.

## 데이터 범위 검토
- NGII 조명 좌표, IoT 좌표, 실제 2022년 안심 기록, API 키는 GitHub Pages용 파일에 포함하지 않았습니다.
- 실도로·POI 자료 공개는 OSM의 허용조건(ODbL 1.0)에 따라 출처를 표시하고 제공한 것입니다.
- 실제 공간정보 재배포 허가가 확인되기 전까지 최종 로컬 실행판 전체를 GitHub에 게시하지 않습니다.
