# PromptFighters 多語系設定

## 🌍 支援語言
- **中文 (繁體)** - zh-Hant (預設)
- **English** - en

## 📁 檔案結構
```
frontend/
├── src/
│   ├── locale/
│   │   ├── messages.en.xlf      # 英文翻譯檔
│   │   └── messages.zh-Hant.xlf # 中文翻譯檔
│   ├── app/
│   │   └── services/
│   │       └── i18n.service.ts  # 多語系服務
│   └── main.ts                  # 已加入 @angular/localize/init
├── angular.json                 # i18n 配置
└── package.json                # 多語系建置腳本
```

## 🚀 使用方法

### 開發模式
```bash
# 預設中文版本
npm start

# 英文版本
npm run start:en

# 中文版本
npm run start:zh
```

### 建置
```bash
# 建置所有語言版本
npm run build:i18n

# 建置結果會在 dist/ 目錄下：
# dist/en/    - 英文版本
# dist/zh/    - 中文版本
```

### 提取翻譯訊息
```bash
npm run extract-i18n
```

## 🔧 技術實現

### 1. Angular.json 配置
- 設定了 `sourceLocale` 為 `zh-Hant`
- 配置了英文和中文的翻譯檔路徑
- 添加了多語系建置配置

### 2. 翻譯標記
在 HTML 模板中使用 `i18n` 屬性：
```html
<h1 i18n="@@hero.title">PromptFighters</h1>
<p i18n="@@hero.description">遊戲描述</p>
```

### 3. 動態內容
使用 I18nService 處理動態內容：
```typescript
get features() {
  if (this.i18n.isEnglish()) {
    return englishFeatures;
  } else {
    return chineseFeatures;
  }
}
```

### 4. 語言切換
頁面上的語言切換按鈕會重新導向到對應語言的 URL：
- `/en/` - 英文版本
- `/zh/` - 中文版本

## 📝 翻譯檔案格式
使用 XLIFF 1.2 格式：
```xml
<trans-unit id="hero.title" datatype="html">
  <source>原文</source>
  <target>翻譯</target>
</trans-unit>
```

## 🎯 已翻譯的區塊
- ✅ Hero 區塊 (標題、副標題、按鈕)
- ✅ About the Game 區塊
- ✅ Mantle 整合區塊
- ✅ AI Node Network 區塊  
- ✅ Hackathon 展示區塊
- ✅ 統計數據標籤
- ✅ 動態 Features 內容

## 🔄 語言切換流程
1. 用戶點擊語言按鈕
2. I18nService.switchLanguage() 被調用
3. 頁面重新導向到對應語言的 URL
4. Angular 根據 URL 載入對應的翻譯檔
5. 頁面以新語言重新渲染

## 🌟 特色功能
- **無縫切換**: 點擊即可切換語言
- **URL 路由**: 不同語言有不同的 URL 路徑
- **動態內容**: TypeScript 中的動態內容也支援多語系
- **視覺回饋**: 當前語言按鈕會高亮顯示
- **響應式**: 語言切換按鈕在各種螢幕尺寸下都能正常顯示

## 🚀 部署建議
建議使用以下結構部署：
```
website/
├── en/          # 英文版本
│   └── index.html
├── zh/          # 中文版本  
│   └── index.html
└── index.html   # 重新導向到預設語言
```

這樣可以支援 SEO 友善的多語系 URL 結構。
