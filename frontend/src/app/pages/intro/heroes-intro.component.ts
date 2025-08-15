import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { CharacterCardComponent } from '../../shared/character-card.component';

@Component({
  selector: 'app-heroes-intro',
  standalone: true,
  imports: [CommonModule, CharacterCardComponent],
  template: `
    <div class="heroes-intro-container">
      <!-- 页面头部 -->
      <header class="intro-header">
        <div class="header-content">
          <h1 class="page-title">AI 英雄展示</h1>
          <p class="page-subtitle">探索由 AI 創造的獨特英雄世界，每個角色都有獨特的故事與能力</p>
          <div class="header-actions">
            <button (click)="goToLogin()" class="btn-primary">立即登入開始遊戲</button>
            <button (click)="goBack()" class="btn-secondary">返回首頁</button>
          </div>
        </div>

      </header>

      <!-- 英雄展示区域 -->
      <section class="heroes-showcase">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">傳奇英雄陣容</h2>
            <p class="section-description">每個英雄都由 AI 根據名字自動生成獨特的背景故事、性格特徵和初始能力</p>
            <div class="rarity-legend">
              <div class="rarity-item">
                <span class="rarity-badge rarity-1">N</span>
                <span>普通</span>
              </div>
              <div class="rarity-item">
                <span class="rarity-badge rarity-2">R</span>
                <span>稀有</span>
              </div>
              <div class="rarity-item">
                <span class="rarity-badge rarity-3">SR</span>
                <span>超稀有</span>
              </div>
              <div class="rarity-item">
                <span class="rarity-badge rarity-4">SSR</span>
                <span>極稀有</span>
              </div>
              <div class="rarity-item">
                <span class="rarity-badge rarity-5">UR</span>
                <span>傳說</span>
              </div>
            </div>
          </div>
          
          <div class="heroes-grid">
            <app-character-card 
              *ngFor="let hero of sampleHeroes" 
              [character]="hero"
              [token]="''"
              [isDirectImageUrl]="true"
              class="hero-card-wrapper">
            </app-character-card>
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
              <p>每個英雄都有獨特的故事背景，由 AI 根據名字和設定自動生成，創造無限可能</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">⚔️</div>
              <h3>動態屬性系統</h3>
              <p>英雄屬性會根據戰鬥表現和升級系統動態調整，每次戰鬥都是成長的機會</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🌟</div>
              <h3>個性化發展</h3>
              <p>每個英雄都有獨特的成長路徑和技能樹，打造專屬於你的英雄陣容</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🎨</div>
              <h3>視覺化呈現</h3>
              <p>AI 生成的英雄形象，每個角色都有獨特的外觀設計和視覺效果</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 召唤行动 -->
      <section class="cta-section">
        <div class="section-content">
          <h2>準備好創造你的英雄了嗎？</h2>
          <p>加入 Prompt Fighters，讓 AI 為你創造獨一無二的英雄角色，開啟史詩般的冒險之旅</p>
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
      id: '5',
      name: '狂戰士',
      level: 16,
      image_url: '/assets/game/landing/c_2.png',
      skill_description: '戰鬥中越戰越勇的狂戰士，血量越低攻擊力越強',
      strength: 90,
      agility: 55,
      luck: 65,
      rarity: 3,
      win_count: 25,
      loss_count: 8,
      prompt: '狂戰士，戰鬥中越戰越勇的狂戰士',
      created_at: '2024-01-01T00:00:00Z',
      win_rate: 76,
      rarity_name: 'SR',
      star_count: 3,
      player: 'demo',
      player_display_name: 'Demo Player',
      experience: 1600
    },
    {
      id: '6',
      name: '時空法師',
      level: 22,
      image_url: '/assets/game/landing/c_3.png',
      skill_description: '掌控時間與空間的神秘法師，能夠扭曲現實法則',
      strength: 40,
      agility: 75,
      luck: 95,
      rarity: 5,
      win_count: 35,
      loss_count: 6,
      prompt: '時空法師，掌控時間與空間的神秘法師',
      created_at: '2024-01-01T00:00:00Z',
      win_rate: 85,
      rarity_name: 'UR',
      star_count: 5,
      player: 'demo',
      player_display_name: 'Demo Player',
      experience: 2200
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
    this.title.setTitle('AI 英雄展示 - Prompt Fighters | 探索 AI 創造的英雄世界');
    this.meta.updateTag({ name: 'description', content: '瀏覽 Prompt Fighters 中由 AI 創造的獨特英雄。每個英雄都有獨特的故事和能力，展現 AI 技術的無限可能。' });
    this.meta.updateTag({ name: 'keywords', content: 'AI英雄,遊戲角色,Prompt Fighters,英雄展示,AI遊戲' });
    
    // Open Graph 标签
    this.meta.updateTag({ property: 'og:title', content: 'AI 英雄展示 - Prompt Fighters' });
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
