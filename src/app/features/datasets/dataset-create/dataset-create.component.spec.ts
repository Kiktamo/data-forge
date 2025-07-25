import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatasetCreateComponent } from './dataset-create.component';

describe('DatasetCreateComponent', () => {
  let component: DatasetCreateComponent;
  let fixture: ComponentFixture<DatasetCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DatasetCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
