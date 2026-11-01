# 恐龍火車英文學習網站 — 專案規則

給 6 歲孩子在家使用的英文學習網站。用 YouTube 官方頻道 **Dinosaur Train Asia** 的影片，
搭配家長自己整理的單字卡與句子，讓孩子邊看邊學英文。

## 使用者

- 6 歲小孩，中文字還讀不快 → 以「**聽、點、跟讀**」為主，文字為輔
- 主要裝置：平板（觸控）
- 只在家裡使用，不對外公開、不上線部署

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
  （放在 `raw/` 並由 `.gitignore` 排除）
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

## 功能

1. **首頁**：所有集數的大卡片列表，標示已看完的集數（localStorage）
2. **單集頁**：上方影片，下方單字卡與句子
   - 點單字 → 唸出發音
   - 點句子 → 影片跳到 `start` 播放，到 `end` 自動暫停（方便跟讀）
3. **恐龍印章**：看完一集可以蓋一個恐龍印章
4. **恐龍圖鑑頁**：收集所有集數出現過的恐龍名稱
5. **編輯模式**（`edit.html`，大人用）：新增 / 編輯集數、句子、單字、恐龍
   - 首頁右上角淡色 ⚙️ 進入，需先答對一題乘法（記在 sessionStorage）
   - 存檔 `POST /api/episodes/<id>`（`tools/serve.py`），server 會自動把新集數加進 `episodes.json`
   - 安全限制：只接受 localhost 的存檔、檢查 Origin、只能寫 `data/episodes/epNN.json`；
     不提供 `.git`、`.claude`、`raw/`、`tools/` 等檔案。iPad 只能看、不能存
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
