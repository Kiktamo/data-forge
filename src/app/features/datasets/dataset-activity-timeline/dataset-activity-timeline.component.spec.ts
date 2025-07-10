import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatasetActivityTimelineComponent } from './dataset-activity-timeline.component';

describe('DatasetActivityTimelineComponent', () => {
  let component: DatasetActivityTimelineComponent;
  let fixture: ComponentFixture<DatasetActivityTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetActivityTimelineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DatasetActivityTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
