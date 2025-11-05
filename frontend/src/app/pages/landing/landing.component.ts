import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { LanguageService } from '../../services/language.service';
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, LanguageSelectorComponent, TranslateModule],
  template: `
    <div class="landing-container">
      <!-- 1. Hero Section with Animated Background -->
      <section class="hero-section">
        
        <div class="hero-content">
          <div class="game-logo">
            <h1 class="hero-title">PromptFighters</h1>
            <div class="logo-subtitle">{{ 'hero.subtitle' | translate }}</div>
          </div>
          
          <p class="hero-subtitle">{{ 'hero.tagline' | translate }}</p>
          <p class="hero-description">{{ 'hero.description' | translate }}</p>
          
          <div class="hero-stats">
            <div class="stat-item">
              <span class="stat-number">{{ totalPlayers }}+</span>
              <span class="stat-label">{{ 'stats.ai-nodes' | translate }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalBattles }}+</span>
              <span class="stat-label">{{ 'stats.battles-verified' | translate }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalHeroes }}+</span>
              <span class="stat-label">{{ 'stats.ai-fighters' | translate }}</span>
            </div>
          </div>
          
          <div class="hero-buttons">
            <button (click)="startAdventure()" class="btn-primary btn-glow">
              <span class="btn-icon">⚔️</span>
              <span class="btn-text">{{ 'button.start-battle' | translate }}</span>
            </button>
            <button (click)="scrollToNodes()" class="btn-secondary">
              <span class="btn-icon">🔗</span>
              <span class="btn-text">{{ 'button.join-node' | translate }}</span>
            </button>
          </div>
          
          <!-- 語言切換按鈕 -->
          <div class="language-switcher">
            <app-language-selector></app-language-selector>
          </div>
          
          <!-- 游戏导航区域 -->
          <div class="intro-navigation">
            <p class="nav-label">{{ 'navigation.menu' | translate }}</p>
            <div class="nav-links">
              <a (click)="goToIntroPage('heroes')" class="nav-link">
                <span class="link-icon">🎭</span>
                <span>{{ 'navigation.heroes' | translate }}</span>
              </a>
              <a (click)="goToIntroPage('battles')" class="nav-link">
                <span class="link-icon">⚔️</span>
                <span>{{ 'navigation.battles' | translate }}</span>
              </a>
              <a (click)="goToIntroPage('guide')" class="nav-link">
                <span class="link-icon">📖</span>
                <span>{{ 'navigation.guide' | translate }}</span>
              </a>
              <a (click)="goToIntroPage('about')" class="nav-link">
                <span class="link-icon">✨</span>
                <span>{{ 'navigation.about' | translate }}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Features Section with Interactive Cards -->
      <section id="features" class="section features-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">{{ 'about.title' | translate }}</h2>
            <p class="section-description">{{ 'about.description' | translate }}</p>
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
            <h2 class="section-title">{{ 'showcase.title' | translate }}</h2>
            <p class="section-description">{{ 'showcase.description' | translate }}</p>
          </div>
          
          <div class="showcase-grid">
            <div class="hero-card" *ngFor="let hero of sampleHeroes; let i = index">
              <div class="hero-card-inner">
                <div class="hero-avatar-wrapper">
                  <img [src]="hero.image" [alt]="hero.name" class="hero-avatar-img">
                  <div class="hero-level">{{ hero.level }}</div>
                </div>
                <h3 class="hero-name">{{ hero.name }}</h3>
                <p class="hero-desc">{{ hero.description }}</p>
                <div class="hero-stats-mini">
                  <span class="stat">{{ hero.stats.strength }}</span>
                  <span class="stat">{{ hero.stats.agility }}</span>
                  <span class="stat">{{ hero.stats.luck }}</span>
                </div>
                <div class="hero-rarity" [class]="hero.rarity">{{ hero.rarity }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 4. Mantle Integration Section -->
      <section class="section mantle-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">{{ 'mantle.title' | translate }}</h2>
            <p class="section-description">{{ 'mantle.description' | translate }}</p>
          </div>
          
          <div class="mantle-features">
            <div class="mantle-logo-section">
              <div class="mantle-logo">
                <img src="/assets/icons/mantle.jpg" alt="Mantle" class="logo-img">
                <div class="powered-by">{{ 'mantle.powered-by' | translate }}</div>
              </div>
            </div>
            
            <div class="mantle-benefits">
              <div class="benefit-card">
                <div class="benefit-icon">🏗️</div>
                <h3 class="benefit-title">{{ 'mantle.benefit1.title' | translate }}</h3>
                <p class="benefit-desc">{{ 'mantle.benefit1.desc' | translate }}</p>
              </div>
              <div class="benefit-card">
                <div class="benefit-icon">⚡</div>
                <h3 class="benefit-title">{{ 'mantle.benefit2.title' | translate }}</h3>
                <p class="benefit-desc">{{ 'mantle.benefit2.desc' | translate }}</p>
              </div>
              <div class="benefit-card">
                <div class="benefit-icon">🎮</div>
                <h3 class="benefit-title">{{ 'mantle.benefit3.title' | translate }}</h3>
                <p class="benefit-desc">{{ 'mantle.benefit3.desc' | translate }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 5. Battle Preview Section with Real-time Animation -->
      <section class="section battle-preview-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">{{ 'battle-preview.title' | translate }}</h2>
            <p class="section-description">{{ 'battle-preview.description' | translate }}</p>
          </div>
          
          <div class="battle-demo">
            <div class="battle-header">
              <div class="battle-title">{{ 'battle-demo.title' | translate }}</div>
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
            <h2 class="section-title">{{ 'economy.title' | translate }}</h2>
            <p class="section-description">{{ 'economy.description' | translate }}</p>
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

      <!-- 6. AI Node Network Section -->
      <section class="section node-network-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">{{ 'node.title' | translate }}</h2>
            <p class="section-description">{{ 'node.description' | translate }}</p>
            <div class="coming-soon-badge">{{ 'node.coming-soon' | translate }}</div>
          </div>
          
          <div class="node-features">
            <div class="node-info">
              <div class="node-benefits">
                <h3 class="benefits-title">{{ 'node.benefits.title' | translate }}</h3>
                <ul class="benefits-list">
                  <li class="benefit-item">
                    <span class="benefit-icon">💰</span>
                    <span>{{ 'node.benefit1' | translate }}</span>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🎯</span>
                    <span>{{ 'node.benefit2' | translate }}</span>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🔒</span>
                    <span>{{ 'node.benefit3' | translate }}</span>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🚀</span>
                    <span>{{ 'node.benefit4' | translate }}</span>
                  </li>
                </ul>
              </div>
              
              <div class="node-stats">
                <div class="stat-card">
                  <div class="stat-icon">🔗</div>
                  <div class="stat-value">--</div>
                  <div class="stat-label">{{ 'node.stats.active-nodes' | translate }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">⚡</div>
                  <div class="stat-value">--</div>
                  <div class="stat-label">{{ 'node.stats.consensus-rate' | translate }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">🏆</div>
                  <div class="stat-value">--</div>
                  <div class="stat-label">{{ 'node.stats.total-votes' | translate }}</div>
                </div>
              </div>
            </div>
            
            <div class="node-setup">
              <div class="setup-card">
                <h3 class="setup-title">{{ 'node.setup.title' | translate }}</h3>
                <p class="setup-subtitle">{{ 'node.setup.subtitle' | translate }}</p>
                <div class="setup-steps">
                  <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                      <div class="step-title">{{ 'node.setup.step1.title' | translate }}</div>
                      <code class="step-code">git clone https://github.com/your-repo/ai-node.git</code>
                    </div>
                  </div>
                  <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                      <div class="step-title">{{ 'node.setup.step2.title' | translate }}</div>
                      <code class="step-code">echo "GEMINI_API_KEY=your_key" > .env</code>
                    </div>
                  </div>
                  <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                      <div class="step-title">{{ 'node.setup.step3.title' | translate }}</div>
                      <code class="step-code">./start.sh</code>
                    </div>
                  </div>
                </div>
                
                <div class="node-preview-note">
                  <span class="note-icon">💡</span>
                  <p>{{ 'node.setup.note' | translate }}</p>
                </div>
                
                <div class="setup-actions">
                  <button class="btn-primary" disabled>
                    <span class="btn-icon">📖</span>
                    <span>{{ 'node.setup.deploy-docs' | translate }}</span>
                  </button>
                  <button class="btn-secondary" disabled>
                    <span class="btn-icon">🐙</span>
                    <span>{{ 'node.setup.github-repo' | translate }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 7. Hackathon Section -->
      <section class="section hackathon-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">{{ 'hackathon.title' | translate }}</h2>
            <p class="section-description">{{ 'hackathon.description' | translate }}</p>
          </div>
          
          <div class="hackathon-info">
            <div class="hackathon-card">
              <div class="hackathon-badge">
                <div class="badge-icon">🏆</div>
                <div class="badge-text">
                  <div class="badge-title">Mantle Global Hackathon</div>
                  <div class="badge-subtitle">2025</div>
                </div>
              </div>
              
              <div class="hackathon-details">
                <div class="detail-item">
                  <span class="detail-label">{{ 'hackathon.track.label' | translate }}:</span>
                  <span class="detail-value">{{ 'hackathon.track.value' | translate }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'hackathon.goal.label' | translate }}:</span>
                  <span class="detail-value">{{ 'hackathon.goal.value' | translate }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'hackathon.innovation.label' | translate }}:</span>
                  <span class="detail-value">{{ 'hackathon.innovation.value' | translate }}</span>
                </div>
              </div>
            </div>
            
            <div class="team-section">
              <h3 class="team-title">{{ 'hackathon.team.title' | translate }}</h3>
              <div class="team-grid">
                <div class="team-member">
                  <div class="member-avatar">👨‍💻</div>
                  <div class="member-info">
                    <div class="member-name">{{ 'hackathon.team.lead.name' | translate }}</div>
                    <div class="member-role">{{ 'hackathon.team.lead.role' | translate }}</div>
                  </div>
                </div>
                <div class="team-member">
                  <div class="member-avatar">🤖</div>
                  <div class="member-info">
                    <div class="member-name">{{ 'hackathon.team.ai.name' | translate }}</div>
                    <div class="member-role">{{ 'hackathon.team.ai.role' | translate }}</div>
                  </div>
                </div>
                <div class="team-member">
                  <div class="member-avatar">🎨</div>
                  <div class="member-info">
                    <div class="member-name">{{ 'hackathon.team.design.name' | translate }}</div>
                    <div class="member-role">{{ 'hackathon.team.design.role' | translate }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="hackathon-links">
            <button class="btn-primary">
              <span class="btn-icon">📖</span>
              <span>{{ 'hackathon.links.docs' | translate }}</span>
            </button>
            <button class="btn-secondary">
              <span class="btn-icon">💻</span>
              <span>{{ 'hackathon.links.github' | translate }}</span>
            </button>
            <button class="btn-secondary">
              <span class="btn-icon">🎥</span>
              <span>{{ 'hackathon.links.video' | translate }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 8. Final CTA Section with Parallax -->
      <section class="section cta-section">
        <div class="parallax-bg"></div>
        <div class="section-content">
          <h2 class="cta-title">{{ 'cta.title' | translate }}</h2>
          <p class="cta-subtitle">{{ 'cta.subtitle' | translate }}</p>
          
          <div class="cta-features">
            <div class="cta-feature">
              <span class="feature-icon">🎮</span>
              <span>{{ 'cta.feature1' | translate }}</span>
            </div>
            <div class="cta-feature">
              <span class="feature-icon">⚡</span>
              <span>{{ 'cta.feature2' | translate }}</span>
            </div>
            <div class="cta-feature">
              <span class="feature-icon">🏆</span>
              <span>{{ 'cta.feature3' | translate }}</span>
            </div>
          </div>
          
          <button (click)="startAdventure()" class="btn-primary btn-large btn-glow">
            <span class="btn-icon">🔥</span>
            <span class="btn-text">{{ 'cta.button' | translate }}</span>
          </button>
          
          <div class="social-proof">
            <p [innerHTML]="('social-proof' | translate: {count: totalPlayers})"></p>
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
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('battleLog') battleLog!: ElementRef;
  
  // 统计数据
  totalPlayers = 1250;
  totalBattles = 8500;
  totalHeroes = 3200;
  
  // 战斗演示状态
  isPlaying = false;
  private battleInterval: any;
  

  features: any[] = [];

  sampleHeroes: any[] = [];

  economyTokens: any[] = [];


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

  battlePreview: any[] = [];


  constructor(
    private router: Router,
    private meta: Meta,
    private title: Title,
    private languageService: LanguageService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.setupSEO();
    this.languageService.initializeLanguage();
    
    // 等待翻譯服務載入完成後再設置動態內容
    this.translate.onLangChange.subscribe(() => {
      this.setupDynamicContent();
    });
    
    // 監聽語言變化
    this.languageService.currentLanguage$.subscribe(() => {
      this.setupDynamicContent();
    });
    
    // 初始設置（延遲執行以確保翻譯文件已載入）
    setTimeout(() => {
      this.setupDynamicContent();
    }, 100);
  }
  
  ngOnDestroy() {
    if (this.battleInterval) {
      clearInterval(this.battleInterval);
    }
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
    const battleTextKeys = [
      'battle.texts.start',
      'battle.texts.fire-attack',
      'battle.texts.dodge',
      'battle.texts.ice-spell',
      'battle.texts.intense',
      'battle.texts.fire-slash',
      'battle.texts.blizzard',
      'battle.texts.balanced'
    ];

    const types = ['action', 'damage', 'defense', 'info'];
    const randomKey = battleTextKeys[Math.floor(Math.random() * battleTextKeys.length)];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const timestamp = new Date().toLocaleTimeString('zh-TW', { 
      minute: '2-digit', 
      second: '2-digit' 
    });

    // 使用 translate.get() 獲取隨機戰鬥文本
    this.translate.get(randomKey).subscribe(translatedText => {
      this.battlePreview.push({
        text: translatedText,
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
    });
  }

  startAdventure() {
    this.router.navigate(['/login']);
  }

  scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToNodes() {
    document.querySelector('.node-network-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  goToIntroPage(page: string) {
    this.router.navigate([`/intro/${page}`]);
  }

  private setupDynamicContent() {
    // 使用 translate.get() 確保翻譯完全載入
    this.translate.get([
      'features.ai-node.title',
      'features.ai-node.description', 
      'features.ai-node.highlight',
      'features.llm-consensus.title',
      'features.llm-consensus.description',
      'features.llm-consensus.highlight',
      'features.onchain.title',
      'features.onchain.description',
      'features.onchain.highlight'
    ]).subscribe(translations => {
      this.features = [
        {
          icon: '🔗',
          title: translations['features.ai-node.title'],
          description: translations['features.ai-node.description'],
          highlight: translations['features.ai-node.highlight']
        },
        {
          icon: '🤖',
          title: translations['features.llm-consensus.title'],
          description: translations['features.llm-consensus.description'],
          highlight: translations['features.llm-consensus.highlight']
        },
        {
          icon: '⛓️',
          title: translations['features.onchain.title'],
          description: translations['features.onchain.description'],
          highlight: translations['features.onchain.highlight']
        }
      ];
    });

    // 設置 sampleHeroes 數組
    this.translate.get([
      'heroes.hero1.name',
      'heroes.hero1.description',
      'heroes.hero2.name',
      'heroes.hero2.description',
      'heroes.hero3.name',
      'heroes.hero3.description'
    ]).subscribe(translations => {
      this.sampleHeroes = [
        {
          image: '/assets/game/landing/c_1.png',
          name: translations['heroes.hero1.name'],
          description: translations['heroes.hero1.description'],
          stats: { strength: 95, agility: 78, luck: 65 },
          rarity: 'legendary',
          level: 'Lv.50'
        },
        {
          image: '/assets/game/landing/c_2.png',
          name: translations['heroes.hero2.name'],
          description: translations['heroes.hero2.description'],
          stats: { strength: 72, agility: 88, luck: 82 },
          rarity: 'epic',
          level: 'Lv.45'
        },
        {
          image: '/assets/game/landing/c_3.png',
          name: translations['heroes.hero3.name'],
          description: translations['heroes.hero3.description'],
          stats: { strength: 85, agility: 92, luck: 75 },
          rarity: 'rare',
          level: 'Lv.42'
        }
      ];
    });

    // 設置 economyTokens 數組
    this.translate.get([
      'economy.tokens.prompt.description',
      'economy.tokens.prompt.use1',
      'economy.tokens.prompt.use2',
      'economy.tokens.prompt.use3',
      'economy.tokens.gold.description',
      'economy.tokens.gold.use1',
      'economy.tokens.gold.use2',
      'economy.tokens.gold.use3',
      'economy.tokens.power.description',
      'economy.tokens.power.use1',
      'economy.tokens.power.use2',
      'economy.tokens.power.use3'
    ]).subscribe(translations => {
      this.economyTokens = [
        {
          icon: '/assets/game/prompt.png',
          name: '$PROMPT',
          description: translations['economy.tokens.prompt.description'],
          uses: [
            translations['economy.tokens.prompt.use1'],
            translations['economy.tokens.prompt.use2'],
            translations['economy.tokens.prompt.use3']
          ]
        },
        {
          icon: '/assets/game/gold_coin.png',
          name: '$GOLD',
          description: translations['economy.tokens.gold.description'],
          uses: [
            translations['economy.tokens.gold.use1'],
            translations['economy.tokens.gold.use2'],
            translations['economy.tokens.gold.use3']
          ]
        },
        {
          icon: '/assets/game/prompt_power.png',
          name: 'Prompt Power',
          description: translations['economy.tokens.power.description'],
          uses: [
            translations['economy.tokens.power.use1'],
            translations['economy.tokens.power.use2'],
            translations['economy.tokens.power.use3']
          ]
        }
      ];
    });

    // 設置 battlePreview 數組
    this.translate.get([
      'battle.preview.entry1',
      'battle.preview.entry2',
      'battle.preview.entry3',
      'battle.preview.entry4'
    ]).subscribe(translations => {
      this.battlePreview = [
        { text: translations['battle.preview.entry1'], type: 'action', timestamp: '00:01' },
        { text: translations['battle.preview.entry2'], type: 'damage', timestamp: '00:02' },
        { text: translations['battle.preview.entry3'], type: 'defense', timestamp: '00:03' },
        { text: translations['battle.preview.entry4'], type: 'info', timestamp: '00:04' }
      ];
    });
  }
} 