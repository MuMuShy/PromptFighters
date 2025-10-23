# 🚀 AI Node 部署快速指南

## 📖 三種使用場景

### 1️⃣ 本地開發測試

```bash
# 單節點（最簡單）
docker-compose up -d

# 多節點測試（測試共識機制）
./start_multiple_nodes.sh 5  # 啟動5個節點
```

### 2️⃣ 部署到你的 GCP 服務器

```bash
# 使用一鍵部署腳本（推薦）
./deploy-ai-node.sh

# 腳本會自動：
# ✅ 檢測 Docker 環境
# ✅ 詢問後端地址和 API Key
# ✅ 自動檢測外部 IP
# ✅ 創建配置文件
# ✅ 啟動節點
```

### 3️⃣ 其他人運行節點（去中心化）

```bash
# 1. 克隆代碼
git clone https://github.com/your-repo/AiHeroBattle.git
cd AiHeroBattle/ai_node

# 2. 創建配置文件
cp .env.example .env
nano .env
# 填入：
#   GEMINI_API_KEY=你的API密鑰
#   AGGREGATOR_URL=https://api.promptfighters.com

# 3. 啟動節點
docker-compose -f docker-compose.prod.yml up -d

# 4. 檢查狀態
docker logs ai-node-prod-1 -f
```

---

## 📁 配置文件說明

| 文件 | 用途 | 使用場景 |
|------|------|---------|
| `docker-compose.yml` | 本地開發 | 在本機測試，後端在 localhost |
| `docker-compose.prod.yml` | 生產環境 | 部署到雲端服務器 |
| `.env.example` | 配置範本 | 複製並修改為 `.env` |
| `deploy-ai-node.sh` | 部署腳本 | 快速部署到生產環境 |
| `start_multiple_nodes.sh` | 多節點腳本 | 本地測試多節點共識 |

---

## 🔑 環境變量配置

### 必填項
```bash
GEMINI_API_KEY=your-gemini-api-key      # 必須
AGGREGATOR_URL=http://backend:8000      # 後端地址
```

### 選填項
```bash
NODE_PORT=8001                          # 端口（預設 8001）
NODE_NAME=ai-node-1                     # 節點名稱
DEPLOYMENT_MODE=auto                    # local/production/auto
NODE_EXTERNAL_HOST=your-ip              # 手動指定外部 IP
```

---

## 🏥 健康檢查

```bash
# 檢查節點狀態
curl http://localhost:8001/health

# 查看節點統計
curl http://localhost:8001/stats

# 查看日誌
docker logs ai-node-1 -f
# 或
tail -f logs/ai-node-1_*.log
```

---

## 🛠️ 常用命令

```bash
# 查看運行中的節點
docker ps

# 重啟節點
docker-compose restart

# 停止節點
docker-compose down

# 更新並重啟
docker-compose up -d --build

# 查看完整日誌
docker-compose logs -f
```

---

## 🌐 網絡說明

### 本地開發
- 節點通過 `host.docker.internal` 連接後端
- 加入 `aiherobattle-network` 網絡

### 生產環境
- 節點通過公網 IP 連接後端 API
- 自動檢測節點的外部 IP 並註冊
- 後端通過公網 IP 調用節點

---

## 📊 檢查節點是否成功註冊

```bash
# 方法 1: 查看節點日誌
docker logs ai-node-1 | grep "註冊成功"

# 方法 2: 調用後端 API
curl https://your-backend.com/api/nodes/

# 方法 3: 查看後端管理後台
# 訪問: https://your-backend.com/admin/game/ainode/
```

---

## 🐛 故障排除

### 問題 1: 節點無法註冊
```bash
# 檢查後端地址是否正確
echo $AGGREGATOR_URL

# 檢查後端是否可訪問
curl $AGGREGATOR_URL/api/health/

# 查看詳細錯誤
docker logs ai-node-1
```

### 問題 2: IP 檢測不正確
```bash
# 手動指定外部 IP
# 在 .env 文件中添加：
NODE_EXTERNAL_HOST=your-actual-ip

# 重啟節點
docker-compose restart
```

### 問題 3: 端口被佔用
```bash
# 檢查端口佔用
lsof -i :8001

# 修改端口
# 在 .env 文件中修改：
NODE_PORT=8101

# 重新啟動
docker-compose down
docker-compose up -d
```

---

## 📞 需要幫助？

- 查看完整文檔: `PRODUCTION_SETUP.md`
- 配置文件說明: `DOCKER_COMPOSE_GUIDE.md`
- 部署指南: `DEPLOYMENT.md`

