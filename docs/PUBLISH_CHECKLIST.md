# GitHub 업로드 전 반드시 수행할 점검

이 폴더는 사용자가 업로드할 수 있도록 만든 **공개 검토용 패키지**입니다. 자동으로 GitHub 저장소가 생성되거나 게시된 상태가 아닙니다.

1. **ZIP을 별도 새 폴더에 압축 해제**합니다. 기존 NIGHTPATH 실행용 ZIP 전체를 복사하지 마세요.
2. 터미널에서 `python scripts/audit_public_repo.py`를 실행해 데이터 확장자·보호 경로·비정상 파일 추가가 없는지 검사합니다.
3. `node --test tests/*.test.mjs`와 `python -m unittest discover -s tests -p 'test_*.py'`를 실행합니다(실제 로컬 공간정보가 없는 공개 검증의 범위).
4. 새 **빈 GitHub 저장소**를 만듭니다. **이전 로컬 프로젝트의 `.git` 디렉터리/커밋 기록을 복사하지 않습니다.** 과거 커밋에 좌표가 있었다면 `.gitignore`로 해결되지 않습니다.
5. 압축 해제된 파일들만 새 저장소로 옮깁니다. `nowon/data/.gitkeep` 외에는 실제 데이터 파일이 없어야 합니다. `src/`, `versions/`, `raw_data/`, 스크린샷, ZIP 자체, API 키 없음 확인.
6. `git add .` 후 반드시 `git status --short` 및 `git diff --cached --name-only`로 모든 경로를 확인합니다. `git add -f`, GitHub 웹 업로드, ZIP/Release 첨부는 보호 검사 우회 위험이 있습니다.
7. 코드 공개 라이선스 MIT와 OSM/Leaflet/NGII 각각의 조건을 혼동하지 않았는지 README와 `docs/DATA_POLICY.md`를 함께 공개합니다.
8. GitHub Pages/Actions나 라이브 데모 호스팅은 **기본적으로 만들지 않습니다.** 데이터/지도 서버·타일 정책과 재배포 범위를 별도 확인하고 나서 결정합니다.
9. 국토지리정보원/관련기관의 **국외반출 및 가공 좌표 재배포 답변**이 도착하기 전 NGII 관련 `json`, `geojson`, `shp` 등을 수동 업로드하지 않습니다. 비공개 저장소 역시 자동 허용이 아님을 기억하세요.
10. 프로젝트를 공개하는 최종 권한과 저작권 표기 내용은 사용자 본인이 확인해 결정합니다.

### 참고 명령

```bash
python scripts/audit_public_repo.py
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
# 아래는 저장소 새로 만들고 모든 파일을 직접 확인한 다음에만!
git init
git add .
git diff --cached --name-only
```

`git push` 전에는 README의 개인 경험 공개 수준도 함께 확인하세요.
