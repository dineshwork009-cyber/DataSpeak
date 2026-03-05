import {
  Component, OnInit, signal, ViewChild, AfterViewChecked, ElementRef
} from '@angular/core';
import { CommonModule }            from '@angular/common';
import {
  FormBuilder, ReactiveFormsModule, Validators
} from '@angular/forms';
import { MatSelectModule }         from '@angular/material/select';
import { MatFormFieldModule }      from '@angular/material/form-field';
import { MatInputModule }          from '@angular/material/input';
import { MatButtonModule }         from '@angular/material/button';
import { MatIconModule }           from '@angular/material/icon';
import { MatTableModule }          from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule }        from '@angular/material/tooltip';
import { QueryService }            from '../../../core/services/query.service';
import { ConnectionService }       from '../../../core/services/connection.service';
import { NotificationService }     from '../../../core/services/notification.service';
import { DatabaseConnection }      from '../../../core/models/connection.models';
import { QueryResponse }           from '../../../core/models/query.models';

interface ChatMessage {
  id:        string;
  type:      'user' | 'result' | 'error';
  text:      string;
  response?: QueryResponse;
  time:      Date;
}

@Component({
  selector:   'app-query-chat',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule,
    MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="chat-shell">

      <!-- ── Sidebar / context panel ──────────────────────── -->
      <div class="context-panel">
        <div class="cp-header">
          <mat-icon>storage</mat-icon>
          <span>Connection</span>
        </div>
        <mat-form-field appearance="outline" class="full-w">
          <mat-label>Select database</mat-label>
          <mat-select [formControl]="connectionCtrl">
            @for (c of connections(); track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="cp-header" style="margin-top:20px">
          <mat-icon>lightbulb_outline</mat-icon>
          <span>Try asking</span>
        </div>
        <div class="examples-list">
          @for (ex of examples; track ex) {
            <button class="example-btn" (click)="useExample(ex)">
              {{ ex }}
            </button>
          }
        </div>

        <div class="cp-tip">
          <mat-icon>info_outline</mat-icon>
          Press <kbd>Ctrl+Enter</kbd> to send
        </div>
      </div>

      <!-- ── Chat area ─────────────────────────────────────── -->
      <div class="chat-area">

        <!-- Messages -->
        <div class="messages" #msgContainer>

          @if (messages().length === 0) {
            <div class="empty">
              <div class="empty-icon-wrap">
                <mat-icon>chat_bubble_outline</mat-icon>
              </div>
              <h3>Ask anything about your data</h3>
              <p>Type a question in plain English and I'll generate and run the SQL for you.</p>
            </div>
          }

          @for (msg of messages(); track msg.id) {

            @if (msg.type === 'user') {
              <div class="msg-row user-row">
                <div class="msg-bubble user-bubble">{{ msg.text }}</div>
                <div class="avatar user-av">
                  <mat-icon>person</mat-icon>
                </div>
              </div>
            }

            @if (msg.type === 'result' && msg.response) {
              <div class="msg-row ai-row">
                <div class="avatar ai-av">
                  <mat-icon>auto_awesome</mat-icon>
                </div>
                <div class="result-card">

                  <!-- Status bar -->
                  <div class="status-bar" [class.status-ok]="msg.response.success"
                                          [class.status-err]="!msg.response.success">
                    <mat-icon>{{ msg.response.success ? 'check_circle' : 'cancel' }}</mat-icon>
                    <span>{{ msg.response.success ? 'Query successful' : 'Query failed' }}</span>
                    @if (msg.response.success) {
                      <span class="badge">{{ msg.response.rowCount }} rows</span>
                      <span class="badge">{{ msg.response.executionTimeMs }}ms</span>
                      <span class="badge">{{ msg.response.tokensUsed }} tokens</span>
                    }
                  </div>

                  <!-- SQL block -->
                  <div class="sql-block">
                    <div class="sql-label">
                      <mat-icon>code</mat-icon> Generated SQL
                    </div>
                    <pre class="sql-code">{{ msg.response.generatedSql }}</pre>
                  </div>

                  <!-- Error -->
                  @if (!msg.response.success) {
                    <div class="error-msg">
                      <mat-icon>warning</mat-icon>
                      {{ msg.response.errorMessage }}
                    </div>
                  }

                  <!-- Table -->
                  @if (msg.response.success && msg.response.rowCount > 0) {
                    <div class="table-wrap">
                      <table mat-table [dataSource]="msg.response.rows">
                        @for (col of msg.response.columns; track col) {
                          <ng-container [matColumnDef]="col">
                            <th mat-header-cell *matHeaderCellDef>{{ col }}</th>
                            <td mat-cell *matCellDef="let row">
                              {{ row[col] ?? '—' }}
                            </td>
                          </ng-container>
                        }
                        <tr mat-header-row *matHeaderRowDef="msg.response.columns; sticky: true"></tr>
                        <tr mat-row *matRowDef="let row; columns: msg.response.columns;"></tr>
                      </table>
                    </div>
                  }

                  @if (msg.response.success && msg.response.rowCount === 0) {
                    <p class="no-rows">No results found.</p>
                  }

                </div>
              </div>
            }

            @if (msg.type === 'error') {
              <div class="msg-row ai-row">
                <div class="avatar ai-av">
                  <mat-icon>auto_awesome</mat-icon>
                </div>
                <div class="error-bubble">
                  <mat-icon>error_outline</mat-icon>
                  {{ msg.text }}
                </div>
              </div>
            }

          }

          @if (loading()) {
            <div class="msg-row ai-row">
              <div class="avatar ai-av">
                <mat-icon>auto_awesome</mat-icon>
              </div>
              <div class="thinking-bubble">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>
          }

        </div>

        <!-- Input -->
        <div class="input-bar">
          <form [formGroup]="queryForm" (ngSubmit)="submit()" class="input-form">
            <textarea formControlName="query"
                      class="query-input"
                      placeholder="Ask a question about your data..."
                      rows="1"
                      (keydown)="onKey($event)"
                      (input)="autoResize($event)">
            </textarea>
            <button type="submit" class="send-btn"
                    [disabled]="queryForm.invalid || loading() || !connectionCtrl.value"
                    matTooltip="Send (Ctrl+Enter)">
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-icon>send</mat-icon>
              }
            </button>
          </form>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .chat-shell {
      display: flex;
      height: 100%;
      overflow: hidden;
      background: #f8fafc;
    }

    /* ── Context panel ───────────────────────────────── */
    .context-panel {
      width: 260px;
      min-width: 260px;
      background: white;
      border-right: 1px solid #e2e8f0;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
    }
    .cp-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .cp-header mat-icon { font-size: 16px; }
    .full-w { width: 100%; margin-bottom: -1.25em; }

    .examples-list { display: flex; flex-direction: column; gap: 4px; }
    .example-btn {
      text-align: left;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 0.78rem;
      color: #475569;
      cursor: pointer;
      line-height: 1.4;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .example-btn:hover {
      background: rgba(99,102,241,0.06);
      border-color: #c7d2fe;
      color: #6366f1;
    }

    .cp-tip {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      color: #94a3b8;
      margin-top: auto;
    }
    .cp-tip mat-icon { font-size: 14px; }
    kbd {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 1px 5px;
      font-family: monospace;
      font-size: 0.7rem;
    }

    /* ── Chat area ───────────────────────────────────── */
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Messages */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Empty state */
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: #64748b;
    }
    .empty-icon-wrap {
      width: 64px; height: 64px;
      background: rgba(99,102,241,0.1);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
    }
    .empty-icon-wrap mat-icon { font-size: 32px; color: #6366f1; }
    .empty h3 { margin: 0 0 8px; font-size: 1.1rem; font-weight: 600; color: #1e293b; }
    .empty p  { margin: 0; font-size: 0.875rem; }

    /* Message rows */
    .msg-row { display: flex; gap: 12px; align-items: flex-start; }
    .user-row { flex-direction: row-reverse; }

    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .user-av {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }
    .user-av mat-icon { color: white; font-size: 18px; }
    .ai-av {
      background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    }
    .ai-av mat-icon { color: white; font-size: 18px; }

    .msg-bubble {
      max-width: 520px;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .user-bubble {
      background: #6366f1;
      color: white;
      border-bottom-right-radius: 4px;
    }

    /* Result card */
    .result-card {
      flex: 1;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      border-top-left-radius: 4px;
      overflow: hidden;
    }

    .status-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      font-size: 0.8rem;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
    }
    .status-bar mat-icon { font-size: 18px; }
    .status-ok { background: #f0fdf4; color: #16a34a; }
    .status-err { background: #fef2f2; color: #dc2626; }
    .badge {
      background: rgba(0,0,0,0.06);
      border-radius: 8px;
      padding: 2px 8px;
      font-size: 0.72rem;
      font-weight: 500;
    }

    .sql-block { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
    .sql-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .sql-label mat-icon { font-size: 14px; }
    .sql-code {
      background: #0f172a;
      color: #a5b4fc;
      padding: 12px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-family: 'Courier New', monospace;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
    }

    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #fef2f2;
      color: #dc2626;
      font-size: 0.85rem;
    }
    .error-msg mat-icon { font-size: 18px; flex-shrink: 0; }

    .table-wrap {
      overflow-x: auto;
      max-height: 360px;
    }
    table { width: 100%; }
    th { background: #f8fafc; font-size: 0.78rem; font-weight: 600; white-space: nowrap; color: #374151; }
    td { font-size: 0.82rem; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }

    .no-rows { color: #94a3b8; text-align: center; padding: 20px; margin: 0; font-size: 0.875rem; }

    .error-bubble {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 12px;
      border-top-left-radius: 4px;
      font-size: 0.875rem;
    }

    /* Thinking animation */
    .thinking-bubble {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      border-top-left-radius: 4px;
      padding: 14px 20px;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #6366f1;
      animation: bounce 1.2s infinite ease-in-out;
    }
    .dot:nth-child(1) { animation-delay: 0s; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Input bar */
    .input-bar {
      padding: 16px 24px;
      background: white;
      border-top: 1px solid #e2e8f0;
    }
    .input-form {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 10px 14px;
      transition: border-color 0.2s;
    }
    .input-form:focus-within { border-color: #6366f1; }

    .query-input {
      flex: 1;
      border: none;
      background: transparent;
      resize: none;
      font-size: 0.9rem;
      font-family: inherit;
      color: #1e293b;
      line-height: 1.5;
      max-height: 120px;
      outline: none;
    }
    .query-input::placeholder { color: #94a3b8; }

    .send-btn {
      width: 36px; height: 36px;
      min-width: 36px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .send-btn mat-icon { font-size: 18px; }
  `]
})
export class QueryChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('msgContainer') private msgContainer!: ElementRef;

  readonly connections = signal<DatabaseConnection[]>([]);
  readonly messages    = signal<ChatMessage[]>([]);
  readonly loading     = signal(false);
  private shouldScroll = false;

  connectionCtrl = this.fb.control<string | null>(null, Validators.required);
  queryForm      = this.fb.nonNullable.group({
    query: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(2000)]]
  });

  readonly examples = [
    'Show me all employees',
    'How many employees are there?',
    'List the top 5 employees by ID',
    'Show attendance records for today',
    'What are the payroll details?',
    'Show me employees with their attendance'
  ];

  constructor(
    private fb:          FormBuilder,
    private queryService: QueryService,
    private connService:  ConnectionService,
    private notify:       NotificationService
  ) {}

  ngOnInit(): void {
    this.connService.getAll().subscribe({
      next:  conns => {
        this.connections.set(conns);
        if (conns.length > 0) this.connectionCtrl.setValue(conns[0].id);
      },
      error: () => this.notify.error('Could not load connections.')
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if ((ke.ctrlKey || ke.metaKey) && ke.key === 'Enter') {
      event.preventDefault();
      this.submit();
    }
  }

  autoResize(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  useExample(text: string): void {
    this.queryForm.patchValue({ query: text });
  }

  submit(): void {
    if (this.queryForm.invalid || !this.connectionCtrl.value || this.loading()) return;
    const question = this.queryForm.getRawValue().query.trim();
    if (!question) return;

    this.addMessage({ type: 'user', text: question });
    this.queryForm.reset();
    this.loading.set(true);

    this.queryService.execute({
      connectionId:         this.connectionCtrl.value!,
      naturalLanguageQuery: question
    }).subscribe({
      next:  response => {
        this.addMessage({ type: 'result', text: '', response });
        this.loading.set(false);
      },
      error: err => {
        this.addMessage({
          type: 'error',
          text: err?.error?.title ?? 'Query execution failed. Please try again.'
        });
        this.loading.set(false);
      }
    });
  }

  private addMessage(partial: Omit<ChatMessage, 'id' | 'time'>): void {
    this.messages.update(msgs => [
      ...msgs,
      { ...partial, id: crypto.randomUUID(), time: new Date() }
    ]);
    this.shouldScroll = true;
  }

  private scrollToBottom(): void {
    try {
      const el = this.msgContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
