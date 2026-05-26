import { TestBed } from '@angular/core/testing';

import { TimekeeperService } from './timekeeper';

describe('Timekeeper', () => {
  let service: TimekeeperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimekeeperService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
