import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContributionListComponent } from './contribution-list.component';

describe('ContributionsListComponent', () => {
  let component: ContributionListComponent;
  let fixture: ComponentFixture<ContributionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContributionListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContributionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
