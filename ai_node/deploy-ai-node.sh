#!/bin/bash
# AI Node 快速部署腳本

set -e

echo "🚀 AI Node 快速部署腳本"
echo "========================="
echo ""

# 檢查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 請先安裝 Docker"
    echo ""
    echo "Ubuntu/Debian:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    echo "  newgrp docker"
    echo ""
    exit 1
fi

# 檢查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 請先安裝 Docker Compose"
    exit 1
fi

echo "✅ Docker 環境檢查通過"
echo ""

# 詢問配置
read -p "請輸入後端服務器地址 (例如: https://api.promptfighters.com): " BACKEND_URL
while [ -z "$BACKEND_URL" ]; do
    echo "❌ 後端地址不能為空"
    read -p "請輸入後端服務器地址: " BACKEND_URL
done

read -sp "請輸入 Gemini API Key: " GEMINI_KEY
echo ""
while [ -z "$GEMINI_KEY" ]; do
    echo "❌ API Key 不能為空"
    read -sp "請輸入 Gemini API Key: " GEMINI_KEY
    echo ""
done

read -p "節點端口 (預設 8001): " NODE_PORT
NODE_PORT=${NODE_PORT:-8001}

read -p "節點名稱 (預設 ai-node-$(hostname)): " NODE_NAME
NODE_NAME=${NODE_NAME:-ai-node-$(hostname)}

echo ""
echo "🔍 偵測外部 IP..."
EXTERNAL_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "無法偵測")
if [ "$EXTERNAL_IP" != "無法偵測" ]; then
    echo "偵測到外部 IP: $EXTERNAL_IP"
    read -p "是否使用此 IP？(y/n, 預設 y): " USE_IP
    USE_IP=${USE_IP:-y}
else
    echo "⚠️  無法自動偵測 IP，將使用自動偵測模式"
    USE_IP="n"
fi

CUSTOM_HOST=""
if [ "$USE_IP" != "y" ]; then
    read -p "請輸入節點外部地址（留空使用自動偵測）: " CUSTOM_HOST
fi

echo ""
echo "📋 配置摘要："
echo "  後端地址: $BACKEND_URL"
echo "  節點端口: $NODE_PORT"
echo "  節點名稱: $NODE_NAME"
if [ -n "$CUSTOM_HOST" ]; then
    echo "  外部地址: $CUSTOM_HOST"
else
    echo "  外部地址: 自動偵測"
fi
echo ""
read -p "確認部署？(y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "❌ 取消部署"
    exit 0
fi

echo ""
echo "📁 創建配置文件..."

# 創建 .env 文件
cat > .env << EOF
# AI Node 配置
GEMINI_API_KEY=$GEMINI_KEY
AGGREGATOR_URL=$BACKEND_URL
NODE_PORT=$NODE_PORT
NODE_NAME=$NODE_NAME
DEPLOYMENT_MODE=production
MAX_CONCURRENT_REQUESTS=5
HEARTBEAT_INTERVAL=60
EOF

if [ -n "$CUSTOM_HOST" ]; then
    echo "NODE_EXTERNAL_HOST=$CUSTOM_HOST" >> .env
fi

echo "✅ 配置文件已創建: .env"

# 創建 logs 目錄
mkdir -p logs

# 創建簡化的 docker-compose.yml（如果不存在）
if [ ! -f "docker-compose.yml" ] || [ ! -s "docker-compose.yml" ]; then
    echo "📝 創建 docker-compose.yml..."
    cat > docker-compose.yml << 'YAML_EOF'
version: '3.8'

services:
  ai-node:
    build: .
    container_name: ai-node-prod
    env_file:
      - .env
    environment:
      - NODE_NAME=${NODE_NAME:-ai-node-1}
      - NODE_PORT=${NODE_PORT:-8001}
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
YAML_EOF
fi

echo ""
echo "🔨 構建 Docker 鏡像..."
docker-compose build

echo ""
echo "🚀 啟動 AI Node..."
docker-compose up -d

# 等待啟動
echo ""
echo "⏳ 等待節點啟動..."
sleep 5

# 檢查狀態
if docker ps | grep -q ai-node-prod; then
    echo ""
    echo "✅ 部署成功！"
    echo ""
    echo "📊 節點信息："
    echo "  容器名稱: ai-node-prod"
    echo "  節點名稱: $NODE_NAME"
    echo "  端口: $NODE_PORT"
    echo "  後端: $BACKEND_URL"
    echo ""
    echo "🔍 常用命令："
    echo "  查看日誌:   docker logs ai-node-prod -f"
    echo "  查看狀態:   docker ps"
    echo "  重啟節點:   docker-compose restart"
    echo "  停止節點:   docker-compose down"
    echo "  健康檢查:   curl http://localhost:$NODE_PORT/health"
    echo ""
    echo "📂 日誌文件位置: ./logs/"
    echo ""
    
    # 嘗試健康檢查
    echo "🏥 執行健康檢查..."
    sleep 2
    if curl -s http://localhost:$NODE_PORT/health > /dev/null 2>&1; then
        echo "✅ 健康檢查通過"
        curl -s http://localhost:$NODE_PORT/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:$NODE_PORT/health
    else
        echo "⚠️  無法連接到節點，請檢查日誌: docker logs ai-node-prod"
    fi
else
    echo ""
    echo "❌ 部署失敗，請檢查日誌:"
    echo "  docker logs ai-node-prod"
fi

