import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule }             from '@angular/common';
import { Router, RouterLink }       from '@angular/router';
import {
  FormBuilder, ReactiveFormsModule, Validators
} from '@angular/forms';
import { MatFormFieldModule }       from '@angular/material/form-field';
import { MatInputModule }           from '@angular/material/input';
import { MatSelectModule }          from '@angular/material/select';
import { MatButtonModule }          from '@angular/material/button';
import { MatIconModule }            from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule }         from '@angular/material/tooltip';
import { ConnectionService }        from '../../../core/services/connection.service';
import { NotificationService }      from '../../../core/services/notification.service';

interface ProviderInfo {
  value:       string;
  label:       string;
  icon:        string;
  color:       string;
  defaultPort: string;
  portHint:    string;
  desc:        string;
  example:     string;
}

@Component({
  selector:   'app-connection-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page">

      <!-- Back header -->
      <div class="back-header">
        <a class="back-link" routerLink="/connections">
          <mat-icon>arrow_back</mat-icon>
          <span>Connections</span>
        </a>
      </div>

      <div class="content-wrap">

        <!-- Left: form -->
        <div class="form-panel">
          <div class="panel-header">
            <h1>Add Database Connection</h1>
            <p>Connect a database and start querying it in plain English</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">

            <!-- Step 1: Name + Provider -->
            <div class="step-block">
              <div class="step-label">
                <span class="step-num">1</span>
                Connection Details
              </div>

              <div class="field-row">
                <div class="field-group">
                  <label>Connection name <span class="required">*</span></label>
                  <mat-form-field appearance="outline" class="full-w">
                    <input matInput formControlName="name"
                           placeholder="e.g. Production DB, Analytics DB" />
                    @if (f['name'].invalid && f['name'].touched) {
                      <mat-error>Name is required</mat-error>
                    }
                  </mat-form-field>
                </div>
              </div>

              <div class="field-group">
                <label>Description <span class="optional">(optional)</span></label>
                <mat-form-field appearance="outline" class="full-w">
                  <textarea matInput formControlName="description" rows="2"
                            placeholder="Brief note about what this database contains"></textarea>
                </mat-form-field>
              </div>
            </div>

            <!-- Step 2: Provider -->
            <div class="step-block">
              <div class="step-label">
                <span class="step-num">2</span>
                Database Type
              </div>

              <div class="provider-cards">
                @for (p of providers; track p.value) {
                  <div class="provider-card"
                       [class.selected]="selectedProvider() === p.value"
                       (click)="selectProvider(p)">
                    <div class="p-icon" [style.background]="p.color">
                      <mat-icon>{{ p.icon }}</mat-icon>
                    </div>
                    <div class="p-info">
                      <div class="p-label">{{ p.label }}</div>
                      <div class="p-desc">{{ p.desc }}</div>
                    </div>
                    @if (selectedProvider() === p.value) {
                      <mat-icon class="check-icon">check_circle</mat-icon>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Step 3: Connection params (only if provider selected) -->
            @if (selectedProvider()) {
              <div class="step-block">
                <div class="step-label">
                  <span class="step-num">3</span>
                  Connection Settings
                  <span class="provider-badge">{{ selectedProviderInfo()?.label }}</span>
                </div>

                <!-- Host + Port row -->
                <div class="field-row-2">
                  <div class="field-group">
                    <label>
                      Host / Server <span class="required">*</span>
                      <mat-icon class="help-icon"
                                matTooltip="The hostname or IP address of your database server">
                        help_outline
                      </mat-icon>
                    </label>
                    <mat-form-field appearance="outline" class="full-w">
                      <input matInput formControlName="host"
                             placeholder="{{ hostPlaceholder() }}" />
                      <mat-icon matPrefix>dns</mat-icon>
                      @if (f['host'].invalid && f['host'].touched) {
                        <mat-error>Host is required</mat-error>
                      }
                    </mat-form-field>
                  </div>

                  <div class="field-group port-field">
                    <label>
                      Port <span class="required">*</span>
                      <mat-icon class="help-icon"
                                [matTooltip]="selectedProviderInfo()?.portHint ?? ''">
                        help_outline
                      </mat-icon>
                    </label>
                    <mat-form-field appearance="outline" class="full-w">
                      <input matInput formControlName="port" type="number"
                             [placeholder]="selectedProviderInfo()?.defaultPort ?? ''" />
                      @if (f['port'].invalid && f['port'].touched) {
                        <mat-error>Valid port required</mat-error>
                      }
                    </mat-form-field>
                  </div>
                </div>

                <!-- Database name -->
                <div class="field-group">
                  <label>
                    Database name <span class="required">*</span>
                    <mat-icon class="help-icon"
                              matTooltip="The name of the specific database to connect to (not the server name)">
                      help_outline
                    </mat-icon>
                  </label>
                  <mat-form-field appearance="outline" class="full-w">
                    <input matInput formControlName="database"
                           placeholder="e.g. my_database, analytics, CrudDB" />
                    <mat-icon matPrefix>folder_open</mat-icon>
                    @if (f['database'].invalid && f['database'].touched) {
                      <mat-error>Database name is required</mat-error>
                    }
                  </mat-form-field>
                </div>

                <!-- Username -->
                <div class="field-group">
                  <label>
                    Username <span class="required">*</span>
                    <mat-icon class="help-icon"
                              matTooltip="Tip: use a read-only database user for safety">
                      help_outline
                    </mat-icon>
                  </label>
                  <mat-form-field appearance="outline" class="full-w">
                    <input matInput formControlName="username"
                           placeholder="e.g. db_readonly_user"
                           autocomplete="off" />
                    <mat-icon matPrefix>person_outline</mat-icon>
                    @if (f['username'].invalid && f['username'].touched) {
                      <mat-error>Username is required</mat-error>
                    }
                  </mat-form-field>
                </div>

                <!-- Password -->
                <div class="field-group">
                  <label>Password <span class="required">*</span></label>
                  <mat-form-field appearance="outline" class="full-w">
                    <input matInput [type]="showPwd() ? 'text' : 'password'"
                           formControlName="password"
                           placeholder="••••••••"
                           autocomplete="new-password" />
                    <mat-icon matPrefix>lock_outline</mat-icon>
                    <button mat-icon-button matSuffix type="button"
                            (click)="showPwd.set(!showPwd())">
                      <mat-icon>{{ showPwd() ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    @if (f['password'].invalid && f['password'].touched) {
                      <mat-error>Password is required</mat-error>
                    }
                  </mat-form-field>
                </div>

                <!-- PostgreSQL extras -->
                @if (selectedProvider() === 'PostgreSQL') {
                  <div class="field-row-2">
                    <div class="field-group">
                      <label>
                        Schema / Search Path
                        <span class="optional">(optional)</span>
                        <mat-icon class="help-icon"
                                  matTooltip="Leave blank to use the default 'public' schema, or enter a schema name like 'myschema'">
                          help_outline
                        </mat-icon>
                      </label>
                      <mat-form-field appearance="outline" class="full-w">
                        <input matInput formControlName="schema"
                               placeholder="public" />
                        <mat-icon matPrefix>schema</mat-icon>
                      </mat-form-field>
                    </div>
                    <div class="field-group">
                      <label>
                        SSL Mode
                        <mat-icon class="help-icon"
                                  matTooltip="'Require' enforces SSL. 'Disable' connects without SSL. Use Require for cloud databases.">
                          help_outline
                        </mat-icon>
                      </label>
                      <mat-form-field appearance="outline" class="full-w">
                        <mat-select formControlName="sslMode">
                          <mat-option value="">Prefer (default)</mat-option>
                          <mat-option value="require">Require (recommended for cloud)</mat-option>
                          <mat-option value="disable">Disable</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>
                  </div>
                }

                <!-- SQL Server extras -->
                @if (selectedProvider() === 'SqlServer') {
                  <div class="field-group">
                    <label>
                      Trust Server Certificate
                      <mat-icon class="help-icon"
                                matTooltip="Enable this for local or self-signed SSL certificates. Disable for production with valid certificates.">
                        help_outline
                      </mat-icon>
                    </label>
                    <mat-form-field appearance="outline" class="full-w">
                      <mat-select formControlName="trustCert">
                        <mat-option value="true">Yes (for local/self-signed certs)</mat-option>
                        <mat-option value="false">No (production with valid cert)</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                }

                <!-- Generated connection string preview -->
                <div class="preview-box">
                  <div class="preview-header">
                    <mat-icon>code</mat-icon>
                    Connection string preview
                    <span class="preview-note">(encrypted before saving)</span>
                  </div>
                  <code class="preview-code">{{ generatedConnectionString() }}</code>
                </div>
              </div>
            }

            <!-- Actions -->
            <div class="form-actions">
              <a class="cancel-btn" routerLink="/connections">Cancel</a>
              <button class="submit-btn"
                      type="submit"
                      [disabled]="form.invalid || !selectedProvider() || loading()">
                @if (loading()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <mat-icon>add_link</mat-icon>
                  Add Connection
                }
              </button>
            </div>

          </form>
        </div>

        <!-- Right: help panel -->
        <div class="help-panel">
          @if (selectedProviderInfo(); as p) {
            <div class="help-card">
              <div class="help-header">
                <div class="help-icon" [style.background]="p.color">
                  <mat-icon>{{ p.icon }}</mat-icon>
                </div>
                <span>{{ p.label }} Guide</span>
              </div>

              <div class="help-section">
                <div class="help-subtitle">Example connection</div>
                <code class="help-code">{{ p.example }}</code>
              </div>

              <div class="help-section">
                <div class="help-subtitle">Tips</div>
                <ul class="tips-list">
                  @for (tip of providerTips(); track tip) {
                    <li>
                      <mat-icon>check</mat-icon>
                      {{ tip }}
                    </li>
                  }
                </ul>
              </div>
            </div>
          } @else {
            <div class="help-card placeholder-card">
              <mat-icon class="ph-icon">storage</mat-icon>
              <h3>Choose a database type</h3>
              <p>Select PostgreSQL, SQL Server, or MySQL to get started. We'll show you exactly what to fill in.</p>
            </div>
          }

          <div class="security-note">
            <mat-icon>shield</mat-icon>
            <div>
              <div class="sn-title">Your credentials are safe</div>
              <div class="sn-desc">Connection strings are encrypted with AES-256 and never logged or shared.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .page {
      padding: 24px 32px;
      min-height: 100%;
      background: #f8fafc;
    }

    /* Back link */
    .back-header { margin-bottom: 24px; }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #64748b;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: color 0.15s;
    }
    .back-link:hover { color: #6366f1; }
    .back-link mat-icon { font-size: 18px; }

    /* Layout */
    .content-wrap {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
      align-items: flex-start;
      max-width: 1100px;
    }

    /* Form panel */
    .form-panel {
      background: white;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      padding: 32px;
    }

    .panel-header { margin-bottom: 32px; }
    .panel-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px;
    }
    .panel-header p { color: #64748b; margin: 0; font-size: 0.875rem; }

    /* Step blocks */
    .step-block {
      margin-bottom: 28px;
      padding-bottom: 28px;
      border-bottom: 1px solid #f1f5f9;
    }
    .step-block:last-of-type { border-bottom: none; }

    .step-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 16px;
    }
    .step-num {
      width: 24px; height: 24px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .provider-badge {
      background: rgba(99,102,241,0.1);
      color: #6366f1;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* Fields */
    .field-group { margin-bottom: 16px; }
    .field-group label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }
    .full-w { width: 100%; }
    .required { color: #dc2626; }
    .optional { color: #94a3b8; font-weight: 400; font-size: 0.75rem; }
    .help-icon { font-size: 14px; color: #94a3b8; cursor: help; }

    .field-row { }
    .field-row-2 { display: grid; grid-template-columns: 1fr 160px; gap: 12px; }
    .port-field { }

    /* Provider cards */
    .provider-cards { display: flex; flex-direction: column; gap: 10px; }
    .provider-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .provider-card:hover {
      border-color: #c7d2fe;
      background: rgba(99,102,241,0.02);
    }
    .provider-card.selected {
      border-color: #6366f1;
      background: rgba(99,102,241,0.04);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
    }

    .p-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .p-icon mat-icon { color: white; font-size: 22px; }

    .p-info { flex: 1; }
    .p-label { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
    .p-desc  { font-size: 0.75rem; color: #64748b; margin-top: 2px; }

    .check-icon { color: #6366f1; font-size: 20px; }

    /* Connection string preview */
    .preview-box {
      background: #0f172a;
      border-radius: 10px;
      padding: 14px 16px;
      margin-top: 8px;
    }
    .preview-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .preview-header mat-icon { font-size: 14px; }
    .preview-note { color: #475569; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .preview-code {
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      color: #a5b4fc;
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.5;
    }

    /* Form actions */
    .form-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #f1f5f9;
    }
    .cancel-btn {
      font-size: 0.875rem;
      font-weight: 500;
      color: #64748b;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .cancel-btn:hover { background: #f1f5f9; }

    .submit-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px 20px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .submit-btn mat-icon { font-size: 18px; }

    /* ── Help panel ─────────────────────────────────── */
    .help-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: sticky;
      top: 24px;
    }

    .help-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 20px;
    }

    .help-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 16px;
    }
    .help-icon {
      width: 32px; height: 32px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .help-icon mat-icon { color: white; font-size: 18px; }

    .help-section { margin-bottom: 16px; }
    .help-subtitle {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .help-code {
      display: block;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      font-family: 'Courier New', monospace;
      font-size: 0.72rem;
      color: #374151;
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.6;
    }

    .tips-list { list-style: none; margin: 0; padding: 0; }
    .tips-list li {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 0.78rem;
      color: #475569;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    .tips-list li mat-icon { font-size: 14px; color: #10b981; flex-shrink: 0; margin-top: 1px; }

    .placeholder-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 20px;
    }
    .ph-icon { font-size: 40px; color: #cbd5e1; margin-bottom: 12px; }
    .placeholder-card h3 { margin: 0 0 8px; color: #374151; font-size: 0.95rem; }
    .placeholder-card p  { margin: 0; color: #94a3b8; font-size: 0.8rem; line-height: 1.5; }

    .security-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 14px;
    }
    .security-note mat-icon { color: #16a34a; font-size: 20px; flex-shrink: 0; margin-top: 1px; }
    .sn-title { font-size: 0.8rem; font-weight: 600; color: #16a34a; }
    .sn-desc  { font-size: 0.75rem; color: #166534; margin-top: 2px; line-height: 1.4; }

    @media (max-width: 900px) {
      .content-wrap { grid-template-columns: 1fr; }
      .help-panel { position: static; }
    }
  `]
})
export class ConnectionFormComponent {
  readonly loading = signal(false);
  readonly showPwd = signal(false);

  readonly providers: ProviderInfo[] = [
    {
      value:       'PostgreSQL',
      label:       'PostgreSQL',
      icon:        'storage',
      color:       '#336791',
      defaultPort: '5432',
      portHint:    'Default PostgreSQL port is 5432. Cloud providers like Supabase, Neon, Railway may use different ports.',
      desc:        'Open-source relational database — Supabase, Neon, Railway, AWS RDS, etc.',
      example:     'Host=localhost;\nPort=5432;\nDatabase=mydb;\nUsername=admin;\nPassword=secret'
    },
    {
      value:       'SqlServer',
      label:       'SQL Server',
      icon:        'dns',
      color:       '#e74c3c',
      defaultPort: '1433',
      portHint:    'Default SQL Server port is 1433. Azure SQL Database uses port 1433 too.',
      desc:        'Microsoft SQL Server — Azure SQL, AWS RDS SQL Server, on-premise',
      example:     'Server=localhost,1433;\nDatabase=mydb;\nUser Id=sa;\nPassword=secret'
    },
    {
      value:       'MySQL',
      label:       'MySQL',
      icon:        'table_chart',
      color:       '#4479a1',
      defaultPort: '3306',
      portHint:    'Default MySQL port is 3306. PlanetScale and other cloud providers may use different ports.',
      desc:        'MySQL / MariaDB — PlanetScale, AWS RDS MySQL, on-premise',
      example:     'Server=localhost;\nPort=3306;\nDatabase=mydb;\nUser=admin;\nPassword=secret'
    }
  ];

  form = this.fb.nonNullable.group({
    // Step 1
    name:        ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    // Step 2
    provider:    [''],
    // Step 3
    host:        [''],
    port:        [''],
    database:    [''],
    username:    [''],
    password:    [''],
    // PostgreSQL extras
    schema:      [''],
    sslMode:     [''],
    // SQL Server extras
    trustCert:   ['true']
  });

  get f() { return this.form.controls; }

  readonly selectedProvider = signal<string>('');

  readonly selectedProviderInfo = computed(() =>
    this.providers.find(p => p.value === this.selectedProvider()) ?? null
  );

  readonly hostPlaceholder = computed(() => {
    switch (this.selectedProvider()) {
      case 'PostgreSQL': return 'e.g. localhost or db.example.com';
      case 'SqlServer':  return 'e.g. localhost or server.database.windows.net';
      case 'MySQL':      return 'e.g. localhost or db.example.com';
      default:           return 'hostname or IP address';
    }
  });

  readonly providerTips = computed(() => {
    switch (this.selectedProvider()) {
      case 'PostgreSQL': return [
        'Use a read-only database user for better security',
        'For Supabase: use the "pooler" connection string from Project Settings',
        'Set the Search Path to the schema you want to query (e.g. public)',
        'Enable SSL Require for any cloud-hosted database'
      ];
      case 'SqlServer': return [
        'Use a login with SELECT permission only, not sa',
        'For Azure SQL: your server name ends with .database.windows.net',
        'Enable "Trust Server Certificate" if you get SSL errors locally',
        'Make sure SQL Server Authentication is enabled (not Windows only)'
      ];
      case 'MySQL': return [
        'Create a dedicated user: GRANT SELECT ON mydb.* TO "reader"@"%"',
        'For PlanetScale: use the connection string from the Dashboard',
        'Remote access must be allowed in MySQL — check bind-address in my.cnf',
        'Use SSL for any internet-facing MySQL instance'
      ];
      default: return [];
    }
  });

  readonly generatedConnectionString = computed(() => {
    const host     = this.f['host'].value?.trim() || '<host>';
    const port     = this.f['port'].value?.trim() || this.selectedProviderInfo()?.defaultPort || '<port>';
    const db       = this.f['database'].value?.trim() || '<database>';
    const user     = this.f['username'].value?.trim() || '<username>';
    const pwd      = this.f['password'].value ? '••••••••' : '<password>';

    switch (this.selectedProvider()) {
      case 'PostgreSQL': {
        const schema  = this.f['schema'].value?.trim();
        const ssl     = this.f['sslMode'].value?.trim();
        let cs = `Host=${host};Port=${port};Database=${db};Username=${user};Password=${pwd}`;
        if (schema) cs += `;Search Path=${schema}`;
        if (ssl)    cs += `;SSL Mode=${ssl}`;
        return cs;
      }
      case 'SqlServer': {
        const trust = this.f['trustCert'].value;
        return `Server=${host},${port};Database=${db};User Id=${user};Password=${pwd};TrustServerCertificate=${trust}`;
      }
      case 'MySQL': {
        return `Server=${host};Port=${port};Database=${db};User=${user};Password=${pwd}`;
      }
      default:
        return '';
    }
  });

  constructor(
    private fb:          FormBuilder,
    private connService: ConnectionService,
    private notify:      NotificationService,
    private router:      Router
  ) {}

  selectProvider(p: ProviderInfo): void {
    this.selectedProvider.set(p.value);
    this.f['provider'].setValue(p.value);
    this.f['port'].setValue(p.defaultPort);
    this.f['host'].addValidators(Validators.required);
    this.f['database'].addValidators(Validators.required);
    this.f['username'].addValidators(Validators.required);
    this.f['password'].addValidators(Validators.required);
    this.form.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.invalid || !this.selectedProvider()) return;
    this.loading.set(true);

    // Build the real connection string (with actual password)
    const host  = this.f['host'].value!.trim();
    const port  = this.f['port'].value!.trim();
    const db    = this.f['database'].value!.trim();
    const user  = this.f['username'].value!.trim();
    const pwd   = this.f['password'].value!;

    let connectionString = '';
    switch (this.selectedProvider()) {
      case 'PostgreSQL': {
        const schema = this.f['schema'].value?.trim();
        const ssl    = this.f['sslMode'].value?.trim();
        connectionString = `Host=${host};Port=${port};Database=${db};Username=${user};Password=${pwd}`;
        if (schema) connectionString += `;Search Path=${schema}`;
        if (ssl)    connectionString += `;SSL Mode=${ssl}`;
        break;
      }
      case 'SqlServer': {
        const trust = this.f['trustCert'].value ?? 'true';
        connectionString = `Server=${host},${port};Database=${db};User Id=${user};Password=${pwd};TrustServerCertificate=${trust}`;
        break;
      }
      case 'MySQL': {
        connectionString = `Server=${host};Port=${port};Database=${db};User=${user};Password=${pwd}`;
        break;
      }
    }

    this.connService.create({
      name:             this.f['name'].value!,
      description:      this.f['description'].value ?? '',
      provider:         this.selectedProvider(),
      connectionString
    } as any).subscribe({
      next: () => {
        this.notify.success('Connection created successfully.');
        this.router.navigate(['/connections']);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error(err?.error?.title ?? 'Failed to create connection.');
      },
      complete: () => this.loading.set(false)
    });
  }
}
