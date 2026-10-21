#!/usr/bin/env python3
"""Serve the static app locally, optionally under its GitHub Pages path."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
PAGES_PATH = "/compass-ammeter-theoretical-graph-utils"


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def __init__(self, *args, base_path="", **kwargs):
        self.base_path = base_path
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        original_path = self.path
        path = urlsplit(original_path).path
        if self.base_path:
            if path in ("/", self.base_path):
                self.send_response(302)
                self.send_header("Location", self.base_path + "/")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            if not path.startswith(self.base_path + "/"):
                self.send_error(404)
                return None
            self.path = original_path[len(self.base_path):]
        try:
            return super().send_head()
        finally:
            self.path = original_path

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="나침반 전류계 로컬 서버 (Python 3)")
    parser.add_argument("--port", type=int, default=8765, help="사용할 포트 (기본: 8765)")
    parser.add_argument("--pages", action="store_true", help="GitHub Pages와 같은 하위 경로에서 실행")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("포트는 1~65535 범위여야 합니다.")
    base_path = PAGES_PATH if args.pages else ""
    handler = partial(AppHandler, base_path=base_path)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        parser.exit(1, f"서버를 시작하지 못했습니다: {error}\n다른 포트로 시도하세요: --port 8766\n")
    print(f"로컬 주소: http://127.0.0.1:{args.port}{base_path}/", flush=True)
    print("파일을 수정한 뒤 브라우저를 새로고침하세요. 종료: Ctrl+C", flush=True)
    with server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료했습니다.")


if __name__ == "__main__":
    main()
