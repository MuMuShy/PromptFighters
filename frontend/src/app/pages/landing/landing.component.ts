import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { I18nService } from '../../services/i18n.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing-container">
      <!-- 1. Hero Section with Animated Background -->
      <section class="hero-section">
        
        <div class="hero-content">
          <div class="game-logo">
            <h1 class="hero-title">PromptFighters</h1>
            <div class="logo-subtitle">{{ getHeroSubtitle() }}</div>
          </div>
          
          <p class="hero-subtitle">{{ getHeroTagline() }}</p>
          <p class="hero-description">{{ getHeroDescription() }}</p>
          
          <div class="hero-stats">
            <div class="stat-item">
              <span class="stat-number">{{ totalPlayers }}+</span>
              <span class="stat-label">{{ getStatLabel('nodes') }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalBattles }}+</span>
              <span class="stat-label">{{ getStatLabel('battles') }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalHeroes }}+</span>
              <span class="stat-label">{{ getStatLabel('fighters') }}</span>
            </div>
          </div>
          
          <div class="hero-buttons">
            <button (click)="startAdventure()" class="btn-primary btn-glow">
              <span class="btn-icon">⚔️</span>
              <span class="btn-text">{{ getButtonText('start-battle') }}</span>
            </button>
            <button (click)="scrollToNodes()" class="btn-secondary">
              <span class="btn-icon">🔗</span>
              <span class="btn-text">{{ getButtonText('join-node') }}</span>
            </button>
          </div>
          
          <!-- 語言切換按鈕 -->
          <div class="language-switcher">
            <button 
              (click)="switchLanguage('zh-Hant')" 
              class="lang-btn"
              [class.active]="i18n.isChinese()">
              中文
            </button>
            <button 
              (click)="switchLanguage('en')" 
              class="lang-btn"
              [class.active]="i18n.isEnglish()">
              English
            </button>
          </div>
          
          <!-- 游戏导航区域 -->
          <div class="intro-navigation">
            <p class="nav-label">Game Menu</p>
            <div class="nav-links">
              <a (click)="goToIntroPage('heroes')" class="nav-link">
                <span class="link-icon">🎭</span>
                <span>英雄圖鑑</span>
              </a>
              <a (click)="goToIntroPage('battles')" class="nav-link">
                <span class="link-icon">⚔️</span>
                <span>戰鬥系統</span>
              </a>
              <a (click)="goToIntroPage('guide')" class="nav-link">
                <span class="link-icon">📖</span>
                <span>新手指南</span>
              </a>
              <a (click)="goToIntroPage('about')" class="nav-link">
                <span class="link-icon">✨</span>
                <span>關於遊戲</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Features Section with Interactive Cards -->
      <section id="features" class="section features-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title" i18n="@@about.title">About the Game</h2>
            <p class="section-description" i18n="@@about.description">每個角色都是由 AI 生成的獨特存在。戰鬥過程由 AI 決策，不可預測但可驗證。玩家可以參與生成、對戰或運行 AI Node 參與共識。</p>
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
            <h2 class="section-title" i18n="@@mantle.title">Built on Mantle</h2>
            <p class="section-description" i18n="@@mantle.description">Powered by Mantle Layer 2 - 為 AI & GameFi 而生的區塊鏈</p>
          </div>
          
          <div class="mantle-features">
            <div class="mantle-logo-section">
              <div class="mantle-logo">
                <img src="/assets/icons/mantle.jpg" alt="Mantle" class="logo-img">
                <div class="powered-by" i18n="@@mantle.powered-by">Powered by Mantle</div>
              </div>
            </div>
            
            <div class="mantle-benefits">
              <div class="benefit-card">
                <div class="benefit-icon">🏗️</div>
                <h3 class="benefit-title" i18n="@@mantle.benefit1.title">模組化架構</h3>
                <p class="benefit-desc" i18n="@@mantle.benefit1.desc">靈活的模組化設計，完美適配 AI 節點網絡</p>
              </div>
              <div class="benefit-card">
                <div class="benefit-icon">⚡</div>
                <h3 class="benefit-title" i18n="@@mantle.benefit2.title">高效能低費用</h3>
                <p class="benefit-desc" i18n="@@mantle.benefit2.desc">快速確認，低 Gas 費，適合高頻戰鬥遊戲</p>
              </div>
              <div class="benefit-card">
                <div class="benefit-icon">🎮</div>
                <h3 class="benefit-title" i18n="@@mantle.benefit3.title">GameFi 友善</h3>
                <p class="benefit-desc" i18n="@@mantle.benefit3.desc">專為 AI & GameFi 結合場景優化的 Layer 2</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 5. Battle Preview Section with Real-time Animation -->
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

      <!-- 6. AI Node Network Section -->
      <section class="section node-network-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title" i18n="@@node.title">Run Your AI Node</h2>
            <p class="section-description" i18n="@@node.description">人人都能成為 AI 節點 - 簡單三步驟，加入去中心化 AI 網絡</p>
            <div class="coming-soon-badge">🚀 即將開放</div>
          </div>
          
          <div class="node-features">
            <div class="node-info">
              <div class="node-benefits">
                <h3 class="benefits-title">為什麼運行節點？</h3>
                <ul class="benefits-list">
                  <li class="benefit-item">
                    <span class="benefit-icon">💰</span>
                    <span>參與共識獲得代幣獎勵</span>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🎯</span>
                    <span>影響遊戲生態發展方向</span>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🔒</span>
                    <span>增強網絡去中心化與安全性</span>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🚀</span>
                    <span>搶先體驗新功能與特權</span>
                  </li>
                </ul>
              </div>
              
              <div class="node-stats">
                <div class="stat-card">
                  <div class="stat-icon">🔗</div>
                  <div class="stat-value">--</div>
                  <div class="stat-label">Active Nodes</div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">⚡</div>
                  <div class="stat-value">--</div>
                  <div class="stat-label">Consensus Rate</div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">🏆</div>
                  <div class="stat-value">--</div>
                  <div class="stat-label">Total Votes</div>
                </div>
              </div>
            </div>
            
            <div class="node-setup">
              <div class="setup-card">
                <h3 class="setup-title">未來部署流程預覽</h3>
                <p class="setup-subtitle">三步驟即可加入 AI 節點網絡</p>
                <div class="setup-steps">
                  <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                      <div class="step-title">Clone 專案</div>
                      <code class="step-code">git clone https://github.com/your-repo/ai-node.git</code>
                    </div>
                  </div>
                  <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                      <div class="step-title">配置 API Key</div>
                      <code class="step-code">echo "GEMINI_API_KEY=your_key" > .env</code>
                    </div>
                  </div>
                  <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                      <div class="step-title">啟動節點服務</div>
                      <code class="step-code">./start.sh</code>
                    </div>
                  </div>
                </div>
                
                <div class="node-preview-note">
                  <span class="note-icon">💡</span>
                  <p>節點啟動後會自動連接到 Mantle 主網，並開始參與戰鬥結果的 AI 共識投票。完全去中心化，任何人都可以運行！</p>
                </div>
                
                <div class="setup-actions">
                  <button class="btn-primary" disabled>
                    <span class="btn-icon">📖</span>
                    <span>部署文檔（即將推出）</span>
                  </button>
                  <button class="btn-secondary" disabled>
                    <span class="btn-icon">🐙</span>
                    <span>GitHub Repo（準備中）</span>
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
            <h2 class="section-title" i18n="@@hackathon.title">Built for Mantle Global Hackathon 2025</h2>
            <p class="section-description" i18n="@@hackathon.description">Track: GameFi & Social + AI & Oracles - Building the first decentralized AI battle protocol</p>
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
                  <span class="detail-label">Track:</span>
                  <span class="detail-value">GameFi & Social + AI & Oracles</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Goal:</span>
                  <span class="detail-value">Build the first decentralized AI battle protocol</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Innovation:</span>
                  <span class="detail-value">Multi-AI consensus + On-chain verification</span>
                </div>
              </div>
            </div>
            
            <div class="team-section">
              <h3 class="team-title">Meet the Team</h3>
              <div class="team-grid">
                <div class="team-member">
                  <div class="member-avatar">👨‍💻</div>
                  <div class="member-info">
                    <div class="member-name">Lead Developer</div>
                    <div class="member-role">Full-Stack & Blockchain</div>
                  </div>
                </div>
                <div class="team-member">
                  <div class="member-avatar">🤖</div>
                  <div class="member-info">
                    <div class="member-name">AI Engineer</div>
                    <div class="member-role">LLM & Node Architecture</div>
                  </div>
                </div>
                <div class="team-member">
                  <div class="member-avatar">🎨</div>
                  <div class="member-info">
                    <div class="member-name">Game Designer</div>
                    <div class="member-role">UX & Game Mechanics</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="hackathon-links">
            <button class="btn-primary">
              <span class="btn-icon">📖</span>
              <span>View Documentation</span>
            </button>
            <button class="btn-secondary">
              <span class="btn-icon">💻</span>
              <span>GitHub Repository</span>
            </button>
            <button class="btn-secondary">
              <span class="btn-icon">🎥</span>
              <span>Demo Video</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 8. Final CTA Section with Parallax -->
      <section class="section cta-section">
        <div class="parallax-bg"></div>
        <div class="section-content">
          <h2 class="cta-title">準備好加入去中心化 AI 戰場了嗎？</h2>
          <p class="cta-subtitle">你的 AI 英雄傳奇，現在開始。</p>
          
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
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('battleLog') battleLog!: ElementRef;
  
  // 统计数据
  totalPlayers = 1250;
  totalBattles = 8500;
  totalHeroes = 3200;
  
  // 战斗演示状态
  isPlaying = false;
  private battleInterval: any;
  private localeSubscription?: Subscription;
  

  get features() {
    if (this.i18n.isEnglish()) {
      return [
        {
          icon: '🔗',
          title: 'AI Node Network',
          description: 'Players can run Docker nodes to participate in battle consensus, becoming part of the decentralized network.',
          highlight: 'Decentralized'
        },
        {
          icon: '🤖',
          title: 'LLM Consensus',
          description: 'Multiple AI models vote to generate results, ensuring fairness and diversity while eliminating single points of failure.',
          highlight: 'Multi-AI'
        },
        {
          icon: '⛓️',
          title: 'On-Chain Verification',
          description: 'Battle result hashes are stored on Mantle blockchain, publicly verifiable, immutable, and transparent.',
          highlight: 'Zero Trust'
        }
      ];
    } else {
      return [
        {
          icon: '🔗',
          title: 'AI Node Network',
          description: '玩家可運行 Docker 節點參與戰鬥共識，成為去中心化網絡的一部分。',
          highlight: 'Decentralized'
        },
        {
          icon: '🤖',
          title: 'LLM Consensus',
          description: '多 AI 模型投票產生結果，確保公平與多樣性，消除單點故障。',
          highlight: 'Multi-AI'
        },
        {
          icon: '⛓️',
          title: 'On-Chain Verification',
          description: '戰鬥結果的 Hash 上鏈 Mantle，公開可查，結果不可篡改、可驗證、透明。',
          highlight: 'Zero Trust'
        }
      ];
    }
  }

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
    private title: Title,
    public i18n: I18nService
  ) {}

  ngOnInit() {
    this.setupSEO();
    
    // 監聽語言變化
    this.localeSubscription = this.i18n.locale$.subscribe(() => {
      // 語言變化時重新觸發變更檢測
      // Angular 會自動重新評估 getter
    });
  }
  
  ngOnDestroy() {
    if (this.localeSubscription) {
      this.localeSubscription.unsubscribe();
    }
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

  scrollToNodes() {
    document.querySelector('.node-network-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  switchLanguage(locale: string) {
    this.i18n.switchLanguage(locale);
  }

  // 翻譯方法
  getHeroSubtitle(): string {
    return this.i18n.isEnglish() 
      ? 'Decentralized AI Battle Arena'
      : '去中心化 AI 戰鬥競技場';
  }

  getHeroTagline(): string {
    return this.i18n.isEnglish()
      ? 'Where AI Fights, and Players Run the Nodes'
      : 'AI 戰鬥，玩家運行節點';
  }

  getHeroDescription(): string {
    return this.i18n.isEnglish()
      ? "The world's first decentralized AI battle game powered by Mantle Layer 2"
      : '全球首款由 Mantle Layer 2 驅動的去中心化 AI 戰鬥遊戲';
  }

  getStatLabel(type: string): string {
    const labels = {
      'nodes': this.i18n.isEnglish() ? 'AI Nodes' : 'AI 節點',
      'battles': this.i18n.isEnglish() ? 'Battles Verified' : '已驗證戰鬥',
      'fighters': this.i18n.isEnglish() ? 'AI Fighters' : 'AI 戰士'
    };
    return labels[type as keyof typeof labels] || '';
  }

  getButtonText(type: string): string {
    const buttons = {
      'start-battle': this.i18n.isEnglish() ? 'Start Battle' : '開始對戰',
      'join-node': this.i18n.isEnglish() ? 'Join Node' : '加入節點'
    };
    return buttons[type as keyof typeof buttons] || '';
  }

  goToIntroPage(page: string) {
    this.router.navigate([`/intro/${page}`]);
  }
} 