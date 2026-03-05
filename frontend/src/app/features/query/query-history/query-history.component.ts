import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule }             from '@angular/common';
import { MatTableModule }           from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort }      from '@angular/material/sort';
import { MatCardModule }            from '@angular/material/card';
import { MatChipsModule }           from '@angular/material/chips';
import { MatIconModule }            from '@angular/material/icon';
import { MatButtonModule }          from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule }         from '@angular/material/tooltip';
import { QueryService }             from '../../../core/services/query.service';
import { QueryHistoryItem, PaginatedList } from '../../../core/models/query.models';

@Component({
  selector:   'app-query-history',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatCardModule, MatChipsModule, MatIconModule,
    MatButtonModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Query History</h1>
        <p class="subtitle">All queries executed in your organisation</p>
      </div>

      <mat-card>
        @if (loading()) {
          <div class="spinner-center"><mat-spinner diameter="40" /></div>
        } @else {
          <table mat-table [dataSource]="data()?.items ?? []" matSort (matSortChange)="sort($event)">

            <ng-container matColumnDef="executedAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Time</th>
              <td mat-cell *matCellDef="let row">{{ row.executedAt | date:'short' }}</td>
            </ng-container>

            <ng-container matColumnDef="connectionName">
              <th mat-header-cell *matHeaderCellDef>Connection</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip>{{ row.connectionName }}</mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="naturalLanguageQuery">
              <th mat-header-cell *matHeaderCellDef>Question</th>
              <td mat-cell *matCellDef="let row" class="query-cell"
                  [matTooltip]="row.naturalLanguageQuery">
                {{ row.naturalLanguageQuery | slice:0:80 }}{{ row.naturalLanguageQuery.length > 80 ? '...' : '' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip [class]="'status-' + row.status.toLowerCase()">
                  {{ row.status }}
                </mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="rowCount">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Rows</th>
              <td mat-cell *matCellDef="let row">{{ row.rowCount | number }}</td>
            </ng-container>

            <ng-container matColumnDef="executionTimeMs">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Time (ms)</th>
              <td mat-cell *matCellDef="let row">{{ row.executionTimeMs }}</td>
            </ng-container>

            <ng-container matColumnDef="tokensUsed">
              <th mat-header-cell *matHeaderCellDef>Tokens</th>
              <td mat-cell *matCellDef="let row">{{ row.tokensUsed | number }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>

          <mat-paginator
            [length]="data()?.totalCount ?? 0"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPage($event)"
            showFirstLastButtons />
        }
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { padding: 32px; max-width: 1400px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    h1 { margin: 0; font-size: 1.75rem; font-weight: 700; }
    .subtitle { color: #64748b; margin: 4px 0 0; }
    .spinner-center { display: flex; justify-content: center; padding: 40px; }
    .query-cell { max-width: 300px; }
    .status-success { --mdc-chip-elevated-container-color: #d1fae5; }
    .status-failed  { --mdc-chip-elevated-container-color: #fee2e2; }
    .status-blocked { --mdc-chip-elevated-container-color: #fef3c7; }
    table { width: 100%; }
  `]
})
export class QueryHistoryComponent implements OnInit {
  readonly displayedColumns = [
    'executedAt', 'connectionName', 'naturalLanguageQuery',
    'status', 'rowCount', 'executionTimeMs', 'tokensUsed'
  ];

  readonly loading = signal(true);
  readonly data    = signal<PaginatedList<QueryHistoryItem> | null>(null);

  pageNumber = 1;
  pageSize   = 20;

  constructor(private queryService: QueryService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  onPage(event: PageEvent): void {
    this.pageNumber = event.pageIndex + 1;
    this.pageSize   = event.pageSize;
    this.loadHistory();
  }

  sort(_: Sort): void {
    this.pageNumber = 1;
    this.loadHistory();
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.queryService.getHistory(undefined, this.pageNumber, this.pageSize).subscribe({
      next:     res => { this.data.set(res); this.loading.set(false); },
      error:    ()  => this.loading.set(false)
    });
  }
}
