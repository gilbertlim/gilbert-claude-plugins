# claude-plugins

개인 Claude Code 스킬과 mod 모음. 하나마다 플러그인 하나로 분리되어 있어, 원하는 것만 골라 설치할 수 있다.

이 저장소는 Claude Code 마켓플레이스다. `plugins/` 아래에 플러그인이 들어 있고, 플러그인마다 스킬 하나나 mod 하나를 담는다.

## 설치

Claude Code에서:

```
/plugin marketplace add gilbertlim/gilbert-claude-plugins
/plugin install crafting-html-pages@gilbert-claude-plugins
/plugin install worktree-board@gilbert-claude-plugins
```

## 플러그인 목록

| 플러그인 | 설명 |
|---|---|
| `crafting-html-pages` | HTML 페이지, 웹 UI, 문서형 HTML(PR/FAQ, 제안서, 리포트) 제작 규칙 |
| `worktree-board` | Orca 워크트리와 에이전트 세션 진행을 상태줄과 좁은 패널에 띄우는 mod |

### crafting-html-pages

- 작업 순서: DESIGN.md 확보 → (필요 시) 이미지 생성 → 구현
- 스타일에 맞는 구현 스킬과 이미지 생성 스킬 선택
- MD 와 HTML 동기화 규칙 (MD 가 내용의 원본, HTML 은 그 내용을 따름)
- 문서형 HTML 의 히어로와 헤딩 규칙 (eyebrow, 버전 표기, 한글 줄바꿈 CSS, 메타 정보)

자세한 내용은 [`plugins/crafting-html-pages/skills/crafting-html-pages/SKILL.md`](plugins/crafting-html-pages/skills/crafting-html-pages/SKILL.md) 참고.

### worktree-board

Orca 로 띄운 워크트리와 그 안의 에이전트 세션이 어디까지 왔는지를 30초마다 보여 준다.

- 상태줄: `3 worktrees(1 done, 2 in progress) | 2 need review`
- `/worktree-board`: 오른쪽에 좁은 패널을 연다. 워크트리마다 레포, 브랜치, 커밋 수, 리뷰 차수, 터미널(세션)별 상태와 탭 제목
- 진행 구분: 터미널이 돌거나 미커밋이 있으면 in progress, 리뷰어가 판정을 쓰는 중이면 reviewing, 승인이나 신뢰를 묻고 서 있으면 blocked, 커밋이 있고 다 쉬면 done
- 리뷰 구분: 한 번도 안 받았거나 판정 뒤에 커밋이 올라왔으면 need review

필요한 것: Orca 의 `orca` CLI, 그리고 `orca-worktree-flow` 플러그인(`status.sh --summary` 를 읽는다). 터미널 상태는 Claude Code 화면의 끝 상태 줄(`✻ …(4m 53s` 는 돎, `✻ Worked for …` 는 쉼)로 정하므로 그 문구가 바뀌면 `hooks/parse.ts` 의 `screenState` 를 고친다.

테스트: `claude plugin test plugins/worktree-board`

## 스킬이나 mod 추가하기

`plugins/` 아래에 새 폴더를 만들고 `.claude-plugin/plugin.json` 과 `skills/<이름>/SKILL.md`(스킬) 또는 `hooks/hooks.json` 과 그 모듈(mod)을 넣은 뒤, `.claude-plugin/marketplace.json` 의 `plugins` 배열에 등록한다.

## 라이선스

MIT
