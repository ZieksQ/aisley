"""Guard regressions for the opt-in tool, without touching a real application."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.request

from runtime import NoRedirect, Runtime, copy_application, environment


class RuntimeGuardsTest(unittest.TestCase):
    def test_copy_excludes_environment_storage_databases_and_compiled_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source'
            destination = Path(directory) / 'copy'
            for name in ('app', 'config', 'routes', 'resources', 'tests', 'vendor',
                         'database/factories', 'database/migrations', 'database/seeders'):
                (source / name).mkdir(parents=True)
            for name in ('artisan', 'composer.json', 'composer.lock', 'phpunit.xml',
                         'bootstrap/app.php', 'bootstrap/providers.php', 'public/index.php', 'config/database.php'):
                path = source / name
                path.parent.mkdir(exist_ok=True)
                path.write_text('synthetic source')
            excluded = ['.env', '.env.local', 'app/.env.nested', 'bootstrap/cache/config.php',
                        'storage/app/private/canary', 'database/database.sqlite', 'tests/local.sqlite']
            for name in excluded:
                path = source / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('must not be read or copied')
            original = shutil.copyfile

            def guarded_copy(src, dst, **kwargs):
                self.assertNotIn(Path(src).relative_to(source).as_posix(), excluded)
                return original(src, dst, **kwargs)

            with patch('shutil.copyfile', side_effect=guarded_copy):
                copy_application(source, destination)
            for name in excluded:
                self.assertFalse((destination / name).exists(), name)
            self.assertTrue((destination / '.g26-isolated').is_file())
            self.assertEqual((source / '.env').read_text(), 'must not be read or copied')

    def test_workspace_inside_source_is_rejected_before_copying(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                copy_application(root, root / 'nested')
            self.assertFalse((root / 'nested').exists())

    def test_process_configuration_does_not_inherit_database_or_cloud_credentials(self):
        with patch.dict(os.environ, {'DB_URL': 'synthetic-untrusted', 'AZURE_STORAGE_CONNECTION_STRING': 'synthetic-canary'}):
            values = environment(Path('/tmp/disposable/api'), 'http://127.0.0.1:18026')
        self.assertEqual(values['DB_CONNECTION'], 'sqlite')
        self.assertEqual(values['DB_URL'], '')
        self.assertNotIn('AZURE_STORAGE_CONNECTION_STRING', values)
        self.assertEqual(values['SANCTUM_STATEFUL_DOMAINS'], '')

    def test_fixture_refuses_the_source_tree_before_bootstrapping(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {'PATH': os.environ['PATH'], 'DB_CONNECTION': 'sqlite', 'DB_DATABASE': ':memory:'}
            result = subprocess.run(['php', str(Path(__file__).with_name('fixture.php')), 'seed'],
                                    cwd=directory, env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b'Only the disposable G26 application is allowed', result.stderr)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_fixture_refuses_an_environment_file_even_with_a_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.g26-isolated').write_text('synthetic')
            (root / '.env').write_text('synthetic canary')
            values = environment(root, 'http://127.0.0.1:18026')
            result = subprocess.run(['php', str(Path(__file__).with_name('fixture.php')), 'seed'],
                                    cwd=root, env=values, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b'Only the disposable G26 application is allowed', result.stderr)
            self.assertFalse((root / 'vendor').exists())

    def test_private_http_redirect_is_not_followed(self):
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                requests.append(self.path)
                self.send_response(302)
                self.send_header('Location', '/trap')
                self.end_headers()

        with ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                runtime = Runtime.__new__(Runtime)
                runtime.origin = f'http://127.0.0.1:{server.server_port}'
                runtime.manifest = {'tokens': {'customer': 'synthetic'}}
                runtime.opener = urllib.request.build_opener(NoRedirect)
                status, _, _ = runtime.request('GET', '/api/v1/customer/chat-attachments', 'customer')
                self.assertEqual(status, 302)
                self.assertEqual(requests, ['/api/v1/customer/chat-attachments'])
            finally:
                server.shutdown()
                thread.join(timeout=5)


if __name__ == '__main__':
    unittest.main()
