import {watchResponse} from '../../../lib/server/watch-response';
import {isCalendarDate} from '../../../features/national/daily-availability';
import {nationalWatch} from '../../../lib/server/national-watch';

export const runtime = 'nodejs';
export const maxDuration = 30;

function validRun(run: string) {
  return isCalendarDate(run) ||
    (/^\d{4}-\d{2}-\d{2}T(?:00|06|12|18):00:00(?:Z|\+00:00)$/.test(run) &&
      isCalendarDate(run.slice(0, 10)) && Number.isFinite(Date.parse(run)));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const run = params.get('run');
  const day = params.get('day');
  const sha = params.get('sha');
  if ([...params.keys()].some(key => !['run', 'day', 'sha'].includes(key) || params.getAll(key).length !== 1) ||
      (run !== null && !validRun(run)) ||
      (day !== null && (!run || !isCalendarDate(day))) ||
      (sha !== null && (!day || !/^[a-f0-9]{64}$/.test(sha)))) {
    return Response.json({error: 'INVALID_QUERY'}, {status: 400});
  }
  try {
    return watchResponse(request, await nationalWatch(run ?? undefined, undefined, day ?? undefined, sha ?? undefined));
  } catch {
    return Response.json({error: 'VERIFIED_NATIONAL_WATCH_UNAVAILABLE'}, {
      status: 503, headers: {'Cache-Control': 'no-store'},
    });
  }
}
