import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommandConfigDialog } from './command-config-dialog';

describe('CommandConfigDialog', () => {
  let component: CommandConfigDialog;
  let fixture: ComponentFixture<CommandConfigDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommandConfigDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommandConfigDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
