import { TestBed } from '@angular/core/testing';

import { Timekeeper } from './timekeeper';

describe('Timekeeper', () => {
  let service: Timekeeper;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Timekeeper);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
