## 타일맵 에디터

# 기능
타일맵 에디터

# 준비

json5를 읽습니다.

리소스 파일의 형식은
이런식으로 요구됩니다.
{
    "tile": [
        [NAME, any, PATHS, ...]
    ]
}

경로는 상대경로로 받습니다.

./~

타일맵 파일은 좌표평면 형식으로 사분면이 구분되어있습니다.

[
    [
        [null]
    ],
    [
        [null]
    ],
    [
        [null]
    ],
    [
        [null]
    ]
]

처음 파일은 이 형식으로 열면됩니다.

# 빠르게 시작하기

.tilemap 확장자파일에

[
    {
        "name" (name)
        "resource" (path)
        "tilemap" (path)
    }
]

형태로 작성한다음
vscode에서 열면 파일 입력을 하지 않고
빠르게 에디터를 열수 있습니다.

# 배경 레이어

.tilemap 확장자 파일에

[
    {
        "name" (name)
        "resource" (path)
        "tilemap" (path)
        "background" (path) // 배경 tilemap
        "backgroundResource" (path) // 배경 resource (선택)
    }
]

backgroundResource 가 입력되지 않으면 resource 파일로 대체됩니다.