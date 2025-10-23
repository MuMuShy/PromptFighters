# AI Node 部署指南

## 🏠 本地開發

```bash
# 使用預設配置（自動檢測 host.docker.internal）
docker-compose up -d
```

## 🌍 生產環境部署

### 方法 1：自動 IP 檢測（推薦）

```bash
# 1. 複製生產配置
cp docker-compose.prod.yml docker-compose.yml

# 2. 編輯配置文件
nano docker-compose.yml
# 修改 AGGREGATOR_URL 為你的 GCP 服務器地址
# 例如：AGGREGATOR_URL=https://your-server.com

# 3. 啟動節點
docker-compose up -d
```

### 方法 2：手動指定 IP

```bash
# 如果自動檢測不準確，可以手動指定
docker-compose up -d \
  -e DEPLOYMENT_MODE=production \
  -e AGGREGATOR_URL=https://your-server.com \
  -e NODE_EXTERNAL_HOST=203.0.113.1
```

### 方法 3：使用環境變量文件

```bash
# 創建 .env 文件
cat > .env << EOF
DEPLOYMENT_MODE=production
AGGREGATOR_URL=https://your-gcp-server.com
NODE_EXTERNAL_HOST=your-public-ip-or-domain
GEMINI_API_KEY=your-gemini-api-key
EOF

# 啟動
docker-compose up -d
```

## 🔧 配置選項

### DEPLOYMENT_MODE
- `local`: 本地開發（使用 host.docker.internal）
- `production`: 生產環境（自動檢測公網 IP）
- `auto`: 自動檢測模式（預設）

### NODE_EXTERNAL_HOST（可選）
- 手動指定節點的外部地址
- 可以是 IP 地址或域名
- 如果不設置，系統會自動檢測

### AGGREGATOR_URL
- 後端服務器的地址
- 本地：`http://host.docker.internal:8000`
- 生產：`https://your-gcp-server.com`

## 🚀 快速部署腳本

```bash
#!/bin/bash
# quick-deploy.sh

# 設置你的服務器地址
BACKEND_URL="https://your-gcp-server.com"

# 下載並啟動 AI 節點
git clone https://github.com/your-repo/AiHeroBattle.git
cd AiHeroBattle/ai_node

# 創建配置
cat > .env << EOF
DEPLOYMENT_MODE=production
AGGREGATOR_URL=$BACKEND_URL
GEMINI_API_KEY=your-api-key-here
EOF

# 構建並啟動
docker-compose -f docker-compose.prod.yml up -d --build

echo "AI 節點已啟動！"
echo "檢查狀態：docker logs ai-node-prod-1"
```

## 📊 檢查節點狀態

```bash
# 查看日誌
docker logs ai-node-prod-1

# 檢查註冊狀態
curl http://localhost:8001/health

# 查看節點統計
curl http://localhost:8001/stats
```

## 🔍 故障排除

### 1. 無法連接到後端
- 檢查 `AGGREGATOR_URL` 是否正確
- 確認後端服務器可以訪問
- 檢查防火牆設置

### 2. IP 檢測不正確
- 手動設置 `NODE_EXTERNAL_HOST`
- 檢查網絡配置
- 確認端口 8001/8002 已開放

### 3. 註冊失敗
- 檢查 API 密鑰（如果需要）
- 確認後端 API 正常運行
- 查看詳細錯誤日誌

## 🌐 分散式部署

每個人都可以運行自己的節點：

```bash
# 任何人都可以這樣部署
docker run -d \
  -p 8001:8001 \
  -e DEPLOYMENT_MODE=production \
  -e AGGREGATOR_URL=https://your-game-server.com \
  -e GEMINI_API_KEY=their-own-key \
  your-dockerhub/ai-node:latest
```

這樣就實現了真正的去中心化 AI 節點網絡！
