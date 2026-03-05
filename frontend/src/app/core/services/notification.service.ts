import { Injectable }        from '@angular/core';
import { MatSnackBar }       from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  success(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration:           4000,
      panelClass:         ['snack-success'],
      horizontalPosition: 'right',
      verticalPosition:   'bottom'
    });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration:           6000,
      panelClass:         ['snack-error'],
      horizontalPosition: 'right',
      verticalPosition:   'bottom'
    });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration:           3000,
      horizontalPosition: 'right',
      verticalPosition:   'bottom'
    });
  }
}
