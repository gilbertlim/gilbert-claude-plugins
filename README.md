# claude-plugins

개인 Claude Code 스킬 모음. 스킬마다 플러그인 하나로 분리되어 있어, 원하는 스킬만 골라 설치할 수 있다.

이 저장소는 Claude Code 마켓플레이스다. `plugins/` 아래에 플러그인이 들어 있고, 플러그인마다 스킬 하나를 담는다.

## 설치

Claude Code에서:

```
/plugin marketplace add gilbertlim/claude-plugins
/plugin install crafting-html-pages@gilbert-plugins
```

## 플러그인 목록

| 플러그인 | 설명 |
|---|---|
| `crafting-html-pages` | HTML 페이지, 웹 UI, 문서형 HTML(PR/FAQ, 제안서, 리포트) 제작 규칙 |

### crafting-html-pages

- 작업 순서: DESIGN.md 확보 → (필요 시) 이미지 생성 → 구현
- 스타일에 맞는 구현 스킬과 이미지 생성 스킬 선택
- MD 와 HTML 동기화 규칙 (MD 가 내용의 원본, HTML 은 그 내용을 따름)
- 문서형 HTML 의 히어로와 헤딩 규칙 (eyebrow, 버전 표기, 한글 줄바꿈 CSS, 메타 정보)

자세한 내용은 [`plugins/crafting-html-pages/skills/crafting-html-pages/SKILL.md`](plugins/crafting-html-pages/skills/crafting-html-pages/SKILL.md) 참고.

## 스킬 추가하기

`plugins/` 아래에 새 폴더를 만들고 `.claude-plugin/plugin.json` 과 `skills/<이름>/SKILL.md` 를 넣은 뒤, `.claude-plugin/marketplace.json` 의 `plugins` 배열에 등록한다.

## 라이선스

MIT
