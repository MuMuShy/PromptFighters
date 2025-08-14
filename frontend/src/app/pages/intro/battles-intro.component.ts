import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-battles-intro',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="battles-intro-container">
      <!-- 页面头部 -->
      <header class="intro-header">
        <div class="header-content">
          <h1 class="page-title">精彩戰鬥記錄</h1>
          <p class="page-subtitle">觀看 AI 導演的精采對戰，體驗前所未有的戰鬥樂趣</p>
          <div class="header-actions">
            <button (click)="goToLogin()" class="btn-primary">立即登入開始遊戲</button>
            <button (click)="goBack()" class="btn-secondary">返回首頁</button>
          </div>
        </div>
      </header>

      <!-- 战斗系统介绍 -->
      <section class="battle-system-intro">
        <div class="section-content">
          <h2 class="section-title">AI 導演戰鬥系統</h2>
          <p class="section-description">每場戰鬥都由先進的 AI 技術即時生成，確保每次對戰都是獨一無二的體驗</p>
          
          <div class="system-features">
            <div class="feature-card">
              <div class="feature-icon">🎬</div>
              <h3>AI 導演</h3>
              <p>大型語言模型根據角色屬性和戰鬥場景，即時生成精彩的戰鬥劇情</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">⚡</div>
              <h3>即時生成</h3>
              <p>戰鬥過程並非預設腳本，每次對戰都會產生不同的結果和發展</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🎭</div>
              <h3>角色互動</h3>
              <p>英雄們會根據各自的性格和背景，在戰鬥中展現獨特的行為模式</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 战斗记录展示 -->
      <section class="battles-showcase">
        <div class="section-content">
          <h2 class="section-title">精彩戰鬥回顧</h2>
          <p class="section-description">觀看這些史詩級的對戰，感受 AI 技術帶來的無限可能</p>
          
          <div class="battles-grid">
            <div class="battle-card" *ngFor="let battle of sampleBattles; let i = index">
              <div class="battle-header">
                <div class="battle-heroes">
                  <div class="hero-info">
                    <img [src]="battle.hero1.image" [alt]="battle.hero1.name" class="hero-avatar">
                    <span class="hero-name">{{ battle.hero1.name }}</span>
                  </div>
                  <div class="vs-badge">VS</div>
                  <div class="hero-info">
                    <img [src]="battle.hero2.image" [alt]="battle.hero2.name" class="hero-avatar">
                    <span class="hero-name">{{ battle.hero2.name }}</span>
                  </div>
                </div>
                <div class="battle-result">
                  <span class="winner-label">勝利者</span>
                  <span class="winner-name">{{ battle.winner.name }}</span>
                </div>
              </div>
              
              <div class="battle-content">
                <h4 class="battle-title">{{ battle.title }}</h4>
                <p class="battle-summary">{{ battle.summary }}</p>
                <div class="battle-stats">
                  <div class="stat">
                    <span class="stat-label">戰鬥時長</span>
                    <span class="stat-value">{{ battle.duration }}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">精彩程度</span>
                    <span class="stat-value">{{ battle.excitement }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 战斗流程说明 -->
      <section class="battle-flow">
        <div class="section-content">
          <h2 class="section-title">戰鬥流程</h2>
          <div class="flow-steps">
            <div class="step-item">
              <div class="step-number">1</div>
              <div class="step-content">
                <h3>選擇英雄</h3>
                <p>從你的英雄庫中選擇要出戰的角色</p>
              </div>
            </div>
            <div class="step-item">
              <div class="step-number">2</div>
              <div class="step-content">
                <h3>AI 分析</h3>
                <p>AI 分析雙方英雄的屬性和背景故事</p>
              </div>
            </div>
            <div class="step-item">
              <div class="step-number">3</div>
              <div class="step-content">
                <h3>生成戰鬥</h3>
                <p>AI 根據角色特徵即時生成戰鬥劇情</p>
              </div>
            </div>
            <div class="step-item">
              <div class="step-number">4</div>
              <div class="step-content">
                <h3>觀看結果</h3>
                <p>欣賞 AI 導演的精采戰鬥，獲得獎勵</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 召唤行动 -->
      <section class="cta-section">
        <div class="section-content">
          <h2>準備好體驗 AI 導演的戰鬥了嗎？</h2>
          <p>加入 Prompt Fighters，參與史詩級的 AI 對戰，創造屬於你的傳奇故事</p>
          <div class="cta-buttons">
            <button (click)="goToLogin()" class="btn-primary btn-large">立即開始遊戲</button>
            <button (click)="goToHeroes()" class="btn-secondary">查看英雄展示</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./battles-intro.component.scss']
})
export class BattlesIntroComponent implements OnInit {
  sampleBattles = [
    {
      title: '雷神 vs 暗影刺客 - 光明與黑暗的對決',
      hero1: { name: '雷神索爾', image: '/assets/heroes/thor.jpg' },
      hero2: { name: '暗影刺客', image: '/assets/heroes/assassin.jpg' },
      winner: { name: '雷神索爾' },
      summary: '在烏雲密布的天空下，雷神索爾揮舞著雷神之錘，召喚出萬道閃電。暗影刺客在陰影中穿梭，試圖找到索爾的破綻。最終，索爾的雷霆之力擊破了刺客的隱身術，贏得了這場光明與黑暗的史詩對決。',
      duration: '15 回合',
      excitement: '⭐⭐⭐⭐⭐'
    },
    {
      title: '元素法師 vs 聖光騎士 - 魔法與信仰的較量',
      hero1: { name: '元素法師', image: '/assets/heroes/mage.jpg' },
      hero2: { name: '聖光騎士', image: '/assets/heroes/paladin.jpg' },
      winner: { name: '元素法師' },
      summary: '元素法師召喚出火焰、冰霜、雷電和大地之力，形成強大的元素風暴。聖光騎士憑藉堅定的信仰和神聖護盾，勇敢地衝向法師。經過激烈的魔法對決，元素法師的破壞力最終戰勝了騎士的防禦。',
      duration: '12 回合',
      excitement: '⭐⭐⭐⭐⭐'
    },
    {
      title: '暗影刺客 vs 元素法師 - 速度與魔法的較量',
      hero1: { name: '暗影刺客', image: '/assets/heroes/assassin.jpg' },
      hero2: { name: '元素法師', image: '/assets/heroes/mage.jpg' },
      winner: { name: '暗影刺客' },
      summary: '暗影刺客利用驚人的速度和隱身技巧，在法師周圍快速移動。元素法師雖然擁有強大的魔法，但無法準確鎖定刺客的位置。刺客抓住法師施法的瞬間，發動致命一擊，贏得了這場速度與魔法的較量。',
      duration: '8 回合',
      excitement: '⭐⭐⭐⭐'
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
    this.title.setTitle('精彩戰鬥記錄 - Prompt Fighters | AI 導演戰鬥系統');
    this.meta.updateTag({ name: 'description', content: '觀看 Prompt Fighters 中由 AI 導演的精彩戰鬥。每場戰鬥都是獨一無二的體驗，展現 AI 技術的無限可能。' });
    this.meta.updateTag({ name: 'keywords', content: 'AI戰鬥,遊戲對戰,Prompt Fighters,戰鬥記錄,AI遊戲' });
    
    // Open Graph 标签
    this.meta.updateTag({ property: 'og:title', content: '精彩戰鬥記錄 - Prompt Fighters' });
    this.meta.updateTag({ property: 'og:description', content: 'AI 導演戰鬥系統' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: 'https://promptfighters.app/intro/battles' });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goBack() {
    this.router.navigate(['/']);
  }

  goToHeroes() {
    this.router.navigate(['/intro/heroes']);
  }
}
