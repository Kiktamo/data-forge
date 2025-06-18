import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ValidationQueueComponent } from './validation-queue.component';

describe('ValidationQueueComponent', () => {
  let component: ValidationQueueComponent;
  let fixture: ComponentFixture<ValidationQueueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidationQueueComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ValidationQueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
