# 공개 저장소의 검증 범위

- `node --test tests/*.test.mjs`: 가상 그래프를 이용한 산책 코스, 도심 제한, 루프 후보, 조명 렌더 타일 동기화, 결과창 구조, 편의점 선택 로직 테스트.
- `python -m unittest discover -s tests -p 'test_*.py'`: 가상 OSM XML 변환·로컬 서버 입출력 등 데이터 비의존 테스트.
- `node examples/synthetic_route_demo.mjs`: 인공적인 격자 경로 예시. **실제 노원구 시설 위치를 재현하지 않습니다.**
- `python scripts/audit_public_repo.py`: 공개 금지 경로 및 바이너리·지도 좌표 데이터 파일 존재 확인.

이 검증은 **로컬에서 실행되는 실제 실데이터 완성판과 구분**합니다. GitHub 저장소만으로 실제 9,193건 광원과 현행 보행망을 재현할 수 없습니다.

실측 조도, 현재 점등, 2022 안심시설의 운영, 야간 보행 안전, 모든 출발점/시간/방향의 경로 생성률은 검증하지 않았습니다.
