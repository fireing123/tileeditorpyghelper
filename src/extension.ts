import * as vscode from "vscode";
import * as path from "path";
import * as JSON5 from "json5";

export function activate(context: vscode.ExtensionContext) {
  vscode.workspace.onDidOpenTextDocument((document) => {
    const fileName = document.fileName;

    if (fileName.endsWith(".tilemap")) {
      showTilemapMenu(document);
    }
  });

  const disposable = vscode.commands.registerCommand(
    "tileeditorpyghelper.openEditor",
    () => {
      showTileEditor(null);
    }
  );

  context.subscriptions.push(disposable);
}

function showTileEditor(
  data: { resource: string | null; tilemap: string | null, tilePath: string | null, background?: string | null, backgroundResource?: string | null } | null
) {
  const panel = vscode.window.createWebviewPanel(
    "tileEditor",
    "Tilemap Editor",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );
  panel.webview.html = getWebviewContent(data);

  // WebView  확장 메시지 처리
  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === "readImage") {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          panel.webview.postMessage({
            command: "error",
            text: "워크스페이스가 없습니다.",
          });
          return;
        }

        const workspaceUri = workspaceFolders[0].uri;
        const imagePaths = message.paths;
        const imageResults = [];
        for (const relPath of imagePaths) {
          const fileUri = vscode.Uri.joinPath(
            workspaceUri,
            path.posix.normalize(relPath)
          );
          try {
            const img = panel.webview.asWebviewUri(fileUri);
            imageResults.push(img.toString());
          } catch (err) {
            imageResults.push(null);
          }
        }

        panel.webview.postMessage({
          command: "receiveImage",
          images: imageResults,
          key: message.key
        });
      } catch (err: any) {
        panel.webview.postMessage({
          command: "error",
          text: "파일 파싱 실패: " + err.message,
        });
      }
    } else if (message.command === "writefile") {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          panel.webview.postMessage({
            command: "error",
            text: "워크스페이스가 없습니다.",
          });
          return;
        }

        const workspaceUri = workspaceFolders[0].uri;
        const fileUri = vscode.Uri.joinPath(
            workspaceUri,
            path.posix.normalize(message.path)
          );

        const encoder = new TextEncoder();
        vscode.workspace.fs.writeFile(fileUri, encoder.encode(message.value));
    }
  });
}

function showTilemapMenu(document: vscode.TextDocument) {
  const panel = vscode.window.createWebviewPanel(
    "manage",
    "Tilemap Manage",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  const parsed = JSON5.parse(document.getText());

  panel.webview.html = getWebviewContentManage(parsed);

  // WebView  확장 메시지 처리
  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === "readfile") {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          panel.webview.postMessage({
            command: "error",
            text: "워크스페이스가 없습니다.",
          });
          return;
        }

        const workspaceUri = workspaceFolders[0].uri;
        const paths = message.paths;
        const results = [];
        for (const relPath of paths) {
          const fileUri = vscode.Uri.joinPath(
            workspaceUri,
            path.posix.normalize(relPath)
          );
          try {
            const bytes = await vscode.workspace.fs.readFile(fileUri);
            const context = new TextDecoder().decode(bytes);

            results.push(context);
          } catch (err) {
            results.push(null);
          }
        }

        const [resource, tilemap] = results;
        const editorOptions: any = {
            resource,
            tilemap,
            tilePath: paths[1],
        };

        if (results.length >= 3) {
            editorOptions.background = results[2];
        }
        if (results.length === 4) {
            editorOptions.backgroundResource = results[3];
        }

        showTileEditor(editorOptions);
        

      } catch (err: any) {
        panel.webview.postMessage({
          command: "error",
          text: "파일 파싱 실패: " + err.message,
        });
      }
    }
  });
}

// This method is called when your extension is deactivated
export function deactivate() { }

function getWebviewContentManage(
  content: { name: string; resource: string; tilemap: string }[]
) {
  const html = /* html */ `
<!DOCTYPE html>
<html lang="ko">

<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #f0f0f0;
            padding: 20px;
            max-width: 500px;
            margin: auto;
        }

        h1 {
            text-align: center;
            color: #333;
        }

        .map-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 20px;
        }

        .map-item {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .map-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .map-name {
            font-size: 1.15rem;
            font-weight: bold;
            color: #222;
        }

        .map-path {
            font-size: 0.85rem;
            color: #888;
            word-break: break-all;
        }

        .start-btn {
            background-color: #4a90e2;
            color: white;
            border: none;
            padding: 8px 14px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            height: 36px;
        }

        .start-btn:hover {
            background-color: #357abd;
        }
    </style>
</head>

<body>
    <h1>타일맵 수정 에디터</h1>
    <div class="map-list" id="mapList"></div>

    <script>
        const maps = ${ JSON.stringify(content)};
        const vscode = acquireVsCodeApi();
        const mapList = document.getElementById('mapList');



        maps.forEach(map => {
            const item = document.createElement('div');
            item.className = 'map-item';

            const info = document.createElement('div');
            info.className = 'map-info';

            const nameEl = document.createElement('div');
            nameEl.className = 'map-name';
            nameEl.textContent = map.name;

            const path1El = document.createElement('div');
            path1El.className = 'map-path';
            path1El.textContent = map.resource;

            const path2El = document.createElement('div');
            path2El.className = 'map-path';
            path2El.textContent = map.tilemap;

            info.appendChild(nameEl);
            info.appendChild(path1El);
            info.appendChild(path2El);

            if ("background" in map) {
                const path3El = document.createElement('div');
                path3El.className = 'map-path';
                path3El.textContent = map.tilemap;
                info.appendChild(path3El);
            }
            
            if ("backgroundResource" in map) {
                const path4El = document.createElement('div');
                path4El.className = 'map-path';
                path4El.textContent = map.backgroundResource;
                info.appendChild(path4El);
            }
            const keys = ["resource", "tilemap", "background", "backgroundResource"]
            const result = keys
                .filter(key => key in map)
                .map(key => map[key]);

            const button = document.createElement('button');
            button.className = 'start-btn';
            button.textContent = '시작';
            button.onclick = () => {
                vscode.postMessage({ command: 'readfile', paths: result });
            };

            item.appendChild(info);
            item.appendChild(button);

            mapList.appendChild(item);
        });
    </script>
</body>

</html>
`;
  return html;
}

function getWebviewContent(
  data: { resource: string | null; tilemap: string | null, tilePath: string | null } | null
): string {
  const html = /* html */ `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />

    <style>
        html,
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(10, 32px);
            grid-template-rows: repeat(10, 32px);
            gap: 1px;
        }

        .tile {
            width: 32px;
            height: 32px;
            background-color: lightgray;
            border: 1px solid #ccc;
        }

        .tile.active {
            background-color: blue;
        }

        .error-message {
            color: red;
            font-size: 0.9em;
            margin-top: 4px;
        }

        canvas {
            background: #f0f0f0;
            display: block;
            cursor: crosshair;
            image-rendering: pixelated;
        }

        #toolbar {
            position: absolute;
            top: 10px;
            left: 10px;
            background: white;
            padding: 10px;
            border-radius: 10px;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
            z-index: 10;
        }

        .palette {
            display: flex;
            flex-wrap: nowrap;
            /* 줄바꿈 방지 */
            overflow-x: auto;
            /* 가로 스크롤 가능하게 */
            gap: 4px;
            margin-top: 5px;
            padding-bottom: 4px;
            /* 스크롤바 여유 공간 */
        }

        .palette::-webkit-scrollbar {
            height: 6px;
        }

        .palette::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
        }

        .color-box {
            width: 48px;
            height: 48px;
            border: 2px solid #0002;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            user-select: none;
            
        }

        .selected {
            border: 2px solid black !important;
        }

        .palette-scroll {
            display: flex;
            overflow-x: auto;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            padding: 1rem;
            gap: 1rem;
            background: #f5f5f5;
        }

        .palette-scroll::-webkit-scrollbar {
            height: 8px;
        }

        .palette-scroll::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }
    </style>
    <script src="https://unpkg.com/json5@2.2.3/dist/index.min.js"></script>
</head>

<body>
    <div id="imgsaver"></div>
    <div id="error"></div>
    <div id="opener">
        <div>
            <label>Enter Tile Resource File:</label>
            <input id="tile" type="file" />
            <div class="error-message" id="tileError"></div>
        </div>
        <div>
            <label>Enter Tile Map File:</label>
            <input id="map" type="file" />
            <div class="error-message" id="mapError"></div>
        </div>
        <div>
            <button onClick="openTileMap()">Submit</button>
            <div class="error-message" id="submitError"></div>
        </div>
    </div>

    <div id="editor">
        <div id="toolbar">
            <select id="tool">
                <option value="draw">그리 기</option>
                <option value="rect">사각형</option>
                <option value="line">선분</option>
            </select>
            <button id="sbtn" class="check-button" onclick="saveButton()">저장</button>
            <input type="checkbox" id="heckbox" checked />
            <label for="heckbox" style="color: black;">줄자 표시</label>
            <label for="backcheck" style="color: black;">배경:</label>
            <select id="backcheck" name="backcheck">
                <option value="VISIBLE">그리기</option>
                <option value="INVISIBLE">그리지 않기</option>
                <option value="FOG">안개</option>
            </select>
            <div class="palette" id="palette">
                <button className="color-box" onclick="eraser()">지우개</button>
            </div>
        </div>
        <canvas id="canvas"></canvas>
    </div>

    <script>
        const palette = document.querySelector('.palette');
        palette.addEventListener('wheel', function (e) {
            if (e.deltaY === 0) return; // 세로 이동 없음 → 무시
            e.preventDefault(); // 기본 스크롤 방지
            palette.scrollLeft += e.deltaY; // 세로휠을 가로 스크롤로
        }, { passive: false });
    </script>

    <script>
        const sbutton = document.getElementById('sbtn');

        function saveButton() {
            saveFile()
            sbutton.disabled = true;
            sbutton.innerHTML = '<span class="check-icon">✔️</span>';
            
            setTimeout(() => {
                sbutton.disabled = false;
                sbutton.innerText = "저장"
            }, 500);
        }
    </script>

    <script>
        
        const vscode = acquireVsCodeApi();
        const erroror = document.getElementById('error')
        const backcheck = document.getElementById('backcheck')
        let tile = null
        let backTile = null

        let images = null
        let imageComponents = null

        let backImages = null
        let backImageComponents = null

        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');

        let tileSize = 48;
        let backgroundTiles = {};
        let tiles = {}; // 맵 타일이야

        let offsetX = window.innerWidth / 2;
        let offsetY = window.innerHeight / 2;
        let dragging = false;
        let dragStart = { x: 0, y: 0 };

        let currentTile = 1; // 타일 선택
        let currentTool = 'draw'; // 붓 ,도형
        let drawStart = null;
        let mouseX = 0, mouseY = 0;

        const checkbo = document.getElementById('heckbox');
        const imgsaver = document.getElementById('imgsaver')
        const editor = document.getElementById('editor')
        editor.style.display = 'none'
        const select = document.getElementById('tileIndex')
        const tileFile = document.getElementById('tile')
        const mapFile = document.getElementById('map')

        const tileError = document.getElementById('tileError')
        const mapError = document.getElementById('mapError')
        const submitError = document.getElementById('submitError')

        window.addEventListener('message', (event) => {
            const message = event.data;

            if (message.command === 'receiveImage') {
                if (message.key === 'main') {
                    images = message.images
                    editor.style.display = ''
                    draw();
                } else if (message.key === 'back') {
                    backImages = message.images
                }
            } else {
                erroror.innerText = message.text
            }
        })

        function resourceChange(content) {
            try {
                const parsed = JSON5.parse(content);
                vscode.postMessage({ command: 'readImage', paths: parsed[2], key: 'main' }) 
                tile = true
            } catch (err) {
                tileError.innerText = "❌ JSON5의 문법을 위반함" + err
            }
        }

        tileFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                resourceChange(content)
            };
            reader.readAsText(file, 'utf-8');
        });

        function tilemapChange(content) {
            try {
                const parsed = JSON5.parse(content);
                tiles = convertToCoordinatePlane(parsed);
            } catch (err) {
                mapError.innerText = "❌ JSON5의 문법을 위반함" + err
            }
        }

        mapFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                tilemapChange(content)
            };
            reader.readAsText(file, 'utf-8');
        });

        function backgroundAdd(content) {
            try {
                const parsed = JSON5.parse(content);
                backgroundTiles = convertToCoordinatePlane(parsed);
            } catch (err) {
                // 아몰랑 에러 뿜뿜
                console.error("background TILE JSON syntax error" + err)
            }
        }

        function backgroundResource(content) {
             try {
                const parsed = JSON5.parse(content);
                vscode.postMessage({ command: 'readImage', paths: parsed[2], key: 'back' })
            } catch (err) {
                // 아몰랑 에러 뿜뿜
                console.error("background RES JSON syntax error")
            }
        }

        function openTileMap() {
            if (tile == null) {
                submitError.innerText = "리소스 파일을 입력해주세요"
                return
            }
            submitError.innerText = ""
            document.getElementById('opener').style.display = 'none'
        }

        function eraser() { currentTile = null }

        const toolSelect = document.getElementById('tool');
        toolSelect.addEventListener('change', () => currentTool = toolSelect.value);

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            draw();
        });

        const paletteEl = document.getElementById('palette');

        const inervalId = setInterval(() => {
            if (images !== null) {
                imageComponents = new Array(images.length).fill(null)
                images.forEach((c, i) => {
                    const img = document.createElement('img');
                    img.className = 'color-box';
                    img.src = c
                    img.onclick = () => {
                        currentTile = i;
                        document.querySelectorAll('.color-box').forEach(el => el.classList.remove('selected'));
                        img.classList.add('selected');
                    };
                    const imgob = document.createElement("img")
                    imgob.onload = () => {
                        imageComponents[i] = imgob
                    }
                    imgob.src = c
                    paletteEl.appendChild(img);
                    if (i === currentTile) img.classList.add('selected');
                });
                clearInterval(inervalId)
            }
        }, 200)

        const rinervalId = setInterval(() => {
            if (backImages !== null) {
                backImageComponents = new Array(backImages.length).fill(null)
                backImages.forEach((c, i) => {
                    const imgob = document.createElement("img")
                    imgob.onload = () => {
                        backImageComponents[i] = imgob
                    }
                    imgob.src = c
                });
                clearInterval(rinervalId)
            }
        }, 200)

        canvas.addEventListener('contextmenu', e => e.preventDefault());

        canvas.addEventListener('mousedown', e => { //단순 계산
            if (e.button === 2) {
                dragging = true;
                dragStart = { x: e.clientX, y: e.clientY };
            } else if (e.button === 0) {
                const tile = screenToTile(e.clientX, e.clientY);
                drawStart = tile;
                if (currentTool === 'draw') setTile(tile.x, tile.y, currentTile);
            }
            draw();
        });

        canvas.addEventListener('mouseup', e => {
            dragging = false;
            const tile = screenToTile(e.clientX, e.clientY);
            if (drawStart) {
                if (currentTool === 'rect') fillRect(drawStart, tile);
                else if (currentTool === 'line') drawLine(drawStart, tile);
            }
            drawStart = null;
            draw();
        });

        canvas.addEventListener('mousemove', e => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (dragging) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                offsetX += dx;
                offsetY -= dy;             // ← 여기만 수정: 델타를 반대로 적용
                dragStart = { x: e.clientX, y: e.clientY };
                draw();
            } else if (e.buttons === 1 && currentTool === 'draw') {
                const tile = screenToTile(e.clientX, e.clientY);
                setTile(tile.x, tile.y, currentTile);
                draw();
            } else {
                draw();
            }
        });


        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const before = screenToTile(e.clientX, e.clientY);
            tileSize *= e.deltaY < 0 ? 1.1 : 0.9;
            tileSize = Math.max(8, Math.min(64, tileSize));
            const after = screenToTile(e.clientX, e.clientY);
            offsetX += (after.x - before.x) * tileSize;
            offsetY += (after.y - before.y) * tileSize;
            draw();
        });

        function screenToTile(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            const cx = clientX - rect.left;
            const cy = clientY - rect.top;

            // 캔버스 맨 아래를 y=0 기준선으로 보고, offsetY만큼 위로 평행이동
            const relativeY = rect.height - cy - offsetY;
            const relativeX = cx - offsetX;

            return {
                x: Math.floor(relativeX / tileSize),
                y: Math.floor(relativeY / tileSize),
            };
        }

        // 2) 타일 좌표 → 화면 픽셀 좌표 계산 헬퍼
        function tileToScreen(tx, ty) {
            // 캔버스 맨 아래를 y=0 기준선으로 보고
            const px = offsetX + tx * tileSize;
            const py = canvas.height - offsetY - (ty + 1) * tileSize;
            return { px, py };
        }

        function setTile(x, y, value) {
            if (!tiles[y]) tiles[y] = {};
            tiles[y][x] = value;
        }

        function fillRect(start, end) {
            for (let y = Math.min(start.y, end.y); y <= Math.max(start.y, end.y); y++) {
                for (let x = Math.min(start.x, end.x); x <= Math.max(start.x, end.x); x++) {
                    setTile(x, y, currentTile);
                }
            }
        }

        function drawLine(start, end) {
            let x = start.x, y = start.y;
            const dx = Math.abs(end.x - start.x);
            const dy = Math.abs(end.y - start.y);
            const sx = start.x < end.x ? 1 : -1;
            const sy = start.y < end.y ? 1 : -1;
            let err = dx - dy;
            while (true) {
                setTile(x, y, currentTile);
                if (x === end.x && y === end.y) break;
                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
        }

        function drawPreview() {
            if (!drawStart || currentTool === 'draw') return;
            const end = screenToTile(mouseX, mouseY);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';

            if (currentTool === 'rect') {
                for (let y = Math.min(drawStart.y, end.y); y <= Math.max(drawStart.y, end.y); y++) {
                    for (let x = Math.min(drawStart.x, end.x); x <= Math.max(drawStart.x, end.x); x++) {
                        const { px, py } = tileToScreen(x, y);
                        ctx.fillRect(px, py, tileSize, tileSize);
                    }
                }
            } else if (currentTool === 'line') {
                let x = drawStart.x, y = drawStart.y;
                const dx = Math.abs(end.x - x), dy = Math.abs(end.y - y);
                const sx = x < end.x ? 1 : -1, sy = y < end.y ? 1 : -1;
                let err = dx - dy;

                while (true) {
                    const { px, py } = tileToScreen(x, y);
                    ctx.fillRect(px, py, tileSize, tileSize);
                    if (x === end.x && y === end.y) break;
                    const e2 = 2 * err;
                    if (e2 > -dy) { err -= dy; x += sx; }
                    if (e2 < dx) { err += dx; y += sy; }
                }
            }
        }

        function tileDraw(tilesData, imgComponents) {
            // 타일 그리기
            for (const yStr in tilesData) {
                const ty = parseInt(yStr, 10);
                for (const xStr in tilesData[ty]) {
                    const tx = parseInt(xStr, 10);
                    const val = tilesData[ty][tx];
                    if (val !== null) {
                        const img = imgComponents[val];
                        if (!img) continue;
                        const { px, py } = tileToScreen(tx, ty);
                        ctx.drawImage(img, px, py, tileSize, tileSize);
                    }
                }
            }
        }

        // 4) draw: 모든 타일 + 격자 + preview
        function draw() {
            canvas.getContext("2d").imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 배경 그리기
            if (backcheck.value === "VISIBLE") {
                tileDraw(backgroundTiles, (backImageComponents !== null) ? backImageComponents : imageComponents);
            }

            if (backcheck.value === "FOG") {
                tileDraw(backgroundTiles, (backImageComponents !== null) ? backImageComponents : imageComponents);
                ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 타일 그리기
            tileDraw(tiles, imageComponents);
            
            // 미리보기
            drawPreview();
            // 격자 그리기
            if (checkbo.checked) {
                ctx.strokeStyle = '#ccc';
                // 수평선: y = -offsetY + k*tileSize
                for (let y = -100; y < 100; y++) {
                    const lineY = canvas.height - offsetY - y * tileSize;
                    ctx.beginPath();
                    ctx.moveTo(0, lineY);
                    ctx.lineTo(canvas.width, lineY);
                    ctx.stroke();
                }
                // 수직선: x = offsetX + k*tileSize
                for (let x = -100; x < 100; x++) {
                    const lineX = offsetX + x * tileSize;
                    ctx.beginPath();
                    ctx.moveTo(lineX, 0);
                    ctx.lineTo(lineX, canvas.height);
                    ctx.stroke();
                }
            }
        }

        function formatListAligned(arr) {
            const formattedItems = arr.map(item => {
                if (item == null) return 'null'
                return String(item).padStart(4, ' ')
            })
            return "[" + formattedItems.join(',') + "]"
        }

        function formatListIndent(arr, indent = 4) {
            const formattedItems = arr.map(item => {
                return "  ".repeat(indent) + formatListAligned(item);
            });
            return formattedItems.join(",\\n");
        }
        function quadrantsStringify(value, indent = 4) {
            const strIndent = " ".repeat(indent);
            return ["[\\n",
                strIndent , "[\\n",
                formatListIndent(value[0]), "\\n",
                strIndent ,"],\\n",
                strIndent , "[\\n",
                formatListIndent(value[1]), "\\n",
                strIndent , "],\\n",
                strIndent , "[\\n",
                formatListIndent(value[2]), "\\n",
                strIndent , "],\\n",
                strIndent , "[\\n",
                formatListIndent(value[3]), "\\n",
                strIndent , "]\\n", 
            "]"].join("")
        }
        
        function saveFile() {

            const data = convertToQuadrants(tiles);
            const jsonStr = quadrantsStringify(data);

            if (tileData !== null) {
                if (tileData.tilePath !== null) {
                    saveJSON(tileData.tilePath, jsonStr)
                    return
                }
            }
            
            downloadJSON(jsonStr)
        }

        function downloadJSON(value) {
            const blob = new Blob([value], { type: 'application/json5' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'tiles.json5';
            a.click();
        }

        function saveJSON(path, value) {
            vscode.postMessage({ command: "writefile", path: path, value })
        }

        function convertToQuadrants(coordinatePlane) {
            const quadrants = [[], [], [], []];

            for (const yStr in coordinatePlane) {
                const y = parseInt(yStr);
                const row = coordinatePlane[yStr];
            
                for (const xStr in row) {
                    const x = parseInt(xStr);
                    const val = row[xStr];
                
                    let layer, qx, qy;
                
                    if (x >= 0 && y >= 0) {
                        // 1사분면 (including y == 0)
                        layer = 0;
                        qx = x;
                        qy = y;
                    } else if (x <= -1 && y >= 0) {
                        // 2사분면
                        layer = 1;
                        qx = -x - 1;
                        qy = y;
                    } else if (x < 0 && y < 0) {
                        // 3사분면
                        layer = 2;
                        qx = -x - 1;
                        qy = -y - 1;
                    } else if (x >= 0 && y < 0) {
                        // 4사분면
                        layer = 3;
                        qx = x;
                        qy = -y - 1;
                    } else {
                        continue; // 이 조건은 실제로 불필요하지만 안전장치로 둠
                    }
                
                    // ensure rows exist
                    while (quadrants[layer].length <= qy) {
                        quadrants[layer].push([]);
                    }
                
                    // ensure cols exist
                    while (quadrants[layer][qy].length <= qx) {
                        quadrants[layer][qy].push(null);
                    }
                
                    quadrants[layer][qy][qx] = val;
                }
            }
        
            // ensure at least one row per quadrant
            for (let i = 0; i < 4; i++) {
                if (quadrants[i].length === 0) {
                    quadrants[i].push([null]);
                }
            }
        
            return quadrants;
        }



        function convertToCoordinatePlane(quadrants) {
            const coordinatePlane = {};
        
            for (let layer = 0; layer < 4; layer++) {
                const quadrant = quadrants[layer];
                if (!quadrant) continue;
            
                for (let y = 0; y < quadrant.length; y++) {
                    const row = quadrant[y];
                    if (!row) continue;
                
                    for (let x = 0; x < row.length; x++) {
                        const val = row[x];
                        if (val == null) continue;
                    
                        let coordX, coordY;
                    
                        switch (layer) {
                            case 0: // 1사분면
                                coordX = x;
                                coordY = y;
                                break;
                            case 1: // 2사분면
                                coordX = -x - 1;
                                coordY = y;
                                break;
                            case 2: // 3사분면
                                coordX = -x - 1;
                                coordY = -y - 1;
                                break;
                            case 3: // 4사분면
                                coordX = x;
                                coordY = -y - 1;
                                break;
                        }
                    
                        if (!coordinatePlane[coordY]) coordinatePlane[coordY] = {};
                        coordinatePlane[coordY][coordX] = val;
                    }
                }
            }
        
            return coordinatePlane;
        }
        
    </script>

    <script>
        const tileData = ${JSON.stringify(data)}
        if (tileData !== null) {
            if (tileData.resource !== null) resourceChange(tileData.resource)
            if (tileData.tilemap !== null) tilemapChange(tileData.tilemap)
            if ("background" in tileData) backgroundAdd(tileData.background)
            if ("backgroundResource" in tileData) backgroundResource(tileData.backgroundResource)
            openTileMap()
        }
    </script>

</body>

</html>
  `;
  return html;
}
