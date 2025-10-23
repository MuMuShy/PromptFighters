# 分散式AI戰鬥系統部署指南

## 架構概述

本系統採用 **Aggregator-Node** 分散式架構：

- **Aggregator（主控端）**：原有的 Django + Celery 系統，負責業務邏輯、資料庫操作、任務調度
- **Node（AI節點）**：獨立的 FastAPI 服務，負責呼叫 Gemini API 生成戰鬥結果
- **共識機制**：多個節點同時生成結果，透過多數決投票確定最終結果

## 最小改動原則

✅ **保留現有架構**：Django + Celery 核心邏輯不變  
✅ **向下兼容**：沒有外部節點時自動回退到本地生成  
✅ **漸進式升級**：可以先單機部署，再逐步添加節點  

## 部署模式

### 1. 單機模式（無變化）
直接運行現有系統，自動使用本地 Gemini API。

### 2. 混合模式（推薦）
主服務器 + 外部節點，享受分散式優勢。

### 3. 純分散式模式
主服務器僅做調度，所有AI生成由外部節點完成。

---

## 快速開始

### 步驟 1: 數據庫遷移
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### 步驟 2: 啟動主服務器
```bash
# 現有的 Django + Celery 啟動方式不變
docker-compose up -d
```

### 步驟 3: 部署AI節點

#### 方式A: Docker單節點
```bash
cd ai_node
cp .env.example .env
# 編輯 .env 填入你的 GEMINI_API_KEY

docker build -t promptfighters-node .
docker run -d \
  --name ai-node-1 \
  -p 8001:8001 \
  --env-file .env \
  promptfighters-node
```

#### 方式B: Docker多節點
```bash
cd ai_node
cp .env.example .env
# 編輯 .env 填入你的 GEMINI_API_KEY

# 啟動3個節點
docker-compose up -d
```

#### 方式C: 本地運行
```bash
cd ai_node
pip install -r requirements.txt

export GEMINI_API_KEY="your_key"
export AGGREGATOR_URL="http://localhost:8000"
export NODE_NAME="local-node-1"
export NODE_PORT="8001"

python main.py
```

### 步驟 4: 驗證部署
1. 檢查節點狀態：`GET http://localhost:8000/api/nodes/`
2. 觸發健康檢查：`POST http://localhost:8000/api/nodes/health-check/`
3. 創建戰鬥測試分散式生成

---

## 配置說明

### 主服務器配置
在 Django settings.py 中添加：
```python
# AI節點配置
AI_NODE_TIMEOUT = 30  # 節點調用超時時間(秒)
AI_NODE_MAX_RETRIES = 3  # 最大重試次數
MIN_CONSENSUS_NODES = 3  # 最小共識節點數
```

### 節點配置環境變數
```bash
# 必填
GEMINI_API_KEY=your_gemini_api_key

# 節點標識
NODE_NAME=ai-node-1
NODE_HOST=0.0.0.0
NODE_PORT=8001

# 連接主服務器
AGGREGATOR_URL=http://localhost:8000

# 性能配置
MAX_CONCURRENT_REQUESTS=5
NODE_WEIGHT=1
HEARTBEAT_INTERVAL=60

# 安全性（可選）
NODE_API_KEY=optional_security_key
```

---

## 負載均衡與容錯

### 節點選擇策略
- **確定性選擇**：相同戰鬥總是選擇相同節點組合
- **加權隨機**：根據節點權重和響應時間選擇
- **負載感知**：避免選擇已達並發上限的節點

### 共識機制
1. **多數決投票**：選擇獲得最多票數的獲勝者
2. **容錯回退**：節點不足時自動回退到本地生成
3. **結果驗證**：使用現有的血量驗證邏輯

### 健康檢查
- **自動心跳**：節點每60秒向主服務器報告狀態
- **主動檢查**：主服務器可觸發全節點健康檢查
- **故障隔離**：離線節點自動排除，恢復後重新加入

---

## 監控與管理

### 節點管理API

#### 查看所有節點
```bash
GET /api/nodes/
Authorization: Bearer <your_token>
```

#### 手動健康檢查
```bash
POST /api/nodes/health-check/
Authorization: Bearer <your_token>
```

#### 更新節點配置
```bash
PUT /api/nodes/{node_id}/
{
  "weight": 2,
  "max_concurrent_requests": 10,
  "status": "maintenance"
}
```

#### 移除節點
```bash
DELETE /api/nodes/{node_id}/remove/
```

### 監控指標
- 節點在線狀態
- 請求成功率
- 平均響應時間
- 當前並發請求數
- 投票共識統計

---

## 生產部署建議

### 1. 網絡配置
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  ai-node:
    image: promptfighters-node:latest
    environment:
      - AGGREGATOR_URL=https://your-domain.com
      - NODE_HOST=your-public-ip
    networks:
      - ai-network
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

### 2. 安全配置
- 使用 `NODE_API_KEY` 保護節點 API
- 配置防火牆限制節點訪問
- 使用 HTTPS 加密通信

### 3. 擴展配置
- 使用 Kubernetes 自動擴展節點
- 配置負載均衡器分發請求
- 實施 API 速率限制

### 4. 備份策略
- 定期備份節點配置
- 監控節點日誌
- 建立故障恢復流程

---

## 故障排除

### 常見問題

#### 1. 節點無法註冊
```bash
# 檢查網絡連通性
curl http://localhost:8000/api/nodes/register

# 檢查環境變數
echo $AGGREGATOR_URL
echo $GEMINI_API_KEY
```

#### 2. 戰鬥生成失敗
```bash
# 查看主服務器日誌
docker logs backend_web_1

# 查看節點日誌
docker logs ai-node-1

# 檢查節點健康狀態
curl http://localhost:8001/health
```

#### 3. 共識失敗
- 確保至少有3個健康節點
- 檢查節點間的一致性配置
- 驗證 Gemini API 配額

#### 4. 性能問題
- 調整 `MAX_CONCURRENT_REQUESTS`
- 增加節點權重 `NODE_WEIGHT`
- 優化網絡延遲

---

## 版本升級

### 從單機升級到分散式
1. 部署新的 AI 節點
2. 驗證節點正常工作
3. 現有戰鬥系統自動使用分散式生成

### 節點版本更新
```bash
# 滾動更新，保持服務可用性
docker-compose up -d --no-deps ai-node-1
# 等待節點健康檢查通過
docker-compose up -d --no-deps ai-node-2
docker-compose up -d --no-deps ai-node-3
```

---

## 總結

此分散式架構在「最小改動原則」下實現了：

✅ **平滑升級**：現有系統零停機升級  
✅ **漸進部署**：可先單節點試運行，再擴展  
✅ **自動容錯**：節點故障時自動回退到本地生成  
✅ **負載分散**：多節點分擔 API 調用壓力  
✅ **結果可靠**：多數決投票確保結果一致性  

透過容器化部署，您可以輕鬆在任何環境中快速啟動AI節點，實現真正的分散式AI戰鬥系統。