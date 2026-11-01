"""恐龍火車學英文的本機 server：開網站 + 讓編輯模式直接存檔。

用法（在任何資料夾執行都可以，永遠服務這個專案資料夾）：
    python tools/serve.py          # 預設 port 8000
    python tools/serve.py 8080     # 指定 port

只用 Python 內建模組。安全限制：
- 只有這台電腦本身（localhost）可以存檔；iPad 等其他裝置只能看
- 只能寫 data/episodes/epNN.json，並自動把新集數加進 data/episodes.json
- 編輯模式的字幕面板讀 raw/ 字幕（/api/captions/<影片ID>），同樣只限這台電腦
- 不提供 .git、.claude、raw/、tools/ 等不屬於網站的檔案
"""

import ipaddress
import json
import os
import re
import socket
import sys
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

from captions_to_lines import load_words, split_lines

ROOT = Path(__file__).resolve().parent.parent
EPISODES_DIR = ROOT / "data" / "episodes"
INDEX_FILE = ROOT / "data" / "episodes.json"
EPISODE_ID = re.compile(r"^ep\d{2,}$")
SAVE_PATH = re.compile(r"^/api/episodes/(ep\d{2,})$")
CAPTIONS_PATH = re.compile(r"^/api/captions/([\w-]{11})$")
RAW_DIR = ROOT / "raw"
HIDDEN_TOP_LEVEL = {"raw", "tools"}
MAX_BODY = 1_000_000


def is_loopback(host):
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    if addr.version == 6 and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_loopback


def find_caption_file(video_id):
    """raw/ 裡這支影片的字幕：優先英文原始自動字幕（en-orig），srv3 優先（一定有逐字時間）。"""
    for name in (f"{video_id}.en-orig.srv3", f"{video_id}.en-orig.json3", f"{video_id}.en.srv3", f"{video_id}.en.json3"):
        if (RAW_DIR / name).is_file():
            return RAW_DIR / name
    matches = sorted(RAW_DIR.glob(f"{video_id}*.srv3")) + sorted(RAW_DIR.glob(f"{video_id}*.json3"))
    return matches[0] if matches else None


def write_atomic(path, text):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8", newline="\n")
    os.replace(tmp, path)


class Handler(SimpleHTTPRequestHandler):
    def send_text(self, status, message, content_type="text/plain"):
        body = message.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def can_save(self):
        return is_loopback(self.client_address[0])

    def end_headers(self):
        # 改了檔案重新整理就要看到新版，不讓瀏覽器用舊的快取
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---------- 讀取 ----------

    def is_hidden(self):
        path = unquote(self.path.split("?", 1)[0]).replace("\\", "/").lower()
        parts = [p for p in path.split("/") if p]
        return any(p.startswith(".") for p in parts) or (parts and parts[0] in HIDDEN_TOP_LEVEL)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        captions = CAPTIONS_PATH.match(path)
        if self.is_hidden():
            self.send_text(HTTPStatus.NOT_FOUND, "Not found")
        elif path == "/api/status":
            self.send_text(HTTPStatus.OK, json.dumps({"canSave": self.can_save()}), "application/json")
        elif captions:
            self.send_captions(captions.group(1))
        else:
            super().do_GET()

    def send_captions(self, video_id):
        """字幕只給這台電腦的編輯模式用；回傳 [{"words": [[秒, 字], ...]}, ...]"""
        if not self.can_save():
            self.send_text(HTTPStatus.FORBIDDEN, "字幕只在執行 server 的電腦上提供")
            return
        path = find_caption_file(video_id)
        if path is None:
            self.send_text(HTTPStatus.NOT_FOUND, "raw/ 裡沒有這支影片的字幕")
            return
        lines = [{"words": [[t, w] for t, w in line]} for line in split_lines(load_words(path))]
        body = json.dumps({"file": path.name, "lines": lines}, ensure_ascii=False)
        self.send_text(HTTPStatus.OK, body, "application/json")

    def do_HEAD(self):
        if self.is_hidden():
            self.send_error(HTTPStatus.NOT_FOUND)
        else:
            super().do_HEAD()

    # ---------- 存檔 ----------

    def do_POST(self):
        match = SAVE_PATH.match(self.path)
        if not match:
            self.send_text(HTTPStatus.NOT_FOUND, "Not found")
            return
        if not self.can_save():
            self.send_text(HTTPStatus.FORBIDDEN, "只能在執行 server 的這台電腦上存檔")
            return
        # 擋掉其他網站從瀏覽器偷送的請求：Origin 必須是這個 server 自己
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{self.headers.get('Host')}":
            self.send_text(HTTPStatus.FORBIDDEN, "不接受其他網站的存檔要求")
            return
        if self.headers.get_content_type() != "application/json":
            self.send_text(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "需要 JSON")
            return

        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BODY:
            self.send_text(HTTPStatus.BAD_REQUEST, "內容大小不正確")
            return
        text = self.rfile.read(length).decode("utf-8")

        episode_id = match.group(1)
        try:
            data = json.loads(text)
        except json.JSONDecodeError as err:
            self.send_text(HTTPStatus.BAD_REQUEST, f"JSON 格式錯誤：{err}")
            return
        if data.get("id") != episode_id:
            self.send_text(HTTPStatus.BAD_REQUEST, "檔名和內容的 id 不一致")
            return

        write_atomic(EPISODES_DIR / f"{episode_id}.json", text)
        self.add_to_index(episode_id)
        self.send_text(HTTPStatus.OK, "saved")

    def add_to_index(self, episode_id):
        index = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
        if episode_id in index["episodes"]:
            return
        index["episodes"].append(episode_id)
        ids = ", ".join(json.dumps(i) for i in index["episodes"])
        write_atomic(INDEX_FILE, f'{{\n  "episodes": [{ids}]\n}}\n')

    def log_request(self, code="-", size="-"):
        # 只記錄存檔與錯誤，避免每個檔案都洗版
        if self.command == "POST" or str(getattr(code, "value", code))[0] in "45":
            super().log_request(code, size)


class DualStackServer(ThreadingHTTPServer):
    """同時接受 IPv4 與 IPv6，讓 localhost 和區網的 iPad 都連得到。"""

    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


def lan_addresses():
    try:
        infos = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
    except socket.gaierror:
        return []
    return sorted({info[4][0] for info in infos if not info[4][0].startswith("127.")})


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(Handler, directory=str(ROOT))
    with DualStackServer(("::", port), handler) as server:
        print(f"恐龍火車學英文 server 已啟動（資料夾：{ROOT}）")
        print(f"  這台電腦：http://localhost:{port}")
        for ip in lan_addresses():
            print(f"  iPad（同一個 Wi-Fi）：http://{ip}:{port}")
        print("按 Ctrl+C 停止")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止")


if __name__ == "__main__":
    main()
