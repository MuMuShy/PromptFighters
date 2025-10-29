import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DialogConfig } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss']
})
export class DialogComponent implements OnInit {
  dialog: DialogConfig | null = null;

  constructor(private dialogService: DialogService) { }

  ngOnInit() {
    this.dialogService.dialog$.subscribe(dialog => {
      this.dialog = dialog;
    });
  }

  onConfirm() {
    if (this.dialog?.onConfirm) {
      this.dialog.onConfirm();
    }
    this.close();
  }

  onCancel() {
    if (this.dialog?.onCancel) {
      this.dialog.onCancel();
    }
    this.close();
  }

  close() {
    this.dialogService.hide();
  }

  getIconClass(): string {
    if (!this.dialog) return '';
    
    switch (this.dialog.type) {
      case 'success':
        return 'icon-success';
      case 'error':
        return 'icon-error';
      case 'warning':
        return 'icon-warning';
      case 'confirm':
        return 'icon-confirm';
      default:
        return 'icon-info';
    }
  }
}

