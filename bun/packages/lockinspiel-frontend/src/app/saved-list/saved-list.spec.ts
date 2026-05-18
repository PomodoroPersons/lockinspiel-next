import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavedList } from './saved-list';

describe('SavedList', () => {
  let component: SavedList;
  let fixture: ComponentFixture<SavedList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedList],
    }).compileComponents();

    fixture = TestBed.createComponent(SavedList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
