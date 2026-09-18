import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerComponent } from './timer';

describe('TimerComponent', () => {
  let fixture: ComponentFixture<TimerComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    TestBed.configureTestingModule({ imports: [TimerComponent] });
    fixture = TestBed.createComponent(TimerComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  function click(label: string): void {
    const button = element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    expect(button).not.toBeNull();
    button!.click();
    fixture.detectChanges();
  }

  function advance(milliseconds: number): void {
    vi.advanceTimersByTime(milliseconds);
    fixture.detectChanges();
  }

  function time(): string | null | undefined {
    return element.querySelector('[role="timer"]')?.textContent?.trim();
  }

  it('starts at 25 minutes and pauses and resumes without losing fractional seconds', () => {
    expect(time()).toBe('25:00');
    click('Start the timer');
    advance(1250);
    expect(time()).toBe('24:59');
    click('Pause the timer');
    advance(60_000);
    expect(time()).toBe('24:59');
    click('Resume the timer');
    advance(750);
    expect(time()).toBe('24:58');
  });

  it('resets a running timer and stops counting down', () => {
    click('Start the timer');
    advance(5000);
    click('Reset the timer');
    advance(5000);
    expect(time()).toBe('25:00');
    expect(
      element.querySelector<HTMLButtonElement>('[aria-label="Reset the timer"]')?.disabled,
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('finishes after exactly 25 minutes and can start a new session', () => {
    click('Start the timer');
    advance(25 * 60 * 1000 - 250);
    expect(time()).toBe('00:01');
    advance(250);
    expect(time()).toBe('00:00');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Time’s up!');
    expect(element.querySelector('mat-progress-spinner')?.getAttribute('aria-valuenow')).toBe('0');
    expect(vi.getTimerCount()).toBe(0);
    click('Start a new 25 minute timer');
    expect(time()).toBe('25:00');
    advance(1000);
    expect(time()).toBe('24:59');
  });

  it('catches up after a delayed callback and clamps the remaining time to zero', () => {
    click('Start the timer');
    vi.setSystemTime(new Date('2026-01-01T00:30:00Z'));
    advance(250);
    expect(time()).toBe('00:00');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the interval when the component is destroyed', () => {
    click('Start the timer');
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
