# 🐳 Docker Compose 配置文件使用指南

## 📁 文件列表與用途

### 1️⃣ `docker-compose.yml` ⭐ **主要文件（本地開發用）**

**用途**: 本地開發環境，連接到本地的後端

**特點**:
- ✅ 單節點配置（適合開發測試）
- ✅ 使用 `host.docker.internal` 連接本地後端
- ✅ 加入 `aiherobattle-network` 網絡
- ✅ 自動重啟

**何時使用**:
- 在本機開發時使用
- 後端在本地 Docker 運行（`localhost:8000`）

**使用方式**:
```bash
# 啟動單個節點
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 停止
docker-compose down
```

---

### 2️⃣ `docker-compose.alt.yml` ⚡ **多節點測試（Alternative）**

**用途**: 本地多節點測試，測試分散式共識

**特點**:
- ✅ 3個節點（8001, 8002, 8003）
- ✅ 加入後端網絡 `backend_default`
- ✅ 內建健康檢查
- ✅ 適合測試節點投票和共識機制

**何時使用**:
- 測試多節點投票和共識
- 驗證分散式架構
- 性能測試

**使用方式**:
```bash
# 使用 alternative 配置啟動
docker-compose -f docker-compose.alt.yml up -d

# 查看所有節點狀態
docker-compose -f docker-compose.alt.yml ps

# 停止
docker-compose -f docker-compose.alt.yml down
```

---

### 3️⃣ `docker-compose.prod.yml` 🚀 **生產環境模板**

**用途**: 生產環境部署的範本（需要修改後使用）

**特點**:
- ✅ 生產環境配置
- ✅ 連接遠程 GCP 服務器
- ✅ 支持自動 IP 檢測
- ✅ 可選 host 網絡模式

**何時使用**:
- 部署到生產服務器（GCP/AWS/其他雲端）
- 節點由不同用戶運行
- 連接到公開的後端 API

**使用方式**:
```bash
# 方法 1: 複製並修改
cp docker-compose.prod.yml docker-compose.yml
nano docker-compose.yml  # 修改 AGGREGATOR_URL
docker-compose up -d

# 方法 2: 直接使用（推薦）
nano docker-compose.prod.yml  # 修改配置
docker-compose -f docker-compose.prod.yml up -d

# 方法 3: 使用部署腳本（最簡單）
./deploy-ai-node.sh
```

---

## 🎯 使用場景總結

### 場景 1: 本地開發 + 單節點測試
```bash
# 使用預設的 docker-compose.yml
cd ai_node
docker-compose up -d

# 或使用啟動腳本
./start_multiple_nodes.sh 1
```

### 場景 2: 本地開發 + 多節點測試（測試共識）
```bash
# 方法 A: 使用 alternative 配置（3個固定節點）
docker-compose -f docker-compose.alt.yml up -d

# 方法 B: 使用啟動腳本（彈性數量）
./start_multiple_nodes.sh 5  # 啟動5個節點
```

### 場景 3: 部署到 GCP（你自己的服務器）
```bash
# 方法 A: 使用部署腳本（推薦）
./deploy-ai-node.sh

# 方法 B: 手動配置
cp docker-compose.prod.yml docker-compose.yml
nano docker-compose.yml
# 修改:
#   AGGREGATOR_URL=https://your-gcp-server.com
#   NODE_EXTERNAL_HOST=your-server-ip (可選)
docker-compose up -d
```

### 場景 4: 其他人運行節點（去中心化）
```bash
# 其他貢獻者使用 production 配置
git clone https://github.com/your-repo/AiHeroBattle.git
cd AiHeroBattle/ai_node

# 創建 .env 文件
cat > .env << EOF
GEMINI_API_KEY=their-own-key
AGGREGATOR_URL=https://api.promptfighters.com
NODE_PORT=8001
DEPLOYMENT_MODE=production
EOF

# 使用 production 配置
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔧 配置差異對比

| 特性 | docker-compose.yml | docker-compose.alt.yml | docker-compose.prod.yml |
|------|-------------------|------------------------|------------------------|
| **節點數量** | 1 個 | 3 個 | 1-2 個（可擴展） |
| **網絡模式** | aiherobattle-network | backend_default | 獨立（可選 host） |
| **後端地址** | host.docker.internal:8000 | backend-web-1:8000 | https://your-server.com |
| **部署模式** | local | local | production |
| **健康檢查** | ❌ | ✅ | ❌ |
| **日誌掛載** | ✅ | ❌ | ❌ |
| **適用場景** | 本地開發 | 多節點測試 | 生產部署 |

---

## 📝 建議的簡化方案

為了避免混淆，我建議保留以下文件：

### 保留文件：

1. **`docker-compose.yml`** - 本地開發（單節點）
2. **`docker-compose.prod.yml`** - 生產環境範本

### 刪除文件：

- **`docker-compose.alt.yml`** - 可以用 `start_multiple_nodes.sh` 腳本代替

---

## 🚀 快速指令參考

```bash
# 本地開發
docker-compose up -d                              # 單節點
./start_multiple_nodes.sh 3                       # 多節點

# 測試多節點共識
docker-compose -f docker-compose.alt.yml up -d   # 使用 alt 配置

# 生產部署
./deploy-ai-node.sh                               # 交互式部署
docker-compose -f docker-compose.prod.yml up -d  # 手動部署

# 常用操作
docker-compose logs -f                            # 查看日誌
docker-compose ps                                 # 查看狀態
docker-compose down                               # 停止並刪除
docker-compose restart                            # 重啟
```

---

## ❓ 我該用哪個？

### 如果你是開發者：
- 日常開發：`docker-compose up -d`
- 測試共識：`./start_multiple_nodes.sh 5`

### 如果你要部署到生產：
- 第一次部署：`./deploy-ai-node.sh`
- 後續更新：`docker-compose -f docker-compose.prod.yml up -d --build`

### 如果你是貢獻者（想運行節點）：
- 使用 `docker-compose.prod.yml` 並配置 `.env` 文件

