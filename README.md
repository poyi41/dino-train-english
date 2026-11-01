# 恐龍火車學英文

給孩子在家用的英文學習網站：看 Dinosaur Train Asia 影片，點單字聽發音、點句子跟讀。

## 啟動

YouTube IFrame API 不能用 `file://` 開，必須透過本機 server。在專案資料夾執行：

```bash
python tools/serve.py
```

電腦上開 <http://localhost:8000>。使用期間這個視窗不要關，按 Ctrl+C 停止。

### 用平板看

平板與電腦連同一個 Wi-Fi，啟動時畫面會印出「iPad（同一個 Wi-Fi）」的網址，在平板開那個網址。
第一次啟動 Windows 可能會詢問防火牆，選「私人網路」允許即可。平板只能看，不能編輯存檔。

## 編輯模式（新增一集、改句子）

請在**執行 server 的那台電腦**上操作（任何瀏覽器都可以）：

1. 首頁右上角淡色的 ⚙️ → 回答乘法題進入
2. 點要改的集數；或在「新增一集」貼上 YouTube 網址
3. 邊播影片邊整理：
   - 句子：影片播到開頭按「開始」的 ⏱，講完按「結束」的 ⏱，再按 ▶ 試播；用 − / + 每次微調 0.1 秒
   - 單字：🔊 聽發音、🎬 從出現的地方播放
   - 字幕：先照下面「用字幕找句子和秒數」抓字幕到 `raw/`，影片右邊就會出現字幕面板。
     用滑鼠選取幾個字（可以跨行）按 ➕，就加成一句跟讀句、秒數自動算好；之後補標點和中文
4. 按右下角 💾 儲存，直接寫回 `data/`
5. 按 👀 打開孩子看到的畫面確認（已開著的頁面要重新整理）

如果是用 `python -m http.server` 啟動，存檔會改成要你選專案資料夾（只有 Edge / Chrome 支援），
其他瀏覽器則會下載 JSON 讓你手動放進 `data/episodes/`。用 `tools/serve.py` 就沒有這些步驟。

字幕原始檔請放在 `raw/`，該資料夾不會進 git，也不會被網站使用。

### 用字幕找句子和秒數

需要先安裝 yt-dlp（`pip install yt-dlp`）。只抓字幕、不下載影片：

```bash
yt-dlp --skip-download --ignore-no-formats-error --write-auto-subs --sub-langs en-orig --sub-format json3 --extractor-args "youtube:player_client=web_embedded" -o "raw/%(id)s" "https://www.youtube.com/watch?v=<影片ID>"
```

- 這個頻道是兒童影片，yt-dlp 預設的方式會說「This video is not available」，所以要加 `player_client=web_embedded`
- 這個頻道只有 YouTube 自動字幕，會有錯字（尤其恐龍名字），句子要自己對照影片修正

把字幕轉成一行一行附秒數的文字，挑句子用：

```bash
python tools/captions_to_lines.py raw/<影片ID>.en-orig.json3 > raw/epXX-lines.txt
```

挑好句子後查精確秒數（依每個字的時間計算）：

```bash
python tools/captions_to_lines.py raw/<影片ID>.en-orig.json3 "are we there yet" "tickets please"
```

填進 JSON 時，`start` 建議往前 0.3 秒、`end` 往後 0.5 秒，避免頭尾的字被切掉。
