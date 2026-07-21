const IST_OFFSET = "+05:30";

export const toISTDateTime = (date: string, time: string): Date => new Date(`${date}T${time}:00${IST_OFFSET}`);

export const hoursUntil = (target: Date, from: Date = new Date()): number =>
  (target.getTime() - from.getTime()) / (1000 * 60 * 60);

export const isPast = (date: Date, from: Date = new Date()): boolean => date.getTime() <= from.getTime();

export const addHours = (date: Date, hours: number): Date => new Date(date.getTime() + hours * 60 * 60 * 1000);

export const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60 * 1000);
