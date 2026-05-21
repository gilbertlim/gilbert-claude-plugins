---
name: crafting-html-pages
description: Use when creating HTML pages, web pages, web UI, or web components, or document-style HTML such as PR/FAQ documents, proposals, and reports.
---

# HTML / 웹 페이지 제작 규칙

HTML, 웹 페이지, 웹 컴포넌트, 문서형 HTML(PR/FAQ, 제안서, 리포트 등)을 만들 때 따르는 규칙이다.

호출 순서는 DESIGN.md 확보 → (이미지 필요 시) 이미지 생성 스킬 → 구현 스킬이다.

## When to use

- HTML 페이지, 웹 페이지, 웹 컴포넌트를 만들 때
- 문서형 HTML(PR/FAQ, 제안서, 리포트 등)을 만들 때
- MD 문서를 바탕으로 HTML 을 만들거나, MD 내용 변경을 HTML 에 반영할 때

차트나 다이어그램만 그리는 작업에는 쓰지 않는다.

## DESIGN.md 와 스킬 선택

프로젝트 루트의 DESIGN.md 를 먼저 읽는다. 없으면 사용자 글로벌 폴백 DESIGN.md 가 있으면 쓰고, 그것도 없으면 `stitch-design-taste` 스킬로 DESIGN.md 를 생성한다.
외부 도구가 필요하면 https://getdesign.md/ 를 쓴다.
색상, 타이포그래피, 간격은 DESIGN.md 토큰을 그대로 따르고 임의값을 넣지 않는다.

코드 구현은 스타일에 맞는 스킬을 호출한다.

| 상황 | 구현 스킬 |
|---|---|
| 일반 프론트엔드 기본 | `design-taste-frontend` |
| 미니멀, 에디토리얼 | `minimalist-ui` |
| 거친 기계적, 스위스 타이포 | `industrial-brutalist-ui` |
| 고급 에이전시 톤 | `high-end-visual-design` |
| GSAP 모션 중심이거나 Codex/GPT 작업 | `gpt-taste` |
| 기존 사이트, 코드베이스 개선 | `redesign-existing-projects` |
| 디자인 이미지를 먼저 만들고 그대로 구현 | `image-to-code` |

긴 코드가 잘리지 않도록 `full-output-enforcement` 를 항상 함께 적용한다.

디자인 시안이나 이미지가 필요하면 이미지 생성 스킬을 쓴다.

| 필요한 것 | 이미지 생성 스킬 |
|---|---|
| 웹사이트 시안, 목업 | `imagegen-frontend-web` |
| 모바일 화면 플로우, 프로토타입 | `imagegen-frontend-mobile` |
| 브랜드 아이덴티티 보드, 로고 시스템 | `brandkit` |

## MD 와 HTML 동기화

문서 작업은 MD 를 먼저 쓰고, 그 MD 를 바탕으로 HTML 을 만든다. MD 는 내용 중심, HTML 은 디자인 중심이다.

- 의존 방향은 한쪽이다. HTML 만 MD 에 의존하고, MD 는 HTML 에 의존하지 않는다.
- MD 내용이 바뀌면 HTML 내용도 같은 내용으로 반드시 함께 고친다.
- HTML 의 디자인 요소(레이아웃, 스타일, 손으로 다듬은 구조, MD 에 없는 시각 장치)는 MD 로 거꾸로 옮기지 않는다. HTML 디자인만 바뀔 때는 HTML 만 고친다.
- HTML 을 고칠 때 레이아웃과 스타일은 그대로 두고 바뀐 내용만 반영한다. 전체를 재생성해서 손본 부분을 날리지 않는다.
- MD 만으로 디자인이나 표현을 정하기 어려우면 임의로 채우지 말고 사용자에게 묻는다. eyebrow 문구, 줄바꿈 위치, 강조 수준처럼 MD 에 없는 판단이 여기 해당한다.

## 문서 HTML 히어로와 헤딩

문서형 HTML(PR/FAQ, 제안서, 리포트 등)의 첫 화면을 만들 때 아래를 지킨다.

- eyebrow: 제목을 몇 단어로 줄인 핵심어와 문서 종류를 적는다. 버전은 eyebrow에 넣지 않고 작성자, 작성일과 함께 메타 정보에 둔다. 항목 구분자는 가운뎃점(·)을 쓴다. 본문에서 가운뎃점을 피하더라도 eyebrow는 예외로 쓸 수 있다. 예: `신규 검색 기능 · PR/FAQ`.
- 버전 표기는 항상 `Version 0.1` 형식으로 쓴다. `버전 V0.1`, `v0.1` 같은 축약형을 쓰지 않는다.
- 한글 줄바꿈은 텍스트마다 손대지 말고 CSS로 한 번에 잡는다. `body`에 `word-break:keep-all`로 어절 중간이 끊기지 않게 하고 `text-wrap:pretty`로 본문 고아 글자를 막는다. 제목(`h1`~`h4`)에는 `text-wrap:balance`를 줘 여러 줄을 고르게 나눈다. `요?`처럼 글자 하나가 마지막 줄에 혼자 떨어지는 일을 이 규칙으로 없앤다.
- 제목: 의미 단위로 줄을 나눈다. `Design System`처럼 끊어지면 안 되는 영문 토큰만 `white-space:nowrap`으로 묶는다. 제목은 가독성이 가장 중요하다.
- 부가 설명(lead): 한 줄 폭이 너무 좁으면 시선이 자주 꺾인다. 본문보다는 좁되 한 줄에 한 호흡이 담길 만큼 넓게 잡는다(대략 50ch 안팎).
- 작성자, 작성일, 버전, 범위 같은 메타 정보는 눈에 잘 들어오게 둔다. 너무 흐리거나 작게 깔지 않는다.
- "초안", "draft"처럼 미완성을 가리키는 말은 버전 표기에 쓰지 않는다. 버전 번호로만 단계를 나타낸다.
