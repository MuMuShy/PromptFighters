import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing-container">
      <!-- 1. Hero Section with Animated Background -->
      <section class="hero-section">
        
        <div class="hero-content relative z-10">
          <div class="game-logo">
            <h1 class="hero-title">PromptFighters</h1>
            <div class="logo-subtitle">AI 英雄對戰</div>
          </div>
          
          <p class="hero-subtitle">一個指令，創造你的專屬英雄。一場戰鬥，見證 AI 的無限可能。</p>
          
          <div class="hero-stats">
            <div class="stat-item">
              <span class="stat-number">{{ totalPlayers }}+</span>
              <span class="stat-label">活躍玩家</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalBattles }}+</span>
              <span class="stat-label">精彩對戰</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalHeroes }}+</span>
              <span class="stat-label">獨特英雄</span>
            </div>
          </div>
          
          <div class="hero-buttons">
            <button (click)="startAdventure()" class="btn-primary btn-glow">
              <span class="btn-icon">🚀</span>
              <span class="btn-text">立刻開始冒險</span>
            </button>
            <button (click)="scrollToFeatures()" class="btn-secondary">
              <span class="btn-icon">⚔️</span>
              <span class="btn-text">了解遊戲特色</span>
            </button>
          </div>
          
          <div class="scroll-indicator">
            <div class="scroll-arrow"></div>
            <span>向下滾動探索更多</span>
          </div>
        </div>
      </section>

      <!-- 2. Features Section with Interactive Cards -->
      <section id="features" class="section features-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">這不僅是遊戲，更是你的創意戰場</h2>
            <p class="section-description">我們將複雜的 AI 技術，轉化為你手中最强大的創作工具。</p>
          </div>
          
          <div class="features-grid">
            <div class="feature-card" *ngFor="let feature of features; let i = index">
              <div class="feature-icon-wrapper">
                <div class="feature-icon">{{ feature.icon }}</div>
                <div class="icon-glow"></div>
              </div>
              <h3 class="feature-title">{{ feature.title }}</h3>
              <p class="feature-description">{{ feature.description }}</p>
              <div class="feature-highlight">{{ feature.highlight }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. AI Character Showcase with Real Images -->
      <section class="section showcase-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">遇見 AI 為你創造的英雄</h2>
            <p class="section-description">從威嚴的騎士到神秘的法師，每個英雄都擁有由 AI 生成的獨特靈魂。</p>
          </div>
          
          <div class="showcase-grid">
            <div class="hero-card" *ngFor="let hero of sampleHeroes; let i = index">
              <div class="hero-card-inner">
                <div class="hero-avatar-wrapper">
                  <img [src]="hero.image" [alt]="hero.name" class="hero-avatar-img">
                  <div class="avatar-ring"></div>
                  <div class="hero-level">{{ hero.level }}</div>
                </div>
                <h3 class="hero-name">{{ hero.name }}</h3>
                <p class="hero-desc">{{ hero.description }}</p>
                <div class="hero-stats-mini">
                  <span class="stat">力量: {{ hero.stats.strength }}</span>
                  <span class="stat">敏捷: {{ hero.stats.agility }}</span>
                  <span class="stat">幸運: {{ hero.stats.luck }}</span>
                </div>
                <div class="hero-rarity" [class]="hero.rarity">{{ hero.rarity }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 4. Battle Preview Section with Real-time Animation -->
      <section class="section battle-preview-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">每一場戰鬥，都是一齣精彩好戲</h2>
            <p class="section-description">AI 導演將根據角色性格與戰況，即時生成充滿戲劇性的戰鬥描述。</p>
          </div>
          
          <div class="battle-demo">
            <div class="battle-header">
              <div class="battle-title">實時戰鬥演示</div>
              <div class="battle-controls">
                <button (click)="playBattleDemo()" class="btn-play" [class.playing]="isPlaying">
                  {{ isPlaying ? '⏸️' : '▶️' }}
                </button>
                <button (click)="resetBattleDemo()" class="btn-reset">🔄</button>
              </div>
            </div>
            
            <div class="battle-scene">
              <div class="battle-characters">
                <div class="character-left">
                  <img [src]="battleScene.character1.image" [alt]="battleScene.character1.name" class="battle-char-img">
                  <div class="char-name">{{ battleScene.character1.name }}</div>
                  <div class="char-hp">
                    <div class="hp-bar">
                      <div class="hp-fill" [style.width.%]="battleScene.character1.hp"></div>
                    </div>
                    <span class="hp-text">{{ battleScene.character1.hp }}%</span>
                  </div>
                </div>
                
                <div class="battle-vs">VS</div>
                
                <div class="character-right">
                  <img [src]="battleScene.character2.image" [alt]="battleScene.character2.name" class="battle-char-img">
                  <div class="char-name">{{ battleScene.character2.name }}</div>
                  <div class="char-hp">
                    <div class="hp-bar">
                      <div class="hp-fill" [style.width.%]="battleScene.character2.hp"></div>
                    </div>
                    <span class="hp-text">{{ battleScene.character2.hp }}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="battle-log" #battleLog>
              <div class="battle-entry" *ngFor="let entry of battlePreview; let i = index" 
                   [ngClass]="entry.type">
                <span class="battle-text">{{ entry.text }}</span>
                <span class="battle-timestamp">{{ entry.timestamp }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. Game Economy Section -->
      <section class="section economy-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">遊戲經濟系統</h2>
            <p class="section-description">雙代幣模型，平衡遊戲性與收益性</p>
          </div>
          
          <div class="economy-grid">
            <div class="economy-card" *ngFor="let token of economyTokens">
              <div class="token-icon"><img src="{{ token.icon }}" alt="{{ token.name }}" /></div>
              <h3>{{ token.name }}</h3>
              <p>{{ token.description }}</p>
              <div class="token-uses">
                <span *ngFor="let use of token.uses" class="use-tag">{{ use }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. Final CTA Section with Parallax -->
      <section class="section cta-section">
        <div class="parallax-bg"></div>
        <div class="section-content">
          <h2 class="cta-title">準備好指揮你的 AI 英雄了嗎？</h2>
          <p class="cta-subtitle">你的傳奇故事，現在開始。</p>
          
          <div class="cta-features">
            <div class="cta-feature">
              <span class="feature-icon">🎮</span>
              <span>免費遊玩</span>
            </div>
            <div class="cta-feature">
              <span class="feature-icon">⚡</span>
              <span>即時對戰</span>
            </div>
            <div class="cta-feature">
              <span class="feature-icon">🏆</span>
              <span>競技排名</span>
            </div>
          </div>
          
          <button (click)="startAdventure()" class="btn-primary btn-large btn-glow">
            <span class="btn-icon">🔥</span>
            <span class="btn-text">免費加入戰鬥</span>
          </button>
          
          <div class="social-proof">
            <p>已有 <strong>{{ totalPlayers }}+</strong> 玩家加入戰鬥</p>
            <!-- <div class="social-links">
              <a href="#" class="social-link">Discord</a>
              <a href="#" class="social-link">Twitter</a>
              <a href="#" class="social-link">Telegram</a>
            </div> -->
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, AfterViewInit {
  @ViewChild('battleLog') battleLog!: ElementRef;
  
  // 统计数据
  totalPlayers = 1250;
  totalBattles = 8500;
  totalHeroes = 3200;
  
  // 战斗演示状态
  isPlaying = false;
  private battleInterval: any;
  

  features = [
    {
      icon: '✨',
      title: '無限創造',
      description: '只需一個名字，AI 就能為你生成獨特的背景故事、性格和技能，讓每個英雄都獨一無二。',
      highlight: 'AI 驅動'
    },
    {
      icon: '⚔️',
      title: '動態戰鬥',
      description: '告別固定腳本。AI 將根據戰況即時生成戰鬥過程，每一次對決都充滿未知與驚喜。',
      highlight: '即時生成'
    },
    {
      icon: '📊',
      title: '見證成長',
      description: '追蹤英雄的戰鬥歷史與數據，分析戰術，調整策略，見證他們從新手到傳奇的蛻變。',
      highlight: '數據分析'
    }
  ];

  sampleHeroes = [
    { 
      image: '/assets/game/landing/c_1.png',
      name: '燼龍騎士 奧古斯特', 
      description: '被龍血詛咒的騎士，揮舞著能燃燒一切的巨劍。',
      stats: { strength: 95, agility: 78, luck: 65 },
      rarity: 'legendary',
      level: 'Lv.50'
    },
    { 
      image: '/assets/game/landing/c_2.png',
      name: '冰霜女巫 莉安德拉', 
      description: '來自北境的神秘女巫，能將敵人的靈魂凍結。',
      stats: { strength: 72, agility: 88, luck: 82 },
      rarity: 'epic',
      level: 'Lv.45'
    },
    { 
      image: '/assets/game/landing/c_3.png',
      name: '森之守護者 芬恩', 
      description: '與古老森林共生的德魯伊，能召喚自然之力作戰。',
      stats: { strength: 85, agility: 92, luck: 75 },
      rarity: 'rare',
      level: 'Lv.42'
    }
  ];

  // 战斗场景配置
  battleScene = {
    character1: {
      name: '燼龍騎士 奧古斯特',
      image: '/assets/game/landing/c_1.png',
      hp: 85
    },
    character2: {
      name: '冰霜女巫 莉安德拉',
      image: '/assets/game/landing/c_2.png',
      hp: 72
    }
  };

  battlePreview = [
    { text: '燼龍騎士 奧古斯特 咆哮著，劍上的火焰化為一條巨龍撲向敵人！', type: 'action', timestamp: '00:01' },
    { text: '敵人被火焰吞噬，受到 210 點重創！', type: 'damage', timestamp: '00:02' },
    { text: '冰霜女巫 莉安德拉 輕聲吟唱，一道冰牆拔地而起，擋下了致命的反擊。', type: 'defense', timestamp: '00:03' },
    { text: '戰鬥的節奏因這次完美的防禦而徹底改變。', type: 'info', timestamp: '00:04' }
  ];

  economyTokens = [
    {
      icon: '/assets/game/prompt.png',
      name: '$PROMPT',
      description: '鏈上價值代幣，用於 NFT 鑄造和高階遊戲內消耗',
      uses: ['NFT 鑄造', '高階召喚', '治理投票']
    },
    {
      icon: '/assets/game/gold_coin.png',
      name: '$GOLD',
      description: '遊戲內通用貨幣，用於角色升級和日常消耗',
      uses: ['角色升級', '標準召喚', '日常交易']
    },
    {
      icon: '/assets/game/prompt_power.png',
      name: 'Prompt Power',
      description: '召喚系統的初始道具，使用AI咒力創建角色',
      uses: ['角色召喚', '活動參與', '特殊獎勵']
    }
  ];

  constructor(
    private router: Router,
    private meta: Meta,
    private title: Title
  ) {}

  ngOnInit() {
    this.setupSEO();
  }

  ngAfterViewInit() {
    this.initializeAnimations();
  }

  private setupSEO() {
    // 设置页面标题和元数据
    this.title.setTitle('PromptFighters - AI 英雄對戰遊戲 | 免費遊玩');
    
    this.meta.addTags([
      { name: 'description', content: 'PromptFighters 是一個革命性的 AI 英雄對戰遊戲。使用 AI 技術創造獨特英雄，參與史詩級戰鬥，體驗前所未有的遊戲體驗。免費遊玩，立即加入！' },
      { name: 'keywords', content: 'AI遊戲,英雄對戰,區塊鏈遊戲,免費遊戲,PromptFighters,AI英雄,對戰遊戲' },
      { name: 'author', content: 'PromptFighters Team' },
      { name: 'robots', content: 'index, follow' },
      
      // Open Graph
      { property: 'og:title', content: 'PromptFighters - AI 英雄對戰遊戲' },
      { property: 'og:description', content: '使用 AI 技術創造獨特英雄，參與史詩級戰鬥。免費遊玩，立即加入！' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://promptfighters.app' },
      { property: 'og:image', content: '/assets/og_image.png' },
      
      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'PromptFighters - AI 英雄對戰遊戲' },
      { name: 'twitter:description', content: '使用 AI 技術創造獨特英雄，參與史詩級戰鬥。免費遊玩，立即加入！' },
      { name: 'twitter:image', content: '/assets/og_image.png' }
    ]);
  }

  private initializeAnimations() {
    // 初始化滚动动画
    this.setupScrollAnimations();
    
  }

  private setupScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);

    // 观察所有需要动画的元素
    document.querySelectorAll('.feature-card, .hero-card, .economy-card').forEach(el => {
      observer.observe(el);
    });
  }


  playBattleDemo() {
    if (this.isPlaying) {
      this.pauseBattleDemo();
    } else {
      this.isPlaying = true;
      this.battleInterval = setInterval(() => {
        this.addBattleEntry();
        this.updateBattleScene();
      }, 2000);
    }
  }

  pauseBattleDemo() {
    this.isPlaying = false;
    if (this.battleInterval) {
      clearInterval(this.battleInterval);
    }
  }

  resetBattleDemo() {
    this.pauseBattleDemo();
    this.battlePreview = [];
    this.resetBattleScene();
    this.addBattleEntry();
  }

  private updateBattleScene() {
    // 模拟战斗过程，随机减少血量
    if (Math.random() > 0.5) {
      this.battleScene.character1.hp = Math.max(0, this.battleScene.character1.hp - Math.floor(Math.random() * 15));
    } else {
      this.battleScene.character2.hp = Math.max(0, this.battleScene.character2.hp - Math.floor(Math.random() * 15));
    }
  }

  private resetBattleScene() {
    this.battleScene.character1.hp = 85;
    this.battleScene.character2.hp = 72;
  }

  private addBattleEntry() {
    const battleTexts = [
      '戰鬥開始！雙方英雄蓄勢待發...',
      '燼龍騎士發動火焰衝擊！',
      '敵人閃避成功，反擊一擊！',
      '冰霜女巫施展冰凍法術！',
      '戰鬥進入白熱化階段！',
      '燼龍騎士的火焰劍氣橫掃全場！',
      '冰霜女巫召喚暴風雪！',
      '雙方勢均力敵，戰鬥愈發激烈！'
    ];

    const types = ['action', 'damage', 'defense', 'info'];
    const randomText = battleTexts[Math.floor(Math.random() * battleTexts.length)];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const timestamp = new Date().toLocaleTimeString('zh-TW', { 
      minute: '2-digit', 
      second: '2-digit' 
    });

    this.battlePreview.push({
      text: randomText,
      type: randomType,
      timestamp: timestamp
    });

    // 保持最多5条记录
    if (this.battlePreview.length > 5) {
      this.battlePreview.shift();
    }

    // 自动滚动到底部
    setTimeout(() => {
      if (this.battleLog) {
        this.battleLog.nativeElement.scrollTop = this.battleLog.nativeElement.scrollHeight;
      }
    }, 100);
  }

  startAdventure() {
    this.router.navigate(['/login']);
  }

  scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
} 