import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatasetAnalyticsComponent } from './dataset-analytics.component';

describe('DatasetAnalyticsComponent', () => {
  let component: DatasetAnalyticsComponent;
  let fixture: ComponentFixture<DatasetAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetAnalyticsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DatasetAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
