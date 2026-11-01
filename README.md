# 恐龍火車學英文

給孩子在家用的英文學習網站：看 Dinosaur Train Asia 影片，點單字聽發音、點句子跟讀。

## 啟動

YouTube IFrame API 不能用 `file://` 開，必須透過本機 server：

```bash
python -m http.server 8000
```

電腦上開 <http://localhost:8000>。

### 用平板看

平板與電腦連同一個 Wi-Fi，電腦端改成：

```bash
python -m http.server 8000 --bind 0.0.0.0
```

在電腦查 IP（Windows：`ipconfig` 看「IPv4 位址」），平板開 `http://<電腦IP>:8000`。
第一次啟動 Windows 可能會詢問防火牆，選「私人網路」允許即可。

## 新增一集

1. 在 YouTube 上確認影片可以嵌入播放，複製網址 `watch?v=` 後面的 11 碼影片 ID
2. 複製 `data/episodes/ep01.json` 成新檔（如 `ep02.json`），填入內容（格式見 `CLAUDE.md`）
3. 在 `data/episodes.json` 的 `episodes` 陣列加上 `"ep02"`

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
