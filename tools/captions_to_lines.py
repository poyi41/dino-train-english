"""把 YouTube 自動字幕（srv3 或 json3 格式）轉成「一行一句、附秒數」的純文字，方便挑句子。

用法：
    python tools/captions_to_lines.py raw/<影片ID>.en-orig.srv3 > raw/ep01-lines.txt

每行格式：  開始秒數 - 結束秒數 | 字幕文字
自動字幕的一行常常不是一整句，挑好句子後用查詢模式取得精確秒數：
    python tools/captions_to_lines.py raw/<影片ID>.en-orig.srv3 "are we there yet" "tickets please"

請優先用 srv3：YouTube 有時給的 json3 沒有逐字時間，srv3 則一直都有。
"""

import json
import sys
import xml.etree.ElementTree as ET


def load_words_srv3(path):
    words = []
    for p in ET.parse(path).getroot().iter("p"):
        start_ms = int(p.get("t", 0))
        spans = p.findall("s")
        if spans:
            for s in spans:
                # 偶爾一段裡有好幾個字（例如 "2 3"），拆開讓片語查詢找得到
                for text in (s.text or "").split():
                    words.append(((start_ms + int(s.get("t", 0))) / 1000, text))
        elif (p.text or "").strip():
            # 沒有逐字時間的整段文字（例如 [Music]），每個字都用這段的開始時間
            for text in p.text.split():
                words.append((start_ms / 1000, text))
        else:
            words.append((None, None))  # 換行
    return words


def load_words(path):
    """回傳 [(開始秒, 文字), ...]，換行以 None 表示。"""
    if str(path).endswith(".srv3"):
        return load_words_srv3(path)

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    words = []
    for event in data.get("events", []):
        segs = event.get("segs")
        if not segs:
            continue
        start_ms = event.get("tStartMs", 0)
        for seg in segs:
            text = seg.get("utf8", "")
            if text == "\n":
                words.append((None, None))
                continue
            text = text.strip()
            if text:
                words.append(((start_ms + seg.get("tOffsetMs", 0)) / 1000, text))
    return words


def split_lines(words):
    """依字幕換行分組：回傳 [[(開始秒, 文字), ...], ...]。tools/serve.py 也會用到。"""
    lines, current = [], []
    for t, text in words:
        if t is None:
            if current:
                lines.append(current)
                current = []
        else:
            current.append((t, text))
    if current:
        lines.append(current)
    return lines


def to_lines(words):
    """依換行切成句子；每句結束時間取下一句第一個字的開始時間。"""
    lines = split_lines(words)
    result = []
    for i, line in enumerate(lines):
        start = line[0][0]
        end = lines[i + 1][0][0] if i + 1 < len(lines) else line[-1][0] + 1.5
        result.append((start, end, " ".join(w for _, w in line)))
    return result


def normalize(text):
    return "".join(c for c in text.lower() if c.isalnum())


def find_phrase(words, phrase):
    """以逐字時間找出片語的精確開始 / 結束秒數（結束取下一個字的開始，最多延後 1 秒）。"""
    timed = [(t, w) for t, w in words if t is not None]
    target = [normalize(w) for w in phrase.split()]
    results = []
    for i in range(len(timed) - len(target) + 1):
        if [normalize(w) for _, w in timed[i : i + len(target)]] == target:
            last = timed[i + len(target) - 1][0]
            nxt = timed[i + len(target)][0] if i + len(target) < len(timed) else last + 1
            results.append((timed[i][0], min(nxt, last + 1)))
    return results


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    sys.stdout.reconfigure(encoding="utf-8")
    words = load_words(sys.argv[1])

    # 多給參數時改成查詢模式：python tools/captions_to_lines.py <檔案> "are we there yet" ...
    if len(sys.argv) > 2:
        for phrase in sys.argv[2:]:
            hits = find_phrase(words, phrase)
            found = ", ".join(f"{s:.2f}-{e:.2f}" for s, e in hits) or "找不到"
            print(f"{phrase} → {found}")
        return

    for start, end, text in to_lines(words):
        print(f"{start:7.2f} - {end:7.2f} | {text}")


if __name__ == "__main__":
    main()
