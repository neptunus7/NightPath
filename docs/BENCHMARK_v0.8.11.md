# NIGHTPATH 기능 벤치마킹 — 2026-11-12

공식 안내 페이지에서 확인한 기능만 기록한다. 아래 서비스 기능을 NIGHTPATH가 구현했다고 주장하지 않는다.

| 대상 | 공식 안내에서 확인된 기능 | NIGHTPATH 도입 판단 |
|---|---|---|
| Garmin Round-trip Routing | 목표 거리 입력 후 출발점으로 돌아오는 최대 3개 코스, 일부 제품은 동적 재탐색 | **현재 반영:** 최대 5개 후보, 목표 시간 기준 순환 우선. **추후:** 실시간 재탐색 |
| Komoot | One-way/Round-trip 구분, 경유지로 루프 다듬기, 노면·고도·길 유형·예상 소요시간 | **현재 반영:** 순환/왕복 카드 분리. **추후:** 경유지 직접 수정, 경사·노면 근거 시각화 |
| Strava | 스포츠 유형, 거리, 고도·노면 설정 및 이용자 활동 데이터 기반 추천 | **추후:** 검증된 경사/노면 자료가 있으면 모드에 활용. 이용자 활동·인기도 데이터는 확보하지 않음 |
| Citymapper | `Main Roads` 도보 옵션: 큰길을 우선하고 공원·강변 등 회피 시도 | **기존 반영:** OSM 태그 기반 도심 산책 우선. **개선:** 큰길과 단절된 보도 문제 검증 |
| WalkSafe+ | 안심장소 지도, 이동상황 공유, 도착 지연 알림 및 SOS 연락 기능 | **추후:** 공식 지정 시설·운영 현황 확인 후 지도 레이어와 정보 연결. 긴급지원/실시간공유 구현한 것처럼 표현 금지 |
| My Safetipin | 안전 환경 평가, 다중 경로, 지원시설 탐색 | **추후:** 실측·검증 근거가 있을 때만 안전성 평가 검토. 현재의 조명 및 2022 인프라 근접은 안전 점수 아님 |

## 관련 공식 출처
- Garmin: https://www.garmin.com/en-US/garmin-technology/maps-for-smartwatches/round-trip/
- Komoot: https://support.komoot.com/hc/en-us/articles/10207909543066-Change-the-route-direction-and-type
- Komoot: https://support.komoot.com/hc/en-us/articles/10206792140826-Plan-routes-in-the-app
- Strava: https://support.strava.com/en-us/articles/15401756-how-do-community-routes-on-strava-work
- Citymapper: https://citymapper.com/news/2407/pick-main-roads-for-your-walk-route
- WalkSafe+: https://www.manchester.gov.uk/community-safety-and-asb/walksafe
- My Safetipin: https://safetipin.com/my-safetipin-app/

## NIGHTPATH 우선 순위
1. **기능 동결 전:** 5개 이하 후보, 순환 우선·왕복 보충, 코스별 중복·시간 오차 검증, 실제 PC UI 테스트.
2. **포트폴리오:** 지도 기반 문제 해결 과정, 여러 출처 교차 검증, 2022 안전자료 현행성 한계, 조명 모델 비실측 고지.
3. **마감 후:** 노면·경사 표시, 경유지 선택·재탐색, 현재 안심시설 데이터 수집. SNS/실시간 위치 공유는 별도 개인정보·안전 설계 필요.
