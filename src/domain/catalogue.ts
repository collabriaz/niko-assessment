const DEFAULT_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export const defaultDateRange = (now: Date) => ({
  startDate: now.toISOString().slice(0, 10),
  endDate: new Date(now.getTime() + DEFAULT_WINDOW_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10),
});
