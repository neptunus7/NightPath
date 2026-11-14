# GitHub 공개 저장소 — 최종 배포 점검

**대상:** NIGHTPATH v0.8.13.0 · GitHub Pages 시연판. **현재 상태: 이미 공개 배포된 저장소**입니다. 이 문서는 업로드 전과 **수정 커밋 전**에 모두 적용합니다.

## 1. 공개 가능 범위 확인

- [ ] `docs/index.html` 및 `docs/app.mjs`와 UI 모듈은 공개 시연판에 필요한 소스인지 확인
- [ ] `docs/data/osm_nowon.json`은 **실제 OSM 데이터**이고 ODbL 출처·고지가 유지되는지 확인
- [ ] 합성 조명 2개 JSON, 합성 시설 1개 JSON은 `_synthetic: true` 등 합성 표시가 있는지 확인
- [ ] NGII 수치지도 원본·추출 실좌표, IoT 실좌표, 2022 실제 안심시설 좌표를 GitHub에 게시하지 않았는지 확인
- [ ] README 대표 이미지에 실제 데모 화면/© OSM 표시가 보이는지 확인
- [ ] `.env`, API 비밀키, 개인 신상·주소, 사적 기록, 과거 로컬 데이터 ZIP/HTML 미포함 확인

## 2. 변경 파일 확인 및 테스트

```bash
python scripts/audit_public_repo.py
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
node examples/synthetic_route_demo.mjs
```

모든 검사는 프로젝트 루트에서 실행합니다. 자체 검사기 통과는 법적 공개 승인·실데이터 무혼입의 완전한 증거가 아닙니다. 누가 어떤 실좌표를 어디서 얻었는지는 별도 출처 기록으로 확인해야 합니다.

## 3. 배포 확인

- [ ] GitHub Pages 설정은 `main /docs`이고, `https://neptunus7.github.io/NightPath/` 링크가 열리는지 확인
- [ ] 데스크톱에서 지도·광원 시각화·산책 코스·자유 도착지 기능 동작 확인
- [ ] 모바일 접속 가능 여부와 PC 최적화 안내 표시 확인
- [ ] 실제 조명·조도·안전 보장으로 오인할 문구가 없는지 확인
- [ ] `README.md`, `docs/DATA_POLICY.md`, `docs/PAGES_DATA_LICENSE.md`의 배포 정보가 일치하는지 확인

## 4. Git 기록과 최종 책임

GitHub Download ZIP은 **현재 파일 상태**만 담고 과거 Git 커밋 이력은 담지 않습니다. 이전에 실좌표·비밀키를 커밋한 적이 있는지는 Git 이력을 별도로 검토해야 합니다. `.gitignore`는 새 추가를 막는 설정일 뿐, 이미 올라간 기록을 지우지 않습니다.

국토지리정보원 실제 좌표의 공개 재배포·국외반출 가능 여부는 기관 확인 전까지 보류합니다. 데이터 공개에 대한 최종 결정은 원자료 이용조건과 관련 법규를 확인한 후 진행합니다.
