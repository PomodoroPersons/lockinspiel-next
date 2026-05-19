/**
 * Created by Claude Haiku 4.5
 * _(2026-05-11)_
 */

export function formatInterval(len: number): string {
  if (len <= 0) return "00:00:00";

  const hours = Math.floor(len / 3600);
  const minutes = Math.floor(len / 60) % 60;
  const seconds = Math.floor(len) % 60;

  return `${hours < 10 ? "0" + hours : hours}:${minutes < 10 ? "0" + minutes : minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
}

export function intervalToSeconds(interval: string): number {
  const intervals = interval.split(":");

  const hours = parseInt(intervals[0]);
  const minutes = parseInt(intervals[1]);
  const seconds = parseInt(intervals[2]);

  return hours * 3600 + minutes * 60 + seconds;
}
