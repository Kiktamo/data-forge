import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatasetListComponent } from './dataset-list.component';

describe('DatasetListComponent', () => {
  let component: DatasetListComponent;
  let fixture: ComponentFixture<DatasetListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DatasetListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
