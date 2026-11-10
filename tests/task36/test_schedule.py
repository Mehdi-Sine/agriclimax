"""Exercise event identity with real Paris DST rules and immutable run timestamps."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('schedule', Path('scripts/task36_schedule.py'))
schedule = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schedule)


class ScheduleTests(unittest.TestCase):
    def test_every_cron_keeps_stage_at_any_runner_start(self):
        for cron, (stage, _) in schedule.SCHEDULES.items():
            for started in ('2026-11-10T01:15:00Z', '2026-11-10T02:00:00Z',
                            '2026-11-10T08:27:00Z', '2026-11-11T00:30:00Z'):
                with self.subTest(cron=cron, started=started):
                    plan = schedule.resolve({'schedule': cron}, '2026-11-10T08:27:00Z', started)
                    self.assertEqual(plan['stage'], stage)
                    self.assertEqual(plan['edition_date'], '2026-11-10')

    def test_dispatch_and_supabase_preserve_explicit_date_and_slot(self):
        for stage in schedule.STAGES:
            plan = schedule.resolve({'inputs': {'stage': stage, 'edition_date': '2026-11-10',
                'scheduled_at': '2026-11-10T05:05:00Z', 'dispatch_id': 'watchdog-test'}},
                '2026-11-11T01:00:00Z', '2026-11-11T01:00:00Z')
            self.assertEqual(plan['stage'], stage)
            self.assertEqual(plan['edition_date'], '2026-11-10')
            self.assertEqual(plan['dispatch_id'], 'watchdog-test')

    def test_dst_and_rerun(self):
        for created in ('2026-03-29T01:15:00Z', '2026-10-25T00:15:00Z', '2026-10-25T01:15:00Z'):
            first = schedule.resolve({'schedule': '15,45 2-4 * * *'}, created, created)
            retry = schedule.resolve({'schedule': '15,45 2-4 * * *'}, created, '2026-11-11T12:00:00Z')
            self.assertEqual(first['stage'], 'acquire')
            self.assertEqual(first['scheduled_at'], retry['scheduled_at'])
            self.assertEqual(first['edition_date'], created[:10])

    def test_unknown_cron_is_never_a_green_report(self):
        with self.assertRaises(KeyError):
            schedule.resolve({'schedule': 'invalid'}, '2026-11-10T01:00:00Z', '2026-11-10T01:00:00Z')

    def test_workflow_crons_match_exact_registry(self):
        import re
        source = Path('.github/workflows/operational-journal.yml').read_text()
        self.assertEqual(set(re.findall(r"cron: '([^']+)'", source)), set(schedule.SCHEDULES))
        self.assertNotIn("now<'", source)
        self.assertIn('github.event.schedule', source)  # concurrency retains event identity
