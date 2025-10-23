#!/bin/bash

echo "🔄 啟動 AI 節點..."

# 檢查主服務器是否運行
echo "🔍 檢查主服務器狀態..."
if ! curl -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
    echo "❌ 主服務器未運行，請先啟動主服務器"
    exit 1
fi

echo "✅ 主服務器運行正常"

# 獲取宿主機 IP（適用於 Docker Desktop）
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    HOST_IP="host.docker.internal"
elif [[ "$OSTYPE" == "linux"* ]]; then
    # Linux
    HOST_IP=$(hostname -I | awk '{print $1}')
else
    # Windows (Git Bash)
    HOST_IP="host.docker.internal"
fi

echo "🌐 使用主服務器地址: http://$HOST_IP:8000"

# 設置環境變數並啟動節點
export AGGREGATOR_URL="http://$HOST_IP:8000"

# 停止現有節點
echo "🛑 停止現有節點..."
docker-compose -f ai_node/docker-compose.yml down

# 啟動節點
echo "🚀 啟動 AI 節點..."
cd ai_node
AGGREGATOR_URL="http://$HOST_IP:8000" docker-compose up -d

echo "⏳ 等待節點啟動..."
sleep 10

# 檢查節點狀態
echo "📊 檢查節點狀態:"
docker-compose ps

echo ""
echo "🔍 檢查節點健康狀態:"
for port in 8001 8002 8003; do
    if curl -f http://localhost:$port/health > /dev/null 2>&1; then
        echo "✅ 節點 $port: 健康"
    else
        echo "❌ 節點 $port: 不健康"
    fi
done

echo ""
echo "📝 查看節點日誌: docker-compose -f ai_node/docker-compose.yml logs -f"