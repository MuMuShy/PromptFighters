# 🚀 AI Node Production 部署完整指南

## 📋 目錄
1. [準備工作](#準備工作)
2. [GCP 服務器配置](#gcp-服務器配置)
3. [AI 節點部署](#ai-節點部署)
4. [網絡配置](#網絡配置)
5. [監控與維護](#監控與維護)
6. [故障排除](#故障排除)

---

## 🛠️ 準備工作

### 1. 後端服務器（GCP）

#### 必要條件：
- ✅ 後端已部署到 GCP（Django + Celery + Redis）
- ✅ 後端 API 可公開訪問（例如：`https://api.promptfighters.com`）
- ✅ 防火牆已開放必要端口

#### 需要開放的端口：
```bash
# 後端 API
8000/tcp   # Django API

# 節點註冊端點
POST /api/nodes/register/
POST /api/nodes/heartbeat/
```

#### 檢查後端健康狀態：
```bash
# 測試後端 API 是否可訪問
curl https://your-gcp-server.com/api/health/

# 測試節點註冊端點
curl -X POST https://your-gcp-server.com/api/nodes/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://test.com:8001",
    "name": "test-node"
  }'
```

---

### 2. 獲取 Gemini API Key

```bash
# 前往 Google AI Studio
https://aistudio.google.com/app/apikey

# 創建新的 API Key
# 複製保存，待會部署時需要
```

---

### 3. 準備部署機器

#### 選項 A：使用 GCP VM（推薦給貢獻者）
```bash
# 創建一個輕量級 VM
# - 機器類型：e2-micro 或 e2-small
# - 鏡像：Ubuntu 22.04 LTS
# - 磁盤：10GB 足夠

# 開放端口
8001/tcp   # AI Node 1
8002/tcp   # AI Node 2（如果運行多個）
```

#### 選項 B：任何有 Docker 的機器
- 本地電腦（需要固定 IP 或 DDNS）
- 雲服務器（AWS、Azure、Digital Ocean 等）
- 樹莓派（適合輕量節點）

---

## 🌐 GCP 服務器配置

### 1. 更新後端網絡配置

確保你的後端 `docker-compose.yml` 使用了自定義網絡：

```yaml
# backend/docker-compose.yml
version: '3.8'

services:
  web:
    # ... 其他配置
    networks:
      - aiherobattle-network
    ports:
      - "8000:8000"

  celery:
    # ... 其他配置
    networks:
      - aiherobattle-network

networks:
  aiherobattle-network:
    driver: bridge
    name: aiherobattle-network
```

### 2. 配置防火牆

```bash
# GCP Firewall Rules
gcloud compute firewall-rules create allow-api \
    --allow tcp:8000 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow API access"

# 如果 AI 節點也在 GCP 上
gcloud compute firewall-rules create allow-ai-nodes \
    --allow tcp:8001-8010 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow AI node communication"
```

### 3. 設置 HTTPS（推薦）

```bash
# 使用 Nginx + Let's Encrypt
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# 配置 Nginx 反向代理
sudo nano /etc/nginx/sites-available/promptfighters

# 添加配置
server {
    listen 80;
    server_name api.promptfighters.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 啟用站點
sudo ln -s /etc/nginx/sites-available/promptfighters /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 獲取 SSL 證書
sudo certbot --nginx -d api.promptfighters.com
```

---

## 🤖 AI 節點部署

### 方法 1：一鍵部署腳本（推薦）

創建快速部署腳本：

```bash
#!/bin/bash
# deploy-ai-node.sh

echo "🚀 AI Node 快速部署腳本"
echo "========================="

# 檢查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 請先安裝 Docker"
    echo "執行: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# 詢問配置
read -p "請輸入後端服務器地址 (例如: https://api.promptfighters.com): " BACKEND_URL
read -p "請輸入 Gemini API Key: " GEMINI_KEY
read -p "節點端口 (預設 8001): " NODE_PORT
NODE_PORT=${NODE_PORT:-8001}

# 檢測外部 IP
EXTERNAL_IP=$(curl -s https://api.ipify.org)
echo "偵測到外部 IP: $EXTERNAL_IP"
read -p "是否使用此 IP？(y/n, 預設 y): " USE_IP
USE_IP=${USE_IP:-y}

# 創建工作目錄
mkdir -p ~/ai-node
cd ~/ai-node

# 下載 AI Node 代碼
echo "📥 下載 AI Node 代碼..."
git clone https://github.com/your-repo/AiHeroBattle.git || {
    echo "使用現有代碼..."
}

cd AiHeroBattle/ai_node

# 創建 .env 文件
cat > .env << EOF
GEMINI_API_KEY=$GEMINI_KEY
AGGREGATOR_URL=$BACKEND_URL
NODE_PORT=$NODE_PORT
NODE_NAME=ai-node-$(hostname)
DEPLOYMENT_MODE=production
EOF

if [ "$USE_IP" != "y" ]; then
    read -p "請輸入節點外部地址（IP 或域名）: " CUSTOM_HOST
    echo "NODE_EXTERNAL_HOST=$CUSTOM_HOST" >> .env
fi

# 創建簡化的 docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  ai-node:
    build: .
    container_name: ai-node-prod
    env_file:
      - .env
    ports:
      - "${NODE_PORT:-8001}:${NODE_PORT:-8001}"
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOF

# 構建並啟動
echo "🔨 構建 Docker 鏡像..."
docker-compose build

echo "🚀 啟動 AI Node..."
docker-compose up -d

# 檢查狀態
sleep 5
echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 節點信息："
echo "  端口: $NODE_PORT"
echo "  後端: $BACKEND_URL"
echo ""
echo "🔍 檢查命令："
echo "  查看日誌: docker logs ai-node-prod -f"
echo "  查看狀態: docker ps"
echo "  健康檢查: curl http://localhost:$NODE_PORT/health"
echo ""
echo "🛑 停止節點: docker-compose down"

