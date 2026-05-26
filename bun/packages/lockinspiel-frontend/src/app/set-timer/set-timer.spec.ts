import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetTimer } from './set-timer';

describe('SetTimer', () => {
  let component: SetTimer;
  let fixture: ComponentFixture<SetTimer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTimer],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTimer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
