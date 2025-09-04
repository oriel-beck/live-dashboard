import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GuildChannel } from '@discord-bot/shared-types';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-add-channel-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectModule],
  template: `
    <div class="add-channel-dialog">
      <div class="form-field">
        <label for="channel-select">Channel</label>
        <p-select
          id="channel-select"
          [(ngModel)]="selectedChannelId"
          [options]="availableChannels"
          optionLabel="name"
          optionValue="id"
          placeholder="Select a channel"
        ></p-select>
      </div>

      <div class="form-field">
        <label for="permission-select">Permission</label>
        <p-select
          id="permission-select"
          [(ngModel)]="selectedPermission"
          [options]="[
            { label: 'Allow', value: true },
            { label: 'Deny', value: false }
          ]"
          optionLabel="label"
          optionValue="value"
          placeholder="Select permission"
        ></p-select>
      </div>

      <div class="dialog-footer">
        <button class="cancel-btn" (click)="onCancel()">Cancel</button>
        <button
          class="add-btn"
          (click)="onAdd()"
          [disabled]="!selectedChannelId()"
        >
          Add Override
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .add-channel-dialog {
        padding: 20px;
        background: #36393f;
        color: #ffffff;
        font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;

          label {
            font-weight: 500;
            color: #ffffff;
            font-size: 14px;
          }
        }

        .dialog-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 20px;

          .cancel-btn {
            background: #4f545c;
            border: none;
            color: #ffffff;
            padding: 10px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              background: #5d6269;
            }
          }

          .add-btn {
            background: #5865f2;
            border: none;
            color: #ffffff;
            padding: 10px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover:not(:disabled) {
              background: #4752c4;
            }

            &:disabled {
              background: #4f545c;
              color: #b9bbbe;
              cursor: not-allowed;
            }
          }
        }
      }
    `,
  ],
})
export class AddChannelDialogComponent {
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  availableChannels: GuildChannel[] = this.config.data.availableChannels;

  selectedChannelId = signal<string>('');
  selectedPermission = signal<boolean>(true);

  onCancel() {
    this.ref.close();
  }

  onAdd() {
    if (this.selectedChannelId()) {
      this.config.data.onAdd(
        this.selectedChannelId(),
        this.selectedPermission()
      );
      this.ref.close();
    }
  }
}
