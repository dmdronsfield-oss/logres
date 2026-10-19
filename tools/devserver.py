# Development server that tells the browser never to cache (so edits show on reload),
# and withholds the service worker so it can't serve stale files either.
# Usage: python3 tools/devserver.py [port]
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0].endswith('service-worker.js'):
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
