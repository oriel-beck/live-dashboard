import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BotConfig } from './bot-config';

describe('BotConfig', () => {
  let component: BotConfig;
  let fixture: ComponentFixture<BotConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BotConfig]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BotConfig);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
