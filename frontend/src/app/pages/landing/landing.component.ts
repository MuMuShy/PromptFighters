import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing-container">
      <!-- 1. Hero Section -->
      <section class="hero-section">
        <div class="hero-content">
          <p class="hero-subtitle">一個指令，創造你的專屬英雄。一場戰鬥，見證 AI 的無限可能。</p>
          <div class="hero-buttons">
            <button (click)="startAdventure()" class="btn-primary">🚀 立刻開始冒險</button>
            <button (click)="scrollToFeatures()" class="btn-secondary">了解遊戲特色</button>
          </div>
        </div>
      </section>

      <!-- 2. Features / How It Works Section -->
      <section id="features" class="section features-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">這不僅是遊戲，更是你的創意戰場</h2>
            <p class="section-description">我們將複雜的 AI 技術，轉化為你手中最强大的創作工具。</p>
          </div>
          <div class="features-grid">
            <div class="feature-card" *ngFor="let feature of features">
              <div class="feature-icon">{{ feature.icon }}</div>
              <h3 class="feature-title">{{ feature.title }}</h3>
              <p class="feature-description">{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. AI Character Showcase -->
      <section class="section showcase-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">遇見 AI 為你創造的英雄</h2>
            <p class="section-description">從威嚴的騎士到神秘的法師，每個英雄都擁有由 AI 生成的獨特靈魂。</p>
          </div>
          <div class="showcase-grid">
            <div class="hero-card" *ngFor="let hero of sampleHeroes">
              <div class="hero-avatar">{{ hero.emoji }}</div>
              <h3 class="hero-name">{{ hero.name }}</h3>
              <p class="hero-desc">{{ hero.description }}</p>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 4. Battle Preview Section -->
      <section class="section battle-preview-section">
        <div class="section-content">
          <div class="section-header">
            <h2 class="section-title">每一場戰鬥，都是一齣精彩好戲</h2>
            <p class="section-description">AI 導演將根據角色性格與戰況，即時生成充滿戲劇性的戰鬥描述。</p>
          </div>
          <div class="battle-demo">
            <div class="battle-log">
              <div class="battle-entry" *ngFor="let entry of battlePreview" [ngClass]="entry.type">
                <span class="battle-text">{{ entry.text }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. Final CTA Section -->
      <section class="section cta-section">
        <div class="section-content">
          <h2 class="cta-title">準備好指揮你的 AI 英雄了嗎？</h2>
          <p class="cta-subtitle">你的傳奇故事，現在開始。</p>
          <button (click)="startAdventure()" class="btn-primary btn-large">🔥 免費加入戰鬥</button>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  constructor(private router: Router) {}

  features = [
    {
      icon: '✨',
      title: '無限創造',
      description: '只需一個名字，AI 就能為你生成獨特的背景故事、性格和技能，讓每個英雄都獨一無二。'
    },
    {
      icon: '⚔️',
      title: '動態戰鬥',
      description: '告別固定腳本。AI 將根據戰況即時生成戰鬥過程，每一次對決都充滿未知與驚喜。'
    },
    {
      icon: '📊',
      title: '見證成長',
      description: '追蹤英雄的戰鬥歷史與數據，分析戰術，調整策略，見證他們從新手到傳奇的蛻變。'
    }
  ];

  sampleHeroes = [
    { emoji: '🔥', name: '燼龍騎士 奧古斯特', description: '被龍血詛咒的騎士，揮舞著能燃燒一切的巨劍。' },
    { emoji: '❄️', name: '冰霜女巫 莉安德拉', description: '來自北境的神秘女巫，能將敵人的靈魂凍結。' },
    { emoji: '🌳', name: '森之守護者 芬恩', description: '與古老森林共生的德魯伊，能召喚自然之力作戰。' }
  ];

  battlePreview = [
    { text: '燼龍騎士 奧古斯特 咆哮著，劍上的火焰化為一條巨龍撲向敵人！', type: 'action' },
    { text: '敵人被火焰吞噬，受到 210 點重創！', type: 'damage' },
    { text: '冰霜女巫 莉安德拉 輕聲吟唱，一道冰牆拔地而起，擋下了致命的反擊。', type: 'defense' },
    { text: '戰鬥的節奏因這次完美的防禦而徹底改變。', type: 'info' }
  ];

  startAdventure() {
    this.router.navigate(['/login']);
  }

  scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
} 