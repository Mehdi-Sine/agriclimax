"""Fault-injection tests for the installer, never substitutes for scanner smoke tests."""
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'scripts/quality/install-go-tool.sh'
FAKE = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
keys = ('GOSUMDB', 'GOPROXY', 'GOENV', 'GOWORK', 'GOFLAGS', 'GOTOOLCHAIN', 'GO111MODULE',
        'GOPRIVATE', 'GONOPROXY', 'GONOSUMDB', 'GOINSECURE', 'GOMODCACHE')
with open(os.environ['TOOL_LOG'], 'a') as log:
    log.write(json.dumps({'name': name, 'args': args,
                         'env': {k: os.environ.get(k) for k in keys}}) + '\n')
mode = os.environ['TOOL_MODE']
tool = os.environ['TEST_TOOL']
if name == 'curl':
    pathlib.Path(args[args.index('--output') + 1]).write_text('partial or synthetic archive')
    sys.exit(22 if mode != 'release' and mode != 'checksum' and mode != 'tar' else 0)
if name == 'sha256sum':
    content = sys.stdin.read()
    with open(os.environ['TOOL_LOG'], 'a') as log:
        log.write(json.dumps({'name': 'checksum-input', 'content': content}) + '\n')
    sys.exit(1 if mode == 'checksum' else 0)
if name == 'tar':
    if mode == 'tar': sys.exit(2)
    target = pathlib.Path(args[args.index('-C') + 1]) / tool
elif name == 'go':
    if args[0] == 'install':
        state = pathlib.Path(os.environ['TOOL_LOG'] + '.attempts')
        attempt = int(state.read_text()) + 1 if state.exists() else 1
        state.write_text(str(attempt))
        if mode == 'offline' or mode == 'retry' and attempt == 1: sys.exit(1)
        target = pathlib.Path(os.environ['GOBIN']) / tool
        cache = pathlib.Path(os.environ['GOMODCACHE']) / 'readonly-module'
        cache.mkdir(parents=True)
        (cache / 'go.mod').write_text('synthetic cleanup fixture')
        (cache / 'go.mod').chmod(0o444)
        cache.chmod(0o555)
    else:
        module, version = {'actionlint': ('github.com/rhysd/actionlint', 'v1.7.7'),
                           'gitleaks': ('github.com/zricethezav/gitleaks/v8', 'v8.24.2')}[tool]
        if mode == 'wrong-version': version = 'v0.0.0'
        print('\tmod\t' + module + '\t' + version + '\th1:synthetic-test-only')
        sys.exit(0)
else:
    sys.exit(0)  # sleep, no delay in these synthetic fault injections

target.write_text('#!/bin/sh\nexit 0\n')
target.chmod(0o755)
'''


class CiToolInstall(unittest.TestCase):
    def run_install(self, mode, tool='actionlint'):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        fake_bin = root / 'fake-bin'
        fake_bin.mkdir()
        for name in ('curl', 'sha256sum', 'tar', 'go', 'sleep'):
            path = fake_bin / name
            path.write_text(FAKE)
            path.chmod(0o755)
        destination = root / 'destination with spaces'
        destination.mkdir()
        (destination / tool).write_text('STALE BINARY MUST NOT SURVIVE A FAILURE')
        log = root / 'log.jsonl'
        env = {**os.environ, 'PATH': str(fake_bin) + os.pathsep + os.environ['PATH'],
               'TOOL_LOG': str(log), 'TOOL_MODE': mode, 'TEST_TOOL': tool,
               'GOSUMDB': 'off', 'GOPROXY': 'direct', 'GOFLAGS': '-mod=mod', 'GO111MODULE': 'off',
               'GONOSUMDB': '*', 'GOPRIVATE': '*', 'GONOPROXY': '*', 'GOINSECURE': '*'}
        result = subprocess.run(['bash', str(SCRIPT), tool, str(destination)],
                                env=env, capture_output=True, text=True, timeout=15, check=False)
        calls = [json.loads(line) for line in log.read_text().splitlines()]
        self.assertEqual(list(destination.glob('install.*')), [], 'staging must be cleaned')
        return result, calls, destination / tool

    def test_official_releases_remain_pinned_and_verified_before_extraction(self):
        for tool, version, digest in (
            ('actionlint', 'v1.7.7',
             '023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757'),
            ('gitleaks', 'v8.24.2',
             'fa0500f6b7e41d28791ebc680f5dd9899cd42b58629218a5f041efa899151a8e'),
        ):
            with self.subTest(tool=tool):
                result, calls, binary = self.run_install('release', tool)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(binary.is_file())
                names = [c['name'] for c in calls]
                self.assertLess(names.index('sha256sum'), names.index('tar'))
                self.assertNotIn('go', names)
                args = calls[0]['args']
                self.assertIn('/releases/download/' + version + '/', args[-1])
                for flag, value in (('--retry', '3'), ('--retry-delay', '3'),
                                    ('--max-time', '30'), ('--retry-max-time', '120'),
                                    ('--connect-timeout', '10'), ('--proto', '=https'),
                                    ('--proto-redir', '=https')):
                    self.assertEqual(args[args.index(flag) + 1], value)
                self.assertIn('--fail', args)
                self.assertTrue(next(c for c in calls if c['name'] == 'checksum-input')
                                ['content'].startswith(digest + '  '))

    def test_checksum_and_extraction_errors_do_not_fall_back_or_leave_stale_binary(self):
        for mode in ('checksum', 'tar'):
            with self.subTest(mode=mode):
                result, calls, binary = self.run_install(mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(binary.exists())
                self.assertFalse(any(c['name'] == 'go' for c in calls))
                if mode == 'checksum':
                    self.assertIn('checksum mismatch', result.stderr)
                    self.assertFalse(any(c['name'] == 'tar' for c in calls))

    def test_unavailable_release_builds_exact_module_with_unavoidable_sumdb(self):
        for tool, package in (
            ('actionlint', 'github.com/rhysd/actionlint/cmd/actionlint@v1.7.7'),
            ('gitleaks', 'github.com/zricethezav/gitleaks/v8@v8.24.2'),
        ):
            with self.subTest(tool=tool):
                result, calls, binary = self.run_install('fallback', tool)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(binary.exists())
                install = next(c for c in calls if c['name'] == 'go')
                self.assertEqual(install['args'], ['install', '-trimpath', package])
                env = install['env']
                self.assertEqual(env['GOSUMDB'], 'sum.golang.org')
                self.assertEqual(env['GOPROXY'], 'https://proxy.golang.org')
                self.assertEqual(env['GOTOOLCHAIN'], 'local')
                self.assertEqual(env['GO111MODULE'], 'on')
                self.assertEqual(env['GOENV'], 'off')
                self.assertEqual(env['GOWORK'], 'off')
                for key in ('GOPRIVATE', 'GONOSUMDB', 'GONOPROXY', 'GOINSECURE', 'GOFLAGS'):
                    self.assertEqual(env[key], '')
                self.assertIn('/install.', env['GOMODCACHE'])
                self.assertTrue(any(c['name'] == 'go' and c['args'][0:2] == ['version', '-m']
                                    for c in calls))
                self.assertFalse(any(c['name'] in ('sha256sum', 'tar') for c in calls))

    def test_go_retry_is_bounded_and_recovers(self):
        result, calls, binary = self.run_install('retry')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(binary.exists())
        self.assertEqual(sum(c['name'] == 'go' and c['args'][0] == 'install'
                             for c in calls), 2)
        self.assertEqual(sum(c['name'] == 'sleep' for c in calls), 1)

    def test_total_outage_is_explicit_failure_not_a_stale_success(self):
        result, calls, binary = self.run_install('offline')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(binary.exists())
        self.assertIn('neither official release nor checksum-verified Go', result.stderr)
        self.assertEqual(sum(c['name'] == 'go' and c['args'][0] == 'install'
                             for c in calls), 2)

    def test_wrong_go_build_version_is_rejected(self):
        result, _, binary = self.run_install('wrong-version')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(binary.exists())

    def test_unknown_tools_are_not_installable(self):
        result = subprocess.run(['bash', str(SCRIPT), 'unknown', '/must-not-be-created'],
                                capture_output=True, text=True, timeout=5, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn('Unsupported CI tool', result.stderr)

    def test_workflows_keep_scanners_unconditional_and_blocking_with_original_options(self):
        for workflow, job, name, install, scan in (
            ('quality.yml', 'guards', 'Actionlint',
             'bash scripts/quality/install-go-tool.sh actionlint work/actionlint',
             'work/actionlint/actionlint -shellcheck= .github/workflows/*.yml'),
            ('security.yml', 'secrets', 'Gitleaks',
             'bash scripts/quality/install-go-tool.sh gitleaks work/gitleaks',
             ('work/gitleaks/gitleaks git --redact --exit-code 1 --report-format json '
              '--report-path work/gitleaks/report.json .')),
        ):
            with self.subTest(workflow=workflow):
                payload = yaml.safe_load((ROOT / '.github/workflows' / workflow).read_text())
                job_config = payload['jobs'][job]
                self.assertNotIn('continue-on-error', job_config)
                self.assertNotIn('if', job_config)
                step = next(s for s in job_config['steps'] if s.get('name', '').startswith(name))
                self.assertNotIn('continue-on-error', step)
                self.assertNotIn('if', step)
                self.assertEqual(step['run'].splitlines(), [install, scan])


if __name__ == '__main__':
    unittest.main()
