export function isTerritorialJournalReturn(href: string | null) {
  return !!href && /^\/journal\/(preview|personnel)\?date=\d{4}-\d{2}-\d{2}&id=[a-f0-9]{64}#productions-surveillance$/.test(href);
}
