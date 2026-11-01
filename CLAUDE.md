# 恐龍火車英文學習網站 — 專案規則

給 6 歲孩子在家使用的英文學習網站。用 YouTube 官方頻道 **Dinosaur Train Asia** 的影片，
搭配家長自己整理的單字卡與句子，讓孩子邊看邊學英文。

## 使用者

- 6 歲小孩，中文字還讀不快 → 以「**聽、點、跟讀**」為主，文字為輔
- 主要裝置：平板（觸控）
- 孩子用的頁面發布到 GitHub Pages（靜態網站），iPad 在任何地方都能用；編輯一律在家裡電腦做，
  `git push` 後網路版才會更新
- 網路版只有孩子的頁面：編輯模式只在 localhost 開放（`js/env.js` 的 `isLocalComputer`），
  ⚙️ 在其他網址不顯示。所有路徑都要用相對路徑（網站放在 `/<repo 名稱>/` 底下）
- 根目錄的 `.nojekyll` 讓 GitHub Pages 原樣提供檔案，不要刪

## 技術限制（必須遵守）

- **前端為主**：HTML + CSS + 原生 JavaScript。不用資料庫、不用打包工具或框架。
  唯一的後端是 `tools/serve.py`（只用 Python 內建模組），負責開網站與編輯模式存檔，
  不要再加其他後端功能；孩子用的頁面不能依賴它的 API（用一般 `http.server` 也要能看）
- **影片**：一律用 YouTube IFrame Player API 嵌入。**不下載、不轉存、不重新上傳影片**
- **每集內容**：一集一個 JSON 檔，放在 `data/episodes/epXX.json`（兩位數，如 `ep01.json`）
- **發音**：瀏覽器內建 Web Speech API（`speechSynthesis`，`lang = "en-US"`），不使用外部 TTS 服務
- **執行方式**：`python tools/serve.py`，然後開 `http://localhost:8000`
  （IFrame API 不能在 `file://` 下運作）。server 永遠服務它所在的專案資料夾，不管從哪裡執行
- **字幕檔**：下載的字幕檔只當整理教材的原始資料，**不放進網站、不 commit 進 repo**
  （放在 `raw/` 並由 `.gitignore` 排除）。唯一例外：編輯模式的字幕面板透過
  `GET /api/captions/<videoId>` 讀取，只限執行 server 的那台電腦；孩子的頁面與 iPad 都讀不到
- **進度儲存**：只用 `localStorage`，不收集、不傳送任何資料到外部

## 介面原則（平板 + 6 歲）

- 按鈕大：可點區域至少 64×64 px，按鈕之間留足間距，避免誤觸
- 字大：英文主要字 ≥ 32px，中文輔助字較小、顏色較淡
- 每個可點的東西都要有即時回饋（按下動畫、聲音或顏色變化）
- 以圖示（emoji）和顏色引導，不依賴閱讀長文字
- 不用 hover 才出現的功能；不用雙擊、長按等難操作的手勢
- 不出現外部連結或會讓孩子離開網站的元素（YouTube 嵌入設定 `rel=0` 等，盡量減少推薦影片）

## 每集 JSON 格式

```json
{
  "id": "ep01",
  "episode": 1,
  "videoId": "YouTube 影片 ID",
  "title": { "en": "English title", "zh": "中文標題" },
  "dinosaurs": [
    { "en": "Tyrannosaurus", "zh": "暴龍", "emoji": "🦖" }
  ],
  "words": [
    { "en": "train", "zh": "火車", "time": 42, "emoji": "🚂" }
  ],
  "sentences": [
    { "en": "All aboard!", "zh": "大家上車！", "start": 55.2, "end": 57.8 }
  ]
}
```

- 時間單位一律為**秒**（可有小數）
- `dinosaurs` 供「恐龍圖鑑」彙整；以 `en` 名稱為唯一鍵去重
- 所有集數清單另存於 `data/episodes.json`（純前端無法列出資料夾內容）

## 內容選擇標準（小學一年級程度）

每集的單字與句子都照這個標準挑，新增或修改集數時也一樣：

- **單字（每集 6～8 個）**：具體、能用 emoji 表示的字。優先低年級常見主題：
  動物、食物、顏色、數字、家人、身體、天氣、自然、交通，以及基本動作（eat, run, fly, swim, sleep, look）
  與基本形容詞（big, small, hot, cold, fast, happy）。不選抽象字、專有名詞；恐龍名稱放 `dinosaurs`，不當單字
- **句子（每集 5～7 句）**：2～6 個字、1～3 秒內說完的生活用語或簡單句型
  （I like…、Let's…、Look!、I'm…、Can I…?、Thank you!、Good night!）。不選難字、長句、俚語
- **一定要聽得清楚**：不選歌曲段落（片頭曲約 1:25～2:20、片尾曲）、多人同時說話、背景音樂很大的地方；
  自動字幕看起來有錯字、不確定實際說了什麼的句子不選
- **中文翻譯**：口語、簡短，用孩子聽得懂的說法
- 常用句可以跨集重複出現（重複有助學習），同一集內不重複
- **恐龍**：該集出場或被提到的恐龍，包含主角一家；中文用台灣常用譯名

## 功能

1. **首頁**：所有集數的大卡片列表，顯示「⭐ 已看完 / 總集數」，看完的卡片有 ⭐，看到一半有進度條
2. **單集頁**：上方影片，下方單字卡與句子
   - 點單字 → 唸出發音
   - 點句子 → 影片跳到 `start` 播放，到 `end` 自動暫停（方便跟讀）
   - **看完判斷**：累計播放秒數（`dinoTrain.progress`，跨次累加）達影片長度 85% 就算看完。
     不用播放位置判斷（跟讀句會跳到後段、孩子會拉進度條）。小火車進度條顯示進度
   - 頁尾「大人用：標記這集已看完」（答一題加法）
3. **恐龍印章**（`js/stamp.js`、`stamps.html`）：看完時跳出蓋章畫面，**孩子自己點**才蓋下去
   （iPad 只允許點擊時發聲），印章是那集 `dinosaurs[0]`（主角恐龍）。印章簿每集一格
4. **恐龍圖鑑**（`dex.html`）：`data/dinosaurs.json` 的每種恐龍一張卡，看過有牠出現的集數就解鎖；
   沒解鎖顯示剪影（`filter: brightness(0)`，所以插圖最好是透明背景）
   - 插圖在 `assets/dinosaurs/<名稱>.webp`，來自 Wikimedia Commons，**只用 CC0 / 公有領域 / CC BY / CC BY-SA**；
     優先 TotalDino 的「<學名> TD.png」系列（風格一致、透明背景）。不可用節目角色圖
   - 每張圖都要在 `data/dinosaurs.json` 的 `credit` 寫作者、授權、來源與修改備註，`credits.html` 會列出來
   - 新恐龍出現在新集數時：把牠加進 `data/dinosaurs.json`（含插圖與 credit），否則圖鑑不會出現
5. **編輯模式**（`edit.html`，大人用）：新增 / 編輯集數、句子、單字、恐龍
   - 首頁右上角淡色 ⚙️ 進入，需先答對一題乘法（記在 sessionStorage）
   - 存檔 `POST /api/episodes/<id>`（`tools/serve.py`），server 會自動把新集數加進 `episodes.json`
   - 安全限制：只接受 localhost 的存檔、檢查 Origin、只能寫 `data/episodes/epNN.json`；
     不提供 `.git`、`.claude`、`raw/`、`tools/` 等檔案。iPad 只能看、不能存
   - 字幕面板（`js/caption-panel.js`）：顯示 `raw/<videoId>.en-orig.srv3`（沒有才用 json3），跟著影片標亮；
     選取文字按 ➕ 加成句子，秒數依逐字時間計算（開始 −0.3 秒、結束 +0.5 秒，與 `tools/captions_to_lines.py` 一致）
   - 沒用 `serve.py` 時的備案：File System Access API（電腦版 Edge / Chrome，要選資料夾）→ 下載 JSON
   - 存出的 JSON 固定欄位順序、陣列每筆一行（見 `formatEpisode()`），手動編輯時請保持同樣格式

## 程式慣例

- 原生 ES Modules（`<script type="module">`），不引入第三方套件
- 檔名小寫加連字號（`episode-page.js`）；變數與函式用 camelCase
- localStorage 的 key 一律加前綴 `dinoTrain.`，集中在 `js/storage.js` 讀寫並用 try/catch 包起來
- 已知注意事項：
  - iPad Safari 的 `speechSynthesis` 必須由使用者點擊觸發；語音清單是非同步載入（`voiceschanged`）
  - 句子自動暫停：IFrame API 沒有「播到某秒」事件，需在播放中定時檢查 `getCurrentTime()`
  - 部分影片可能被頻道關閉嵌入，加入新集數時要先確認可以嵌入播放
