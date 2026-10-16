"""Opt-in local media acceptance against a disposable, secret-free Laravel copy."""

import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def copy_application(source, destination):
    """Explicit allowlist: never traverse environment, storage or bootstrap caches."""
    if destination.resolve().is_relative_to(source.resolve()):
        raise ValueError('The disposable application must be outside the source API')
    for name in ('app', 'config', 'routes', 'resources', 'tests', 'vendor',
                 'database/factories', 'database/migrations', 'database/seeders'):
        shutil.copytree(source / name, destination / name, symlinks=True,
                        ignore=shutil.ignore_patterns('.env*', '*.sqlite*', '__pycache__'))
    for name in ('artisan', 'composer.json', 'composer.lock', 'phpunit.xml',
                 'bootstrap/app.php', 'bootstrap/providers.php', 'public/index.php'):
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, target)
    for name in ('bootstrap/cache', 'storage/app/private', 'storage/framework/cache/data',
                 'storage/framework/sessions', 'storage/framework/views', 'storage/logs',
                 'storage/framework/testing/chat-browser'):
        (destination / name).mkdir(parents=True, exist_ok=True)
    (destination / '.g26-isolated').write_text('Disposable synthetic G26 runtime\n')
    # Only the disposable copy uses SQLite across HTTP and a separate worker.
    # IMMEDIATE avoids upgrading a stale DEFERRED read transaction into a writer.
    config = destination / 'config/database.php'
    config.write_text(config.read_text().replace("'busy_timeout' => null", "'busy_timeout' => 30000")
                      .replace("'journal_mode' => null", "'journal_mode' => 'WAL'")
                      .replace("'transaction_mode' => 'DEFERRED'", "'transaction_mode' => 'IMMEDIATE'"))


def environment(api, origin):
    return {
        'PATH': os.environ['PATH'], 'LANG': 'C.UTF-8', 'APP_ENV': 'testing',
        'APP_KEY': 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        'APP_DEBUG': 'false', 'APP_URL': origin, 'BCRYPT_ROUNDS': '4',
        'DB_CONNECTION': 'sqlite', 'DB_DATABASE': str(api / 'storage/framework/testing/chat-browser/fixture.sqlite'),
        'DB_URL': '', 'CACHE_STORE': 'file', 'SESSION_DRIVER': 'file',
        'MAIL_MAILER': 'array', 'QUEUE_CONNECTION': 'database',
        'CHAT_MEDIA_ENABLED': 'true', 'CHAT_MEDIA_DISK': 'local',
        'CHAT_MEDIA_CLAMAV_HOST': '127.0.0.1', 'CHAT_MEDIA_CLAMAV_PORT': '13310',
        'SANCTUM_STATEFUL_DOMAINS': '', 'LOG_CHANNEL': 'single', 'LOG_LEVEL': 'error',
        'CORS_ALLOWED_ORIGINS': 'http://localhost:8765,http://localhost:8766',
        'PULSE_ENABLED': 'false', 'TELESCOPE_ENABLED': 'false', 'NIGHTWATCH_ENABLED': 'false',
    }

class Runtime:
    def __init__(self, source, workspace, port):
        self.root = Path(tempfile.mkdtemp(prefix='run-', dir=workspace)).resolve()
        self.api = self.root / 'api'
        self.origin = f'http://127.0.0.1:{port}'
        self.port = port
        copy_application(source, self.api)
        self.fixture = self.api / 'storage/framework/testing/chat-browser'
        self.environment = environment(self.api, self.origin)
        self.server = self.worker = None
        self.logs = []
        self.opener = urllib.request.build_opener(NoRedirect)
        self.command(['php', str(Path(__file__).with_name('fixture.php')), 'seed'], 'seed')
        self.manifest = json.loads((self.fixture / 'fixture.json').read_text())

    def command(self, args, label):
        with (self.root / f'{label}.log').open('ab') as log:
            result = subprocess.run(args, cwd=self.api, env=self.environment,
                                    stdout=log, stderr=subprocess.STDOUT, timeout=120)
        if result.returncode:
            raise RuntimeError(f'{label} failed; inspect its restricted log')

    def control(self, operation):
        self.command(['php', str(Path(__file__).with_name('fixture.php')), operation], operation)

    def spawn(self, args, label, overrides=None):
        # PHP's development server logs requested private URLs; suppress access logs.
        log = open(os.devnull, 'ab') if label == 'http' else (self.root / f'{label}.log').open('ab')
        self.logs.append(log)
        return subprocess.Popen(args, cwd=self.api, env=self.environment | (overrides or {}),
                                stdout=log, stderr=subprocess.STDOUT, start_new_session=True)

    @staticmethod
    def stop(process):
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)

    def start_api(self, **overrides):
        self.stop(self.server)
        self.server = self.spawn(['php', '-d', 'upload_max_filesize=32M', '-d', 'post_max_size=34M',
                                  '-S', f'127.0.0.1:{self.port}', '-t', 'public', 'public/index.php'],
                                 'http', overrides)
        for _ in range(100):
            if self.server.poll() is not None:
                raise RuntimeError('Isolated HTTP server failed to start')
            try:
                self.request('GET', '/api/v1/customer/chat-attachments', 'customer')
                return
            except OSError:
                time.sleep(.1)
        raise RuntimeError('Isolated HTTP server did not become reachable')

    def start_worker(self, **overrides):
        self.stop(self.worker)
        self.worker = self.spawn(['php', 'artisan', 'queue:work', 'media', '--queue=media',
                                  '--sleep=1', '--timeout=180', '--memory=256'], 'worker', overrides)

    def request(self, method, path, role=None, body=None, headers=None):
        if not path.startswith('/api/v1/') or '?' in path or '#' in path:
            raise ValueError('Only fixed local API paths are allowed')
        request_headers = {'Accept': 'application/json'} | (headers or {})
        if role:
            request_headers['Authorization'] = 'Bearer ' + self.manifest['tokens'][role]
        if isinstance(body, dict):
            body = json.dumps(body).encode()
            request_headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(self.origin + path, body, request_headers, method=method)
        try:
            response = self.opener.open(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read(32 * 1024 * 1024 + 1)

    def close(self):
        self.stop(self.server)
        self.stop(self.worker)
        if (self.fixture / 'fixture.json').exists():
            self.control('cleanup')
        for path in self.root.glob('*-session.json'):
            path.unlink()
        for log in self.logs:
            log.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-source', type=Path)
    parser.add_argument('--renew', type=Path, help='Mint fresh client test sessions after an actual logout')
    parser.add_argument('--custody', type=Path, help='Reverify custody isolation against a retained disposable runtime')
    parser.add_argument('--workspace', type=Path)
    parser.add_argument('--port', type=int, default=18026)
    parser.add_argument('--serve', action='store_true', help='Keep this disposable API/worker alive for client checks')
    args = parser.parse_args()
    if args.renew or args.custody:
        root = (args.renew or args.custody).resolve()
        if not (root / 'api/.g26-isolated').is_file():
            parser.error('Only a generated disposable runtime can renew test sessions')
        temporary = Runtime.__new__(Runtime)
        temporary.root = root
        temporary.api = root / 'api'
        temporary.environment = environment(temporary.api, f'http://127.0.0.1:{args.port}')
        if args.renew:
            temporary.control('renew')
            print('Synthetic client sessions renewed; no credentials printed.')
        else:
            from checks import verify_custody
            temporary.fixture = temporary.api / 'storage/framework/testing/chat-browser'
            temporary.manifest = json.loads((temporary.fixture / 'fixture.json').read_text())
            temporary.origin = f'http://127.0.0.1:{args.port}'
            temporary.opener = urllib.request.build_opener(NoRedirect)
            label = verify_custody(temporary)
            report = json.loads((root / 'results.json').read_text())
            if label not in report['checks']:
                report['checks'].append(label)
            (root / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
            print('PASS: ' + label)
        return
    if not args.api_source or not args.workspace:
        parser.error('--api-source and --workspace are required for a new run')
    if args.workspace.resolve().is_relative_to(args.api_source.resolve()):
        parser.error('The disposable workspace must be outside the source API')
    os.umask(0o077)
    args.workspace.mkdir(parents=True, exist_ok=True)
    with contextlib.closing(socket.socket()) as probe:
        probe.bind(('127.0.0.1', args.port))  # Never replace an existing listener.
    from checks import verify
    runtime = None
    try:
        runtime = Runtime(args.api_source.resolve(), args.workspace, args.port)
        runtime.start_api()
        result = verify(runtime)
        result['api_revision'] = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=args.api_source, text=True).strip()
        result['tools'] = {tool: subprocess.check_output([tool, '-version'], text=True).splitlines()[0]
                           for tool in ('ffmpeg', 'ffprobe')}
        result['fixture_sha256'] = {name: hashlib.sha256((runtime.fixture / name).read_bytes()).hexdigest()
                                    for name in ('photo.png', 'clip.mp4', 'details.pdf')}
        (runtime.root / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
        print(f'PASS: {len(result["checks"])} real-runtime checks; evidence: {runtime.root}', flush=True)
        if args.serve:
            print('Disposable API/worker retained for client checks. Ctrl-C revokes fixture tokens.', flush=True)
            while True:
                time.sleep(1)
    finally:
        if runtime:
            runtime.close()


if __name__ == '__main__':
    def interrupted(_signal, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupted)
    try:
        main()
    except KeyboardInterrupt:
        pass
