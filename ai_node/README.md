# AI Node 部署指南

## 🚀 快速開始

### 1. 配置環境變數

```bash
# 複製環境變數範例
cp .env.example .env

# 編輯配置文件，填入您的 Gemini API 密鑰
nano .env
```

### 2. 啟動節點

```bash
# 啟動 3 個 AI 節點
docker-compose up -d

# 查看運行狀態
docker-compose ps
```

## 📝 配置說明

### .env 文件
```bash
# 必填：您的 Gemini API 密鑰
GEMINI_API_KEY=your_gemini_api_key_here

# 可選：節點 API 密鑰（用於安全）
NODE_API_KEY=

# 主服務器地址
AGGREGATOR_URL=http://localhost:8000

# 節點性能配置
NODE_WEIGHT=1
MAX_CONCURRENT_REQUESTS=5
HEARTBEAT_INTERVAL=60
```

### 生產環境部署
修改 `.env` 中的 `AGGREGATOR_URL` 為您的生產域名：
```bash
AGGREGATOR_URL=https://your-production-domain.com
```

## 🔧 常用命令

```bash
# 啟動節點
docker-compose up -d

# 停止節點
docker-compose down

# 查看日誌
docker-compose logs -f

# 重啟節點
docker-compose restart

# 檢查節點健康狀態
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
```

## 📊 監控

```bash
# 查看主服務器中的節點狀態
curl http://localhost:8000/api/nodes/

# 檢查節點統計
curl http://localhost:8001/stats
```

## 🔍 故障排除

### 常見問題

1. **節點無法連接主服務器**
   - 確保主服務器運行：`curl http://localhost:8000/api/health/`
   - 檢查 `.env` 中的 `AGGREGATOR_URL` 是否正確

2. **節點註冊失敗**
   - 確保主服務器已執行數據庫遷移
   - 檢查主服務器日誌

3. **Gemini API 錯誤**
   - 確認 `GEMINI_API_KEY` 正確
   - 檢查 API 配額是否充足