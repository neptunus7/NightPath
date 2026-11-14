# 데이터 공개·국외반출·이용허락 점검표

**현행 공개 저장소 기준: NightPath v0.8.13.0 GitHub Pages (2026-11-14).** 이 문서는 파일 공개 현황을 설명하며 법적 허가·보안 승인을 대신하지 않습니다. 과거 코드 전용 공개 패키지와 현재 웹 데모의 포함 파일은 다릅니다.

| 자산 | 공개 저장소 포함 여부 | 적용 조건·판단 |
|---|---|---|
| 자체 NIGHTPATH 코드 | **포함** (`nowon/`, `docs/`, 테스트 등) | `LICENSE`의 MIT는 자체 코드에 적용. 외부 자료에는 미적용 |
| OpenStreetMap 도로·편의점·일부 OSM 조명 태그 | **포함** (`docs/data/osm_nowon.json`) | © OpenStreetMap contributors, ODbL 1.0; 앱 지도에 출처 표시 및 가공 DB의 ODbL 명시 |
| 합성 조명 | **포함** (`docs/data/lights_synthetic.json` 4,515건, `extra_lights_synthetic.json` 70건) | 공개 OSM 도로기하를 참고해 생성한 시연 위치; **실제 가로등/보안등 좌표 아님** |
| 합성 안심시설·구간 | **포함** (`docs/data/safety_synthetic.json`) | 시연용 합성 시설 12건·구간 2건; 실제 CCTV/시설 위치 아님 |
| README 대표 이미지 | **포함** (`nightpath-readme-screenshot.png`) | 실제 데모 스크린샷. OSM 타일·Leaflet 출처 표기를 화면에서 유지하고 지도 타일 사용 정책에 유의 |
| Leaflet 1.9.4 | **CDN 로딩 코드 포함**, 라이브러리 파일은 미포함 | BSD-2-Clause 고지 및 원출처 링크 |
| OSM 배경 타일 | **타일 파일 미포함**, 브라우저에서 요청 | OSMF 타일 사용정책(표시·트래픽·캐시)을 준수할 필요 |
| 국토지리정보원 2025 수치지도 및 추출 실제 조명좌표 | **미포함** | 공공누리 제1유형과 별도로 측량성과 국외반출 규정 검토 필요. 확인 전 공개 보류 |
| NGII 파생 도로중심선·도엽 경계·좌표 기반 상세 가공자료 | **미포함** | 원본 자료에서 파생된 좌표·기하형 자료의 공개 보류 |
| 노원구 스마트보안등 IoT 실제 센서 좌표 | **미포함** | 개별 원천·국외 업로드·재사용 조건과 측정값 의미 검증 후 재검토 |
| 2022년 실제 안심시설·안심귀갓길 좌표 | **미포함** | 운영현황·재배포 조건 미확인으로 제외 |
| 개인 비밀키·로컬 설정 파일 | **미포함** | 비밀키·토큰·`.env` 등 게시 금지 |
| 과거 로컬 `src/`, `versions/` 전체 데이터 포함 스냅샷 | **미포함** | 실좌표·개인 기록 내장 가능성으로 제외 |

## 확인해야 할 원칙

1. **공공누리 제1유형과 측량성과 국외반출 여부는 구분**합니다. 국토지리정보원 실제 좌표의 GitHub 업로드·재배포는 별도의 기관 판단이 필요할 수 있어 현재 제외했습니다.
2. `docs/data/osm_nowon.json`은 실제 OSM 자료입니다. ODbL 1.0 표시와 OpenStreetMap 기여자 출처를 보존해야 하며, GitHub 공개와 별개로 OSM·타일 이용조건을 계속 준수합니다.
3. `docs/data/*synthetic.json`은 조명시설 실제 분포·점등·조도·안전을 증명하지 않습니다. 파일명과 JSON 메타데이터에서 합성 자료임을 구분합니다.
4. README 대표 이미지에는 지도 타일이 보입니다. 현재 공개 이미지의 저작권·타일 제공 정책은 계속 확인해야 하며 이 문서가 재배포 면책을 보장하지 않습니다.
5. **공개 검사 스크립트는 파일 패턴과 메타데이터를 검사**할 뿐, 과거 Git 이력·원본 데이터의 법적 출처·모든 비밀정보를 자동 인증하지 않습니다.
6. 개인 사건 경험의 공개 서술 수준은 작성자 본인이 확인합니다. 정확한 거주 위치·신상 정보는 공개하지 않습니다.

## 참고 링크

- [공공데이터포털: 국토지리정보원 수치지도 V2.0](https://www.data.go.kr/data/15059719/fileData.do)
- [공공누리 안내](https://www.kogl.or.kr/info/userGuide.do)
- [OpenStreetMap © / ODbL](https://www.openstreetmap.org/copyright)
- [ODbL 1.0 전문](https://opendatacommons.org/licenses/odbl/1-0/)
- [OSM 타일 사용 정책](https://operations.osmfoundation.org/policies/tiles/)
- [Leaflet 라이선스](https://github.com/Leaflet/Leaflet/blob/main/LICENSE)

추가 공개 여부는 해당 데이터의 원천기관, 사용 조건, 법적 규정에 따라 결정합니다.
