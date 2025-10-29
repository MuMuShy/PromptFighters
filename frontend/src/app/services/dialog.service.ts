import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DialogConfig {
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialogSubject = new BehaviorSubject<DialogConfig | null>(null);
  public dialog$ = this.dialogSubject.asObservable();

  constructor() { }

  private show(config: DialogConfig) {
    this.dialogSubject.next(config);
  }

  hide() {
    this.dialogSubject.next(null);
  }

  info(title: string, message: string) {
    this.show({
      title,
      message,
      type: 'info',
      confirmText: '確定'
    });
  }

  success(title: string, message: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: 'success',
      confirmText: '確定',
      onConfirm
    });
  }

  error(title: string, message: string) {
    this.show({
      title,
      message,
      type: 'error',
      confirmText: '確定'
    });
  }

  warning(title: string, message: string) {
    this.show({
      title,
      message,
      type: 'warning',
      confirmText: '確定'
    });
  }

  confirm(title: string, message: string, onConfirm: () => void, onCancel?: () => void) {
    this.show({
      title,
      message,
      type: 'confirm',
      confirmText: '確定',
      cancelText: '取消',
      onConfirm,
      onCancel
    });
  }

  loading(title: string, message: string) {
    this.show({
      title,
      message,
      type: 'info',
      confirmText: ''
    });
  }
}

