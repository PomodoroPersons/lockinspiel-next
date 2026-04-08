export function parseTimerLen(len: string) : number {
  const [hours, minutes, seconds] = len.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}
