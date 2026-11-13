"""Explicitly refresh the offline OSM cache."""
from osm_fetch import download, TARGET, cached
try:
    data,host=download()
    print(f'OSM 캐시 저장: {len(data["elements"])} records · {TARGET} · {host}')
except Exception as error:
    print(f'다운로드 실패: {error}')
    if cached():
        print('기존 캐시는 유지되며 앱에서 계속 사용할 수 있습니다.')
    else:raise SystemExit(1)
