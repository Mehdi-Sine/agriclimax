"""Regression probes use synthetic values; no real credentials are needed."""
import base64
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'scripts/quality/{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


security = load('security')
migrations = load('migrations')
budget = load('budget')


class Guards(unittest.TestCase):
    def test_obvious_secrets_and_supabase_jwt(self):
        self.assertIn('supabase-secret', security.findings('sb_' + 'secret_' + 'x' * 30))
        self.assertIn('github-token', security.findings('gh' + 'p_' + 'x' * 36))
        self.assertIn('private-key', security.findings('-----BEGIN ' + 'PRIVATE KEY-----'))
        self.assertIn('credential-assignment', security.findings('SUPABASE_SECRET_KEY=' + 'x' * 30))
        payload = base64.urlsafe_b64encode(json.dumps({'role': 'service_role'}).encode()).decode().rstrip('=')
        self.assertIn('supabase-service-role-jwt', security.findings('eyJfake.' + payload + '.signature'))
        anon = base64.urlsafe_b64encode(json.dumps({'role': 'anon'}).encode()).decode().rstrip('=')
        self.assertEqual(security.findings('eyJfake.' + anon + '.signature'), set())
        self.assertEqual(security.findings('SUPABASE_SECRET_KEY=${SECRET}'), set())

    def test_source_client_boundary_and_safe_reporting(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'apps/web'
            folder.mkdir(parents=True)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            (folder / 'safe.ts').write_text('export const safe = true;')
            self.assertEqual(security.scan_sources(root), [])
            privileged = 'SUPABASE_' + 'SECRET_KEY'
            client = folder / 'client.tsx'
            client.write_text('"use client";\nconst key = process.env.' + privileged)
            self.assertTrue(security.scan_sources(root))
            client.write_text('const key = process.env.NEXT_PUBLIC_' + privileged)
            self.assertTrue(security.scan_sources(root))
            synthetic = 'sb_' + 'secret_' + 'x' * 30
            (root / '.env').write_text(synthetic)
            errors = security.scan_sources(root)
            self.assertTrue(any('tracked environment file' in e for e in errors))
            self.assertTrue(any('supabase-secret' in e for e in errors))
            self.assertFalse(any(synthetic in e for e in errors))
        self.assertEqual(security.findings('eyJbad.notbase64.signature'), set())

    def test_bundle_is_required_and_secret_sentinel_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            self.assertTrue(security.scan_bundle(path))
            (path / 'chunk.js').write_text('const safe = true;')
            self.assertEqual(security.scan_bundle(path, 'synthetic-sentinel'), [])
            (path / 'chunk.js.map').write_text('synthetic-sentinel')
            self.assertTrue(security.scan_bundle(path, 'synthetic-sentinel'))
            (path / 'chunk.js').write_text('SUPABASE_' + 'SERVICE_ROLE_KEY')
            self.assertTrue(security.scan_bundle(path))

    def test_migrations_cannot_change_or_go_backwards(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'supabase/migrations'
            folder.mkdir(parents=True)
            path = folder / '0001_core.sql'
            path.write_text('SELECT 1;')
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', 'add', '.'], cwd=root, check=True)
            subprocess.run(['git', '-c', 'user.name=Quality', '-c', 'user.email=quality@example.test',
                            'commit', '-qm', 'base'], cwd=root, check=True)
            self.assertEqual(migrations.check(root, 'HEAD'), [])
            path.write_text('SELECT 2;')
            self.assertTrue(migrations.check(root, 'HEAD'))
            path.write_text('SELECT 1;')
            (folder / '0000_earlier.sql').write_text('SELECT 0;')
            subprocess.run(['git', 'add', '.'], cwd=root, check=True)
            self.assertTrue(migrations.check(root, 'HEAD'))
            (folder / '0001_duplicate.sql').write_text('SELECT 1;')
            self.assertTrue(migrations.check(root))

    def test_budget_rejects_missing_or_excessive_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            with self.assertRaises(ValueError): budget.check(path)
            (path / 'app.js').write_text('const example=1;')
            self.assertGreater(budget.check(path), 0)
            with self.assertRaises(ValueError): budget.check(path, 1)


if __name__ == '__main__':
    unittest.main()
