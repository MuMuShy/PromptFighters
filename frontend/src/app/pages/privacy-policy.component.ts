import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-wrapper">
        <div class="legal-container" [innerHTML]="content$ | async"></div>
    </div>
  `,
  styles: [`
    .page-wrapper {
        padding: 2rem;
        min-height: 100vh;
        background-color: #f1f5f9; /* light gray background */
    }
    .legal-container {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      padding: 2rem 3rem;
      max-width: 800px;
      margin: 0 auto;
      color: #333;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
  `]
})
export class PrivacyPolicyComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  content$!: Observable<SafeHtml>;

  ngOnInit() {
    this.content$ = this.http.get('/assets/privacy_policy.html', { responseType: 'text' })
      .pipe(
        map(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const bodyContent = doc.querySelector('.container')?.innerHTML || '';
          return this.sanitizer.bypassSecurityTrustHtml(bodyContent);
        })
      );
  }
} 