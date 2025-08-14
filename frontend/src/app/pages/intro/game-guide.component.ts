import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-game-guide',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="game-guide-container">
      <!-- 页面头部 -->
      <header class="intro-header">
        <div class="header-content">
          <h1 class="page-title">遊戲指南</h1>
          <p class="page-subtitle">新手教學與遊戲攻略，幫助你快速上手 Prompt Fighters</p>
          <div class="header-actions">
            <button (click)="goToLogin()" class="btn-primary">立即登入開始遊戲</button>
            <button (click)="goBack()" class="btn-secondary">返回首頁</button>
          </div>
        </div>
      </header>

      <!-- 快速开始指南 -->
      <section class="quick-start">
        <div class="section-content">
          <h2 class="section-title">快速開始指南</h2>
          <div class="guide-steps">
            <div class="step-card">
              <div class="step-number">1</div>
              <div class="step-content">
                <h3>登入遊戲</h3>
                <p>使用你的 Google 帳號快速登入，無需額外註冊步驟</p>
                <div class="step-tip">
                  <span class="tip-icon">💡</span>
                  <span>首次登入會自動創建你的遊戲帳號</span>
                </div>
              </div>
            </div>
            
            <div class="step-card">
              <div class="step-number">2</div>
              <div class="step-content">
                <h3>創建英雄</h3>
                <p>為你的英雄取一個名字，AI 會自動生成獨特的背景故事和初始能力</p>
                <div class="step-tip">
                  <span class="tip-icon">💡</span>
                  <span>名字越有特色，AI 生成的背景故事越精彩</span>
                </div>
              </div>
            </div>
            
            <div class="step-card">
              <div class="step-number">3</div>
              <div class="step-content">
                <h3>開始戰鬥</h3>
                <p>選擇你的英雄參與戰鬥，觀看 AI 導演的精彩對戰</p>
                <div class="step-tip">
                  <span class="tip-icon">💡</span>
                  <span>每場戰鬥都是獨一無二的體驗</span>
                </div>
              </div>
            </div>
            
            <div class="step-card">
              <div class="step-number">4</div>
              <div class="step-content">
                <h3>升級成長</h3>
                <p>通過戰鬥獲得經驗值，提升英雄能力，解鎖新的技能</p>
                <div class="step-tip">
                  <span class="tip-icon">💡</span>
                  <span>定期升級你的英雄，提升戰鬥力</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 游戏系统详解 -->
      <section class="game-systems">
        <div class="section-content">
          <h2 class="section-title">遊戲系統詳解</h2>
          
          <div class="system-tabs">
            <div class="tab-content">
              <div class="system-section">
                <h3>🎭 英雄系統</h3>
                <div class="system-details">
                  <div class="detail-item">
                    <h4>AI 生成背景</h4>
                    <p>每個英雄都由 AI 根據名字自動生成獨特的故事背景、性格特徵和初始能力值。這確保了每個英雄都是獨一無二的。</p>
                  </div>
                  <div class="detail-item">
                    <h4>屬性系統</h4>
                    <p>英雄擁有力量、敏捷、幸運等基礎屬性，這些屬性會影響戰鬥表現和成長方向。</p>
                  </div>
                  <div class="detail-item">
                    <h4>等級成長</h4>
                    <p>通過戰鬥獲得經驗值，英雄等級提升後可以獲得屬性點數，用於強化特定能力。</p>
                  </div>
                </div>
              </div>

              <div class="system-section">
                <h3>⚔️ 戰鬥系統</h3>
                <div class="system-details">
                  <div class="detail-item">
                    <h4>AI 導演</h4>
                    <p>戰鬥過程由大型語言模型即時生成，根據角色屬性、背景故事和戰鬥場景創造獨特的戰鬥劇情。</p>
                  </div>
                  <div class="detail-item">
                    <h4>回合制戰鬥</h4>
                    <p>採用回合制戰鬥模式，每個回合 AI 會根據角色特徵做出合理的行動選擇。</p>
                  </div>
                  <div class="detail-item">
                    <h4>戰鬥結果</h4>
                    <p>戰鬥結束後會顯示詳細的戰鬥摘要、勝負結果和獎勵內容。</p>
                  </div>
                </div>
              </div>

              <div class="system-section">
                <h3>🏆 獎勵系統</h3>
                <div class="system-details">
                  <div class="detail-item">
                    <h4>經驗值</h4>
                    <p>參與戰鬥可以獲得經驗值，用於提升英雄等級和屬性。</p>
                  </div>
                  <div class="detail-item">
                    <h4>戰鬥記錄</h4>
                    <p>每場戰鬥都會被記錄下來，你可以隨時查看戰鬥歷史和統計數據。</p>
                  </div>
                  <div class="detail-item">
                    <h4>排行榜</h4>
                    <p>根據戰鬥表現和英雄等級，參與全服排行榜競爭。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 进阶技巧 -->
      <section class="advanced-tips">
        <div class="section-content">
          <h2 class="section-title">進階技巧</h2>
          <div class="tips-grid">
            <div class="tip-card">
              <div class="tip-icon">🎯</div>
              <h3>英雄命名技巧</h3>
              <p>選擇有特色的名字，如神話人物、歷史英雄或獨特的稱號，這樣 AI 能生成更豐富的背景故事。</p>
            </div>
            
            <div class="tip-card">
              <div class="tip-icon">⚔️</div>
              <h3>戰鬥策略</h3>
              <p>了解不同屬性英雄的優劣勢，在戰鬥中發揮各自特長。力量型英雄適合正面對抗，敏捷型英雄善於閃避和突襲。</p>
            </div>
            
            <div class="tip-card">
              <div class="tip-icon">📈</div>
              <h3>成長規劃</h3>
              <p>根據英雄的初始屬性和戰鬥風格，合理分配升級點數，打造專精型或全能型英雄。</p>
            </div>
            
            <div class="tip-card">
              <div class="tip-icon">🔄</div>
              <h3>多英雄策略</h3>
              <p>創建多個不同類型的英雄，在各種戰鬥場景中都能有合適的選擇。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 常见问题 -->
      <section class="faq-section">
        <div class="section-content">
          <h2 class="section-title">常見問題</h2>
          <div class="faq-list">
            <div class="faq-item">
              <h3>Q: 如何提升英雄的戰鬥力？</h3>
              <p>A: 通過參與戰鬥獲得經驗值，提升等級後可以獲得屬性點數。合理分配這些點數來強化英雄的優勢屬性。</p>
            </div>
            
            <div class="faq-item">
              <h3>Q: 戰鬥結果是隨機的嗎？</h3>
              <p>A: 不是完全隨機的。AI 會根據雙方的屬性、背景故事和戰鬥場景來生成合理的戰鬥過程和結果。</p>
            </div>
            
            <div class="faq-item">
              <h3>Q: 可以刪除或重新創建英雄嗎？</h3>
              <p>A: 目前不支持刪除英雄，但你可以創建多個英雄角色。每個英雄都是獨一無二的，建議珍惜每一個。</p>
            </div>
            
            <div class="faq-item">
              <h3>Q: 遊戲需要付費嗎？</h3>
              <p>A: Prompt Fighters 完全免費遊玩，所有核心功能都不需要付費。我們致力於為玩家提供最好的遊戲體驗。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 召唤行动 -->
      <section class="cta-section">
        <div class="section-content">
          <h2>準備好開始你的冒險了嗎？</h2>
          <p>現在就登入遊戲，創建你的第一個英雄，體驗 AI 技術帶來的無限可能</p>
          <div class="cta-buttons">
            <button (click)="goToLogin()" class="btn-primary btn-large">立即開始遊戲</button>
            <button (click)="goToHeroes()" class="btn-secondary">查看英雄展示</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./game-guide.component.scss']
})
export class GameGuideComponent implements OnInit {
  constructor(
    private router: Router,
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit() {
    this.setupSEO();
  }

  private setupSEO() {
    this.title.setTitle('遊戲指南 - Prompt Fighters | 新手教學與遊戲攻略');
    this.meta.updateTag({ name: 'description', content: 'Prompt Fighters 完整遊戲指南，包含新手教學、戰鬥系統說明、英雄升級攻略等詳細內容。' });
    this.meta.updateTag({ name: 'keywords', content: '遊戲指南,新手教學,Prompt Fighters,遊戲攻略,AI遊戲' });
    
    // Open Graph 标签
    this.meta.updateTag({ property: 'og:title', content: '遊戲指南 - Prompt Fighters' });
    this.meta.updateTag({ property: 'og:description', content: '新手教學與遊戲攻略' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: 'https://promptfighters.app/intro/guide' });
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
