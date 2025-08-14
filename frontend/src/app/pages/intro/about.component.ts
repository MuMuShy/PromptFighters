import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="about-container">
      <!-- 页面头部 -->
      <header class="intro-header">
        <div class="header-content">
          <h1 class="page-title">關於 Prompt Fighters</h1>
          <p class="page-subtitle">探索 AI 技術與遊戲創新的完美結合</p>
          <div class="header-actions">
            <button (click)="goToLogin()" class="btn-primary">立即登入開始遊戲</button>
            <button (click)="goBack()" class="btn-secondary">返回首頁</button>
          </div>
        </div>
      </header>

      <!-- 项目介绍 -->
      <section class="project-intro">
        <div class="section-content">
          <h2 class="section-title">什麼是 Prompt Fighters？</h2>
          <div class="intro-content">
            <div class="intro-text">
              <p class="main-description">
                Prompt Fighters 是一款革命性的 AI 驅動角色扮演遊戲，我們將最先進的大型語言模型技術融入遊戲體驗中，
                創造出前所未有的互動式遊戲玩法。
              </p>
              <p>
                在這裡，每個玩家都能創造獨一無二的英雄角色，參與由 AI 導演的史詩級戰鬥。
                我們相信，AI 技術不僅能提升遊戲的趣味性，更能為每個玩家提供個性化的遊戲體驗。
              </p>
            </div>
            <div class="intro-image">
              <div class="image-placeholder">
                <span class="placeholder-text">AI 遊戲概念圖</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 核心特色 -->
      <section class="core-features">
        <div class="section-content">
          <h2 class="section-title">核心特色</h2>
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">🤖</div>
              <h3>AI 驅動</h3>
              <p>使用最先進的大型語言模型，為每個英雄生成獨特的背景故事和戰鬥劇情</p>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">🎭</div>
              <h3>個性化體驗</h3>
              <p>每個英雄都是獨一無二的，擁有自己的故事、性格和成長軌跡</p>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">⚔️</div>
              <h3>動態戰鬥</h3>
              <p>戰鬥過程由 AI 即時生成，每次對戰都是全新的體驗</p>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">🚀</div>
              <h3>快速上手</h3>
              <p>使用 Google 帳號一鍵登入，無需複雜的註冊流程</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 技术架构 -->
      <section class="tech-architecture">
        <div class="section-content">
          <h2 class="section-title">技術架構</h2>
          <div class="tech-grid">
            <div class="tech-item">
              <h3>前端技術</h3>
              <ul>
                <li>Angular 17 - 現代化的前端框架</li>
                <li>TypeScript - 類型安全的 JavaScript</li>
                <li>Tailwind CSS - 實用優先的 CSS 框架</li>
                <li>響應式設計 - 支援各種設備</li>
              </ul>
            </div>
            
            <div class="tech-item">
              <h3>後端技術</h3>
              <ul>
                <li>Django - Python Web 框架</li>
                <li>Django REST Framework - API 開發</li>
                <li>PostgreSQL - 關聯式資料庫</li>
                <li>Redis & Celery - 非同步任務處理</li>
              </ul>
            </div>
            
            <div class="tech-item">
              <h3>AI 技術</h3>
              <ul>
                <li>大型語言模型 - 生成英雄背景故事</li>
                <li>自然語言處理 - 戰鬥劇情生成</li>
                <li>智能分析 - 角色屬性計算</li>
                <li>動態內容 - 即時戰鬥生成</li>
              </ul>
            </div>
            
            <div class="tech-item">
              <h3>部署架構</h3>
              <ul>
                <li>Docker - 容器化部署</li>
                <li>Docker Compose - 多服務協調</li>
                <li>Gunicorn - WSGI 伺服器</li>
                <li>Nginx - 反向代理</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- 开发团队 -->
      <section class="development-team">
        <div class="section-content">
          <h2 class="section-title">開發團隊</h2>
          <div class="team-info">
            <p class="team-description">
              Prompt Fighters 由一群熱愛遊戲開發和 AI 技術的工程師共同打造。
              我們致力於將最新的技術創新帶入遊戲世界，為玩家創造前所未有的遊戲體驗。
            </p>
            <div class="team-values">
              <div class="value-item">
                <h3>🎯 創新驅動</h3>
                <p>不斷探索 AI 技術在遊戲中的應用可能</p>
              </div>
              <div class="value-item">
                <h3>👥 用戶為本</h3>
                <p>以玩家體驗為核心，持續優化遊戲功能</p>
              </div>
              <div class="value-item">
                <h3>🔧 技術卓越</h3>
                <p>採用最先進的技術架構，確保遊戲品質</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 未来规划 -->
      <section class="future-plans">
        <div class="section-content">
          <h2 class="section-title">未來規劃</h2>
          <div class="plans-grid">
            <div class="plan-item">
              <div class="plan-icon">🌟</div>
              <h3>新功能開發</h3>
              <p>持續添加新的遊戲模式、英雄類型和管理系統</p>
            </div>
            
            <div class="plan-item">
              <div class="plan-icon">📱</div>
              <h3>移動端支援</h3>
              <p>開發 iOS 和 Android 應用程式，提供更好的移動遊戲體驗</p>
            </div>
            
            <div class="plan-item">
              <div class="plan-icon">🌍</div>
              <h3>多語言支援</h3>
              <p>支援更多語言，讓全球玩家都能享受遊戲樂趣</p>
            </div>
            
            <div class="plan-item">
              <div class="plan-icon">🤝</div>
              <h3>社群功能</h3>
              <p>建立玩家社群，支援好友系統和公會功能</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 联系我们 -->
      <section class="contact-section">
        <div class="section-content">
          <h2 class="section-title">聯繫我們</h2>
          <div class="contact-info">
            <p>如果你有任何問題、建議或合作提案，歡迎與我們聯繫：</p>
            <div class="contact-methods">
              <div class="contact-method">
                <span class="method-icon">🐙</span>
                <span>GitHub: github.com/MuMuShy/PromptFighters</span>
              </div>
              <div class="contact-method">
                <span class="method-icon">📖</span>
                <span>文檔: docs.promptfighters.app</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 召唤行动 -->
      <section class="cta-section">
        <div class="section-content">
          <h2>準備好體驗 AI 技術的未來嗎？</h2>
          <p>加入 Prompt Fighters，成為這場 AI 遊戲革命的先驅者</p>
          <div class="cta-buttons">
            <button (click)="goToLogin()" class="btn-primary btn-large">立即開始遊戲</button>
            <button (click)="goToGuide()" class="btn-secondary">查看遊戲指南</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  constructor(
    private router: Router,
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit() {
    this.setupSEO();
  }

  private setupSEO() {
    this.title.setTitle('關於我們 - Prompt Fighters | AI 驅動遊戲的創新者');
    this.meta.updateTag({ name: 'description', content: '了解 Prompt Fighters 的開發理念、技術架構和未來規劃。探索 AI 技術與遊戲創新的完美結合。' });
    this.meta.updateTag({ name: 'keywords', content: '關於我們,Prompt Fighters,AI遊戲,技術架構,開發團隊' });
    
    // Open Graph 标签
    this.meta.updateTag({ property: 'og:title', content: '關於我們 - Prompt Fighters' });
    this.meta.updateTag({ property: 'og:description', content: 'AI 驅動遊戲的創新者' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: 'https://promptfighters.app/intro/about' });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goBack() {
    this.router.navigate(['/']);
  }

  goToGuide() {
    this.router.navigate(['/intro/guide']);
  }
}
