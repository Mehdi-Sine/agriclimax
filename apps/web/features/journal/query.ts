import {isCalendarDate} from '../national/daily-availability';
export function isJournalRun(run:string){return isCalendarDate(run)||/^\d{4}-\d{2}-\d{2}T(?:00|06|12|18):00:00(?:Z|\+00:00)$/.test(run)&&isCalendarDate(run.slice(0,10))&&Number.isFinite(Date.parse(run));}
