# 🚀 AI 節點快速部署指南

## 一鍵啟動（推薦）

```bash
# 1. 創建配置文件
echo "GEMINI_API_KEY=your-api-key" > .env

# 2. 一鍵啟動（自動偵測網絡環境）
./start.sh
```

**就這麼簡單！** 🎉

---

## 它會做什麼？

`start.sh` 腳本會自動：

1. ✅ 檢測你的網絡環境
2. ✅ 判斷是否需要 Cloudflare Tunnel（家用網絡）
3. ✅ 自動啟動對應的服務
4. ✅ 節點自動註冊到後端

---

## 兩種模式

### 模式 A: 雲服務器（自動偵測）

如果你在 VPS/雲服務器上，腳本偵測到公網端口可訪問：

```
✅ 公網可訪問！
📝 節點 URL: http://203.0.113.42:8001
✅ 節點已啟動（公網模式）
```

### 模式 B: 家用網絡（自動啟動 Tunnel）

如果你在家用網絡（路由器後面），腳本自動啟動 Cloudflare Tunnel：

```
⚠️  公網端口 8001 不可訪問
🌐 啟動 Cloudflare Tunnel 模式...
✅ Tunnel 已建立！
📝 節點 URL: https://abc-123.trycloudflare.com
```

---

## 配置文件 (.env)

**最簡配置**：
```bash
GEMINI_API_KEY=your-api-key
```

**完整配置**（可選）：
```bash
# 必填
GEMINI_API_KEY=your-api-key

# 可選（通常不需要改）
AGGREGATOR_URL=https://api.promptfighters.app
DEPLOYMENT_MODE=auto
NODE_PORT=8001
```

---

## 手動啟動（進階用戶）

### 雲服務器模式
```bash
docker compose up -d
```

### 家用網絡模式（帶 Tunnel）
```bash
docker compose --profile with-tunnel up -d
```

---

## 常用命令

```bash
# 查看節點狀態
docker ps

# 查看節點日誌
docker logs ai-node-1 -f

# 查看 Tunnel 日誌（如果使用）
docker logs ai-node-tunnel -f

# 停止節點
docker compose down
# 或（如果使用 Tunnel）
docker compose --profile with-tunnel down

# 重啟節點
docker compose restart
```

---

## 常見問題

### Q: 需要安裝其他東西嗎？
A: 不需要！只要有 Docker 就行。Cloudflare Tunnel 已經包在 Docker 裡了。

### Q: 每次重啟 URL 會變嗎？
A: Tunnel URL 會變，但節點會自動重新註冊，不影響使用。

### Q: 如何確認節點成功註冊？
A: 查看日誌 `docker logs ai-node-1 -f`，看到 `✅ 節點註冊成功` 即可。

### Q: 我想用固定的 URL 怎麼辦？
A: 手動指定：
```bash
echo "NODE_EXTERNAL_HOST=your-domain.com" >> .env
docker compose restart
```

---

## 推薦部署方式

- **開發/測試**: 家用電腦 + Tunnel（免費）
- **生產環境**: 便宜的 VPS（$2.5-5/月，更穩定）
  - Digital Ocean
  - Vultr  
  - Linode
  - GCP e2-micro（免費）

---

## 需要幫助？

查看完整文檔：
- 部署指南: `DEPLOYMENT.md`
- Docker 配置: `DOCKER_COMPOSE_GUIDE.md`
- 節點 README: `README.md`

