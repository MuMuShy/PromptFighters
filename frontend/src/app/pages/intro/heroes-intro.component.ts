import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-heroes-intro',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="heroes-intro-container">
      <!-- 页面头部 -->
      <header class="intro-header">
        <div class="header-content">
          <h1 class="page-title">遊戲英雄展示</h1>
          <p class="page-subtitle">探索由 AI 創造的獨特英雄世界</p>
          <div class="header-actions">
            <button (click)="goToLogin()" class="btn-primary">立即登入開始遊戲</button>
            <button (click)="goBack()" class="btn-secondary">返回首頁</button>
          </div>
        </div>
      </header>

      <!-- 英雄展示区域 -->
      <section class="heroes-showcase">
        <div class="section-content">
          <h2 class="section-title">AI 創造的英雄</h2>
          <p class="section-description">每個英雄都由 AI 根據名字自動生成獨特的背景故事、性格特徵和初始能力</p>
          
          <div class="heroes-grid">
            <div class="hero-card" *ngFor="let hero of sampleHeroes; let i = index">
              <div class="hero-avatar">
                <img [src]="hero.image" [alt]="hero.name" class="hero-image">
                <div class="hero-level">{{ hero.level }}</div>
              </div>
              <div class="hero-info">
                <h3 class="hero-name">{{ hero.name }}</h3>
                <p class="hero-description">{{ hero.description }}</p>
                <div class="hero-stats">
                  <div class="stat-item">
                    <span class="stat-label">力量</span>
                    <span class="stat-value">{{ hero.stats.strength }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">敏捷</span>
                    <span class="stat-value">{{ hero.stats.agility }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">幸運</span>
                    <span class="stat-value">{{ hero.stats.luck }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 特色说明 -->
      <section class="features-section">
        <div class="section-content">
          <h2 class="section-title">英雄系統特色</h2>
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">🎭</div>
              <h3>AI 生成背景</h3>
              <p>每個英雄都有獨特的故事背景，由 AI 根據名字和設定自動生成</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">⚔️</div>
              <h3>動態屬性</h3>
              <p>英雄屬性會根據戰鬥表現和升級系統動態調整</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🌟</div>
              <h3>個性化發展</h3>
              <p>每個英雄都有獨特的成長路徑和技能樹</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 召唤行动 -->
      <section class="cta-section">
        <div class="section-content">
          <h2>準備好創造你的英雄了嗎？</h2>
          <p>加入 Prompt Fighters，讓 AI 為你創造獨一無二的英雄角色</p>
          <div class="cta-buttons">
            <button (click)="goToLogin()" class="btn-primary btn-large">立即開始遊戲</button>
            <button (click)="goToGuide()" class="btn-secondary">查看遊戲指南</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./heroes-intro.component.scss']
})
export class HeroesIntroComponent implements OnInit {
  sampleHeroes = [
    {
      name: '雷神索爾',
      level: 15,
      image: '/assets/heroes/thor.jpg',
      description: '來自阿斯加德的雷神，擁有操控雷電的神力，性格豪爽直率，是九界中最強大的戰士之一。',
      stats: { strength: 85, agility: 70, luck: 75 }
    },
    {
      name: '暗影刺客',
      level: 12,
      image: '/assets/heroes/assassin.jpg',
      description: '行走於陰影中的神秘刺客，擅長隱匿和暗殺技巧，擁有驚人的速度和精準的攻擊力。',
      stats: { strength: 65, agility: 95, luck: 80 }
    },
    {
      name: '元素法師',
      level: 18,
      image: '/assets/heroes/mage.jpg',
      description: '掌控四大元素的強大法師，能夠召喚火焰、冰霜、雷電和大地之力，是戰場上的魔法大師。',
      stats: { strength: 45, agility: 60, luck: 90 }
    },
    {
      name: '聖光騎士',
      level: 20,
      image: '/assets/heroes/paladin.jpg',
      description: '信仰聖光的正義騎士，擁有強大的防禦力和治療能力，是團隊中不可或缺的守護者。',
      stats: { strength: 80, agility: 65, luck: 70 }
    }
  ];

  constructor(
    private router: Router,
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit() {
    this.setupSEO();
  }

  private setupSEO() {
    this.title.setTitle('遊戲英雄展示 - Prompt Fighters | 探索 AI 創造的英雄世界');
    this.meta.updateTag({ name: 'description', content: '瀏覽 Prompt Fighters 中由 AI 創造的獨特英雄。每個英雄都有獨特的故事和能力，展現 AI 技術的無限可能。' });
    this.meta.updateTag({ name: 'keywords', content: 'AI英雄,遊戲角色,Prompt Fighters,英雄展示,AI遊戲' });
    
    // Open Graph 标签
    this.meta.updateTag({ property: 'og:title', content: '遊戲英雄展示 - Prompt Fighters' });
    this.meta.updateTag({ property: 'og:description', content: '探索 AI 創造的英雄世界' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: 'https://promptfighters.app/intro/heroes' });
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
