export const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export const calendarDate = (value: string) => new Date(`${value}T00:00:00Z`);
