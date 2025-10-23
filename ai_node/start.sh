#!/bin/bash
set -e

echo "🚀 PromptFighters AI Node 啟動器"
echo "=================================="
echo ""

# 檢查 .env 文件
if [ ! -f ".env" ]; then
    echo "❌ 未找到 .env 文件"
    echo "💡 請創建 .env 文件並設置 GEMINI_API_KEY"
    echo ""
    echo "示例："
    echo "  echo 'GEMINI_API_KEY=your-api-key' > .env"
    exit 1
fi

# 檢查 GEMINI_API_KEY
if ! grep -q "GEMINI_API_KEY=" .env || grep -q "GEMINI_API_KEY=your" .env; then
    echo "❌ 請在 .env 文件中設置有效的 GEMINI_API_KEY"
    exit 1
fi

echo "📍 檢測網絡環境..."

# 獲取公網 IP
PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "unknown")

if [ "$PUBLIC_IP" = "unknown" ]; then
    echo "⚠️  無法獲取公網 IP，可能網絡不可用"
    echo "🔄 繼續啟動節點..."
else
    echo "📝 公網 IP: $PUBLIC_IP"
fi

# 檢查是否需要 Tunnel
USE_TUNNEL=false

# 清理舊容器（如果存在）
echo "🧹 清理舊容器..."
docker rm -f ai-node-1 ai-node-tunnel 2>/dev/null || true

# 構建最新鏡像
echo "🔨 構建最新鏡像..."
docker compose build ai-node > /dev/null 2>&1

# 先快速啟動節點測試
echo "🧪 測試端口可達性..."
docker compose up -d ai-node 2>&1 | grep -v "Warning" || true
echo "⏳ 等待節點啟動..."
sleep 8

# 測試本地端口是否啟動
LOCAL_READY=false
for i in {1..10}; do
    if curl -s --max-time 2 http://localhost:8001/health > /dev/null 2>&1; then
        LOCAL_READY=true
        break
    fi
    sleep 1
done

if [ "$LOCAL_READY" = "false" ]; then
    echo "❌ 節點啟動失敗"
    echo "🔍 請檢查日誌: docker logs ai-node-1"
    exit 1
fi

echo "✅ 節點本地啟動成功"

# 測試公網是否可達
if [ "$PUBLIC_IP" != "unknown" ]; then
    echo "🌐 測試公網可達性（從外部）..."
    
    # 使用外部服務測試端口是否真的開放
    # 方法 1: 嘗試從公網 IP 訪問（可能被防火牆阻擋）
    if timeout 3 curl -s http://$PUBLIC_IP:8001/health > /dev/null 2>&1; then
        echo "✅ 公網可訪問！"
        echo "📝 節點 URL: http://$PUBLIC_IP:8001"
        USE_TUNNEL=false
    else
        echo "⚠️  公網端口 8001 不可訪問"
        echo "   原因可能："
        echo "   - 防火牆未開放 8001 端口"
        echo "   - 在路由器（NAT）後面"
        echo "   - ISP 封鎖了入站連接"
        echo ""
        echo "💡 將使用 Cloudflare Tunnel 解決此問題"
        USE_TUNNEL=true
    fi
else
    # 無法獲取 IP，假設需要 Tunnel
    USE_TUNNEL=true
fi

# 根據檢測結果啟動服務
if [ "$USE_TUNNEL" = "true" ]; then
    echo ""
    echo "🌐 檢測到 NAT 網絡（路由器後面或防火牆限制）"
    echo "🔧 啟動 Cloudflare Tunnel 模式..."
    echo ""
    
    # 停止節點，啟動完整服務（包含 tunnel）
    docker compose down > /dev/null 2>&1
    
    # 重新構建（確保使用最新代碼）
    echo "🔨 構建最新鏡像..."
    docker compose build ai-node > /dev/null 2>&1
    
    # 設置環境變量並啟動
    export USE_TUNNEL=true
    docker compose --profile with-tunnel up -d
    
    echo "⏳ 等待 Tunnel 建立連接（最多 60 秒）..."
    
    # 等待並檢測 Tunnel URL
    TUNNEL_URL=""
    for i in {1..30}; do
        sleep 2
        # macOS compatible regex
        TUNNEL_URL=$(docker logs ai-node-tunnel 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1 || echo "")
        if [ -n "$TUNNEL_URL" ]; then
            break
        fi
        echo -n "."
    done
    echo ""
    
    if [ -n "$TUNNEL_URL" ]; then
        echo ""
        echo "✅ Tunnel 已建立！"
        echo "📝 節點 URL: $TUNNEL_URL"
        echo ""
        
        # 提取 hostname（移除 https://）
        TUNNEL_HOST=$(echo "$TUNNEL_URL" | sed 's|https://||')
        
        # 設置環境變量並重啟節點（讓節點使用 Tunnel URL）
        echo "🔄 更新節點配置..."
        
        # 備份原 .env
        if [ -f ".env" ]; then
            cp .env .env.backup
        fi
        
        # 更新 .env 文件
        # 先確保最後一行有換行符
        if [ -f ".env" ] && [ -n "$(tail -c 1 .env)" ]; then
            echo "" >> .env
        fi
        
        if grep -q "^NODE_EXTERNAL_HOST=" .env 2>/dev/null; then
            # 如果已存在，替換
            sed -i.bak "s|^NODE_EXTERNAL_HOST=.*|NODE_EXTERNAL_HOST=$TUNNEL_HOST|" .env
        else
            # 如果不存在，添加
            echo "NODE_EXTERNAL_HOST=$TUNNEL_HOST" >> .env
        fi
        
        # 確保 USE_TUNNEL=true
        if grep -q "^USE_TUNNEL=" .env 2>/dev/null; then
            sed -i.bak "s|^USE_TUNNEL=.*|USE_TUNNEL=true|" .env
        else
            echo "USE_TUNNEL=true" >> .env
        fi
        
        # 重新創建 ai-node 容器（加載新的 .env），保持 tunnel 運行
        docker compose up -d --force-recreate --no-deps ai-node
        
        echo "💡 節點已配置使用 Tunnel URL: $TUNNEL_URL"
        
        # 等待重啟
        sleep 5
    else
        echo ""
        echo "❌ Tunnel 啟動失敗或超時"
        echo "🔍 請檢查日誌: docker logs ai-node-tunnel"
        echo ""
        echo "可能的原因："
        echo "  1. Docker 網絡問題"
        echo "  2. Cloudflare 服務暫時不可用"
        echo "  3. 防火牆阻止了 cloudflared 連接"
        exit 1
    fi
else
    echo ""
    echo "✅ 節點已啟動（公網模式）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 AI 節點運行中！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 查看狀態:"
echo "   docker ps"
echo ""
echo "📝 查看節點日誌:"
echo "   docker logs ai-node-1 -f"
if [ "$USE_TUNNEL" = "true" ]; then
    echo ""
    echo "🌐 查看 Tunnel 日誌:"
    echo "   docker logs ai-node-tunnel -f"
fi
echo ""
echo "🛑 停止節點:"
if [ "$USE_TUNNEL" = "true" ]; then
    echo "   docker compose --profile with-tunnel down"
else
    echo "   docker compose down"
fi
echo ""

