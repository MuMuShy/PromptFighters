# AI Hero Battle 後端架構說明文件

## 📋 目錄
- [1. 系統概述](#1-系統概述)
- [2. 整體架構](#2-整體架構)
- [3. 核心模組](#3-核心模組)
- [4. 分散式節點系統](#4-分散式節點系統)
- [5. 資料庫設計](#5-資料庫設計)
- [6. API 架構](#6-api-架構)
- [7. 任務調度系統](#7-任務調度系統)
- [8. 安全性設計](#8-安全性設計)
- [9. 監控與日誌](#9-監控與日誌)
- [10. 部署架構](#10-部署架構)
- [11. 擴展性設計](#11-擴展性設計)

---

## 1. 系統概述

### 1.1 項目簡介
AI Hero Battle 是一個基於AI驅動的回合制戰鬥遊戲平台，玩家創建AI生成的角色並進行戰鬥對決。系統採用現代化的微服務架構，支援高並發、高可用性和水平擴展。

### 1.2 技術棧
```
後端框架：  Django 5.0 + Django REST Framework
資料庫：    PostgreSQL (主資料庫) + Redis (緩存/任務隊列)
任務隊列：  Celery + Redis
AI服務：    Google Gemini API
節點服務：  FastAPI + Pydantic
容器化：    Docker + Docker Compose
認證：      JWT + Google OAuth + Web3錢包
支付：      Web3/區塊鏈集成
```

### 1.3 核心特性
- ✅ **AI驅動的戰鬥生成**：使用Gemini API生成動態戰鬥過程
- ✅ **分散式AI節點**：支援多節點分佈式AI生成，確保高可用性
- ✅ **多元認證系統**：支援Google OAuth和多種Web3錢包登入
- ✅ **天梯競技系統**：定時排程戰鬥，支援下注和獎勵分配
- ✅ **角色培養系統**：AI生成角色、技能，支援升級強化
- ✅ **經濟系統**：多種遊戲代幣，NFT集成準備
- ✅ **每日任務系統**：豐富的任務類型和獎勵機制

---

## 2. 整體架構

### 2.1 架構圖
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Angular 20)                   │
├─────────────────────────────────────────────────────────────┤
│                         API Gateway                         │
├─────────────────────────────────────────────────────────────┤
│                   Backend Services (Django)                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Game Service  │  │ Ladder Service  │  │ Auth Service │ │
│  │  - Characters   │  │  - Rankings     │  │ - OAuth      │ │
│  │  - Battles      │  │  - Betting      │  │ - Web3       │ │
│  │  - Quests       │  │  - Tournaments  │  │ - JWT        │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Task Queue (Celery)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Battle Tasks   │  │ Image Gen Tasks │  │ Scheduled    │ │
│  │                 │  │                 │  │ Tasks        │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                  Distributed AI Nodes                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   AI Node 1     │  │   AI Node 2     │  │   AI Node 3  │ │
│  │  (FastAPI)      │  │  (FastAPI)      │  │  (FastAPI)   │ │
│  │  - Battle Gen   │  │  - Battle Gen   │  │ - Battle Gen │ │
│  │  - Consensus    │  │  - Consensus    │  │ - Consensus  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   PostgreSQL    │  │      Redis      │  │    Media     │ │
│  │  - Game Data    │  │  - Cache        │  │   Storage    │ │
│  │  - User Data    │  │  - Sessions     │  │ - Images     │ │
│  │  - Battle Logs  │  │  - Task Queue   │  │ - Avatars    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 系統特性
- **高可用性**：分散式節點設計，單點故障自動回退
- **水平擴展**：支援動態添加AI節點和服務實例
- **異步處理**：Celery任務隊列處理耗時操作
- **實時通信**：WebSocket支援即時戰鬥更新
- **緩存機制**：Redis多層緩存提升性能

---

## 3. 核心模組

### 3.1 遊戲核心模組 (`game/`)

#### 3.1.1 模型設計 (`models.py`)
```python
# 核心實體
Player          # 玩家基本信息、資源、錢包
Character       # 角色數據、屬性、技能
Battle          # 戰鬥記錄、結果、日誌

# 進階系統
DailyQuest      # 每日任務定義
PlayerDailyQuest # 玩家任務進度
LadderSeason    # 天梯賽季
LadderRank      # 排名系統
ScheduledBattle # 定時戰鬥

# 分散式系統
AINode          # AI節點管理
BattleVotingRecord # 戰鬥投票記錄
```

#### 3.1.2 視圖架構 (`views.py`)
```python
# RESTful API 設計
CharacterViewSet    # 角色CRUD、召喚、升級
BattleViewSet      # 戰鬥創建、查詢、歷史
PlayerProfileView  # 玩家資料管理
LeaderboardView    # 排行榜查詢

# 認證系統
SocialLoginView    # Google OAuth登入
Web3LoginView      # Web3錢包登入
Web3NonceView      # Web3簽名驗證
```

#### 3.1.3 業務邏輯服務 (`services.py`)
```python
class GameService:
    - create_character()     # 角色創建邏輯
    - battle_matchmaking()   # 戰鬥配對算法
    - reward_calculation()   # 獎勵計算系統
    
class DailyQuestService:
    - check_quest_progress() # 任務進度檢查
    - complete_quest()       # 任務完成處理
    - reset_daily_quests()   # 每日重置邏輯
```

### 3.2 天梯系統模組 (`ladder_service.py`)

#### 3.2.1 核心功能
```python
class LadderService:
    # 排名管理
    - update_rankings()      # 排名計算算法
    - sync_season_rankings() # 賽季排名同步
    
    # 戰鬥調度
    - schedule_next_battle() # 智能戰鬥配對
    - start_battle()         # 戰鬥啟動邏輯
    - complete_battle()      # 戰鬥結算處理
    
    # 下注系統
    - calculate_odds()       # 動態賠率計算
    - settle_bets()          # 下注結算邏輯
```

#### 3.2.2 排名算法
```python
# ELO Rating 改進算法
def calculate_elo_change(winner_rating, loser_rating, k_factor=32):
    expected_winner = 1 / (1 + 10**((loser_rating - winner_rating) / 400))
    expected_loser = 1 - expected_winner
    
    winner_new = winner_rating + k_factor * (1 - expected_winner)
    loser_new = loser_rating + k_factor * (0 - expected_loser)
    
    return winner_new, loser_new
```

### 3.3 下注系統模組 (`betting_views.py`)

#### 3.3.1 下注邏輯
```python
# 動態賠率系統
class BettingService:
    - calculate_dynamic_odds()  # 基於下注量調整賠率
    - pool_distribution()       # 獎池分配算法
    - risk_management()         # 風險控制機制
    
# 防作弊機制
- bet_limit_validation()     # 下注限額檢查
- suspicious_pattern_detection() # 異常模式檢測
- cooling_period_enforcement()   # 冷卻期強制執行
```

---

## 4. 分散式節點系統

### 4.1 Aggregator（主控端）架構

#### 4.1.1 節點管理服務 (`node_service.py`)
```python
class NodeManager:
    """AI節點管理器 - 負載均衡、健康檢查、投票管理"""
    
    # 核心功能
    - get_available_nodes()          # 獲取可用節點列表
    - select_nodes_for_battle()      # 智能節點選擇算法
    - collect_battle_votes()         # 收集多節點投票
    - determine_consensus_result()   # 多數決共識算法
    
    # 負載均衡策略
    - weighted_random_selection()    # 加權隨機選擇
    - deterministic_selection()      # 確定性選擇（基於battle_id）
    - load_aware_routing()          # 負載感知路由
```

#### 4.1.2 共識機制設計
```python
def determine_consensus_result(voting_records, player_id, opponent_id):
    """多數決投票確定最終戰鬥結果"""
    
    # 1. 過濾有效投票
    valid_votes = [record for record in voting_records if record.is_valid]
    
    # 2. 統計投票結果
    winner_votes = Counter()
    for record in valid_votes:
        winner_votes[record.voted_winner_id] += 1
    
    # 3. 確保只考慮有效獲勝者ID
    valid_winner_ids = {str(player_id), str(opponent_id)}
    filtered_votes = {k: v for k, v in winner_votes.items() 
                     if k in valid_winner_ids}
    
    # 4. 多數決判定
    consensus_winner = max(filtered_votes, key=filtered_votes.get)
    max_votes = filtered_votes[consensus_winner]
    
    # 5. 檢查是否達到共識（超過半數）
    if max_votes <= len(valid_votes) // 2:
        return None  # 無法達成共識，回退到本地生成
    
    return consensus_winner
```

#### 4.1.3 容錯機制
```python
# 多層容錯設計
1. 節點選擇失敗 → 重新選擇其他節點
2. 節點調用超時 → 標記節點離線，使用其他節點
3. 投票不足 → 回退到本地Gemini API
4. 共識失敗 → 使用現有驗證邏輯修正結果
```

### 4.2 Node（AI節點）架構

#### 4.2.1 FastAPI服務結構 (`ai_node/main.py`)
```python
# FastAPI應用架構
app = FastAPI(
    title="AI Battle Node",
    description="Distributed AI node for generating battle results",
    version="1.0.0"
)

# 核心端點
@app.get("/health")              # 健康檢查
@app.post("/generate_battle")    # 戰鬥生成
@app.get("/stats")              # 節點統計

# 中間件
- security: HTTPBearer         # API密鑰認證
- logging: 結構化日誌記錄
- metrics: 性能指標收集
```

#### 4.2.2 節點註冊與心跳
```python
class NodeLifecycle:
    """節點生命週期管理"""
    
    async def register_with_aggregator():
        """註冊到主控端"""
        registration_data = {
            "name": NODE_NAME,
            "url": NODE_URL,
            "api_key": NODE_API_KEY,
            "weight": NODE_WEIGHT,
            "max_concurrent_requests": MAX_CONCURRENT
        }
        # POST /api/nodes/register
    
    async def send_heartbeat():
        """發送心跳信號"""
        heartbeat_data = {
            "node_id": NODE_ID,
            "current_requests": current_requests
        }
        # POST /api/nodes/heartbeat
    
    async def heartbeat_loop():
        """心跳循環（每60秒）"""
        while True:
            await send_heartbeat()
            await asyncio.sleep(HEARTBEAT_INTERVAL)
```

#### 4.2.3 並發控制與限流
```python
# 並發請求管理
current_requests = 0
max_concurrent_requests = 5

@app.post("/generate_battle")
async def generate_battle(request: BattleRequest):
    global current_requests
    
    # 檢查並發限制
    if current_requests >= max_concurrent_requests:
        raise HTTPException(503, "Node at capacity")
    
    current_requests += 1
    try:
        # 處理戰鬥生成邏輯
        result = await process_battle_generation(request)
        return result
    finally:
        current_requests -= 1
```

### 4.3 節點間通信協議

#### 4.3.1 API協議定義
```python
# 戰鬥生成請求
class BattleRequest(BaseModel):
    battle_id: str
    prompt: str
    seed: Optional[int] = None

# 戰鬥結果響應
class BattleResult(BaseModel):
    winner: str
    battle_log: List[BattleLogEntry]
    battle_description: str

# 節點註冊請求
class NodeRegistration(BaseModel):
    name: str
    url: str
    api_key: Optional[str] = None
    weight: int = 1
    max_concurrent_requests: int = 5
```

#### 4.3.2 錯誤處理機制
```python
# 分層錯誤處理
try:
    # 調用節點生成戰鬥
    battle_result = await node_manager.generate_battle_with_consensus(
        battle, battle_prompt
    )
except NodeTimeoutError:
    # 節點超時，使用其他節點
    logger.warning("Node timeout, retrying with other nodes")
    battle_result = await retry_with_backup_nodes()
except ConsensusFailedError:
    # 共識失敗，回退到本地
    logger.info("Consensus failed, falling back to local generation")
    battle_result = await local_gemini_generation()
except Exception as e:
    # 其他錯誤，記錄並回退
    logger.error(f"Unexpected error: {e}")
    battle_result = await fallback_generation()
```

---

## 5. 資料庫設計

### 5.1 核心數據模型

#### 5.1.1 用戶與角色系統
```sql
-- 玩家表
CREATE TABLE game_player (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES auth_user(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- 暱稱系統
    nickname VARCHAR(32) UNIQUE,
    nickname_changed BOOLEAN DEFAULT FALSE,
    
    -- Web3錢包
    wallet_address VARCHAR(42) UNIQUE,
    login_method VARCHAR(20) DEFAULT 'google',
    chain_id INTEGER DEFAULT 5000,
    
    -- 遊戲資源
    gold INTEGER DEFAULT 1000,
    prompt INTEGER DEFAULT 10,
    prompt_power INTEGER DEFAULT 5,
    exp_potion INTEGER DEFAULT 100,
    energy INTEGER DEFAULT 100,
    max_energy INTEGER DEFAULT 100,
    last_energy_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 角色表
CREATE TABLE game_character (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES game_player(id),
    name VARCHAR(100) NOT NULL,
    prompt TEXT,  -- AI生成的角色描述
    skill_description TEXT,  -- AI生成的技能描述
    
    -- 屬性系統
    strength INTEGER DEFAULT 0,
    agility INTEGER DEFAULT 0,
    luck INTEGER DEFAULT 0,
    rarity INTEGER DEFAULT 1,  -- 1-5星稀有度
    
    -- 戰鬥統計
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    
    -- AI生成內容
    image_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5.1.2 戰鬥系統
```sql
-- 戰鬥記錄表
CREATE TABLE game_battle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character1_id UUID REFERENCES game_character(id),
    character2_id UUID REFERENCES game_character(id),
    winner_id UUID REFERENCES game_character(id),
    
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING/COMPLETED/ERROR
    battle_log JSONB,  -- 完整戰鬥過程JSON
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引優化查詢性能
CREATE INDEX idx_battle_character1 ON game_battle(character1_id);
CREATE INDEX idx_battle_character2 ON game_battle(character2_id);
CREATE INDEX idx_battle_status ON game_battle(status);
CREATE INDEX idx_battle_created_at ON game_battle(created_at);
```

#### 5.1.3 天梯系統
```sql
-- 天梯賽季表
CREATE TABLE game_ladderseason (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT FALSE,
    prize_pool DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 天梯排名表
CREATE TABLE game_ladderrank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID REFERENCES game_ladderseason(id),
    player_id UUID REFERENCES game_player(id),
    character_id UUID REFERENCES game_character(id),
    
    current_rank INTEGER DEFAULT 999999,
    rank_points INTEGER DEFAULT 1000,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    
    is_eligible BOOLEAN DEFAULT TRUE,
    last_battle_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(season_id, player_id)  -- 每個賽季每個玩家只能有一個排名
);
```

### 5.2 分散式系統數據模型

#### 5.2.1 AI節點管理
```sql
-- AI節點表
CREATE TABLE game_ainode (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL UNIQUE,
    api_key VARCHAR(255),
    
    -- 節點狀態
    status VARCHAR(20) DEFAULT 'offline',  -- online/offline/error/maintenance
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    
    -- 性能統計
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    avg_response_time FLOAT DEFAULT 0.0,
    
    -- 負載均衡
    weight INTEGER DEFAULT 1,
    max_concurrent_requests INTEGER DEFAULT 5,
    current_requests INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 戰鬥投票記錄表
CREATE TABLE game_battlevotingrecord (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id UUID REFERENCES game_battle(id),
    node_id UUID REFERENCES game_ainode(id),
    
    voted_winner_id VARCHAR(100),
    battle_result JSONB,
    response_time FLOAT,
    
    is_valid BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(battle_id, node_id)  -- 每個節點每場戰鬥只能投票一次
);
```

### 5.3 數據庫優化策略

#### 5.3.1 索引策略
```sql
-- 高頻查詢索引
CREATE INDEX idx_player_wallet ON game_player(wallet_address);
CREATE INDEX idx_character_player ON game_character(player_id);
CREATE INDEX idx_battle_log_search ON game_battle USING GIN(battle_log);

-- 複合索引優化
CREATE INDEX idx_ladderrank_season_rank ON game_ladderrank(season_id, current_rank);
CREATE INDEX idx_ainode_status_heartbeat ON game_ainode(status, last_heartbeat);

-- 分區策略（適用於大量數據）
CREATE TABLE game_battle_y2024m01 PARTITION OF game_battle
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### 5.3.2 查詢優化
```python
# 使用select_related和prefetch_related優化查詢
def get_battle_with_characters(battle_id):
    return Battle.objects.select_related(
        'character1__player__user',
        'character2__player__user',
        'winner'
    ).get(id=battle_id)

# 使用原生SQL進行複雜查詢
def get_top_players_optimized():
    return Player.objects.raw("""
        SELECT p.*, 
               COUNT(b.id) as total_battles,
               SUM(CASE WHEN b.winner_id = c.id THEN 1 ELSE 0 END) as wins
        FROM game_player p
        JOIN game_character c ON p.id = c.player_id
        LEFT JOIN game_battle b ON (b.character1_id = c.id OR b.character2_id = c.id)
        GROUP BY p.id
        ORDER BY wins DESC
        LIMIT 100
    """)
```

---

## 6. API 架構

### 6.1 RESTful API設計原則

#### 6.1.1 URL設計規範
```
# 資源導向設計
GET    /api/characters/              # 獲取角色列表
POST   /api/characters/              # 創建新角色
GET    /api/characters/{id}/         # 獲取特定角色
PUT    /api/characters/{id}/         # 更新角色
DELETE /api/characters/{id}/         # 刪除角色

# 嵌套資源
GET    /api/characters/{id}/battles/ # 獲取角色的戰鬥記錄
POST   /api/characters/{id}/upgrade/ # 角色升級

# 集合操作
POST   /api/battles/                 # 創建戰鬥
GET    /api/battles/{id}/            # 獲取戰鬥詳情
GET    /api/battles/{id}/replay/     # 獲取戰鬥回放
```

#### 6.1.2 HTTP狀態碼規範
```python
# 成功響應
200 OK           # 成功獲取資源
201 Created      # 成功創建資源
204 No Content   # 成功但無內容返回

# 客戶端錯誤
400 Bad Request     # 請求參數錯誤
401 Unauthorized    # 未授權
403 Forbidden       # 權限不足
404 Not Found       # 資源不存在
409 Conflict        # 資源衝突
429 Too Many Requests # 請求過於頻繁

# 服務器錯誤
500 Internal Server Error  # 服務器內部錯誤
502 Bad Gateway           # 網關錯誤
503 Service Unavailable   # 服務不可用
```

### 6.2 API認證與授權

#### 6.2.1 JWT認證流程
```python
# JWT Token結構
{
    "header": {
        "alg": "HS256",
        "typ": "JWT"
    },
    "payload": {
        "user_id": 123,
        "username": "player001",
        "wallet_address": "0x...",
        "exp": 1640995200,  # 過期時間
        "iat": 1640908800   # 簽發時間
    },
    "signature": "..."
}

# 認證中間件
class JWTAuthenticationMiddleware:
    def process_request(self, request):
        token = request.META.get('HTTP_AUTHORIZATION')
        if token and token.startswith('Bearer '):
            try:
                payload = jwt.decode(token[7:], settings.SECRET_KEY, algorithms=['HS256'])
                request.user = User.objects.get(id=payload['user_id'])
            except (jwt.InvalidTokenError, User.DoesNotExist):
                return JsonResponse({'error': 'Invalid token'}, status=401)
```

#### 6.2.2 Web3錢包認證
```python
class Web3AuthenticationView(APIView):
    def post(self, request):
        wallet_address = request.data.get('wallet_address')
        signature = request.data.get('signature')
        message = request.data.get('message')
        
        # 驗證簽名
        if not self.verify_signature(wallet_address, signature, message):
            return Response({'error': 'Invalid signature'}, status=400)
        
        # 獲取或創建用戶
        player, created = Player.objects.get_or_create(
            wallet_address=wallet_address,
            defaults={
                'login_method': 'metamask',
                'user': User.objects.create_user(
                    username=f'web3_{wallet_address[:8]}'
                )
            }
        )
        
        # 生成JWT token
        token = jwt.encode({
            'user_id': player.user.id,
            'wallet_address': wallet_address,
            'exp': timezone.now() + timedelta(days=7)
        }, settings.SECRET_KEY, algorithm='HS256')
        
        return Response({'token': token, 'player': PlayerSerializer(player).data})
```

### 6.3 API版本控制

#### 6.3.1 URL版本控制
```python
# URL路由版本控制
urlpatterns = [
    path('api/v1/', include('game.urls.v1')),
    path('api/v2/', include('game.urls.v2')),
]

# 向後兼容性處理
class CharacterViewSetV2(CharacterViewSetV1):
    """V2版本的角色API，新增稀有度和成長系統"""
    
    def get_serializer_class(self):
        if self.request.version == 'v2':
            return CharacterSerializerV2
        return CharacterSerializerV1
```

#### 6.3.2 API文檔生成
```python
# 使用drf-spectacular自動生成API文檔
SPECTACULAR_SETTINGS = {
    'TITLE': 'AI Hero Battle API',
    'DESCRIPTION': 'AI驅動的戰鬥遊戲API文檔',
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/v[0-9]',
}

# API端點文檔化
class CharacterViewSet(ModelViewSet):
    """
    角色管理API
    
    提供角色的CRUD操作，包括創建、查詢、升級等功能
    """
    
    @extend_schema(
        summary="創建新角色",
        description="基於玩家輸入的提示詞，使用AI生成新的角色",
        request=CharacterCreateSerializer,
        responses={201: CharacterSerializer}
    )
    def create(self, request):
        pass
```

---

## 7. 任務調度系統

### 7.1 Celery架構設計

#### 7.1.1 任務分類與隊列
```python
# Celery配置
CELERY_TASK_ROUTES = {
    # AI生成任務（高優先級）
    'game.tasks.generate_character_image': {'queue': 'ai_generation'},
    'game.tasks.run_battle_task': {'queue': 'ai_generation'},
    
    # 定時任務（中優先級）
    'game.tasks.schedule_hourly_battles': {'queue': 'scheduled'},
    'game.tasks.sync_ladder_rankings_task': {'queue': 'scheduled'},
    
    # 清理任務（低優先級）
    'game.tasks.cleanup_old_battles': {'queue': 'cleanup'},
    'game.tasks.update_energy_system': {'queue': 'cleanup'},
}

# 多隊列Worker配置
# Worker 1: 專門處理AI生成任務
celery -A backend worker -Q ai_generation -c 4

# Worker 2: 處理定時任務
celery -A backend worker -Q scheduled -c 2

# Worker 3: 處理清理任務
celery -A backend worker -Q cleanup -c 1
```

#### 7.1.2 任務重試與錯誤處理
```python
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def run_battle_task(self, battle_id):
    try:
        # 戰鬥生成邏輯
        battle = Battle.objects.get(id=battle_id)
        result = generate_battle_result(battle)
        
        # 保存結果
        battle.battle_log = result
        battle.status = 'COMPLETED'
        battle.save()
        
    except TemporaryFailure as exc:
        # 臨時性錯誤，進行重試
        logger.warning(f"Battle {battle_id} failed temporarily: {exc}")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        
    except PermanentFailure as exc:
        # 永久性錯誤，標記為失敗
        logger.error(f"Battle {battle_id} failed permanently: {exc}")
        Battle.objects.filter(id=battle_id).update(
            status='ERROR',
            battle_log={'error': str(exc)}
        )
        
    except Exception as exc:
        # 未知錯誤，重試後標記失敗
        if self.request.retries >= self.max_retries:
            logger.error(f"Battle {battle_id} exhausted retries: {exc}")
            Battle.objects.filter(id=battle_id).update(status='ERROR')
        else:
            raise self.retry(exc=exc)
```

### 7.2 定時任務系統

#### 7.2.1 Celery Beat調度配置
```python
# 定時任務配置
CELERY_BEAT_SCHEDULE = {
    # 每小時排程天梯戰鬥
    'schedule-hourly-battles': {
        'task': 'game.tasks.schedule_hourly_battles',
        'schedule': crontab(minute=0),  # 每小時整點執行
    },
    
    # 開放下注（戰鬥前30分鐘）
    'open-betting': {
        'task': 'game.tasks.open_betting',
        'schedule': crontab(minute='*/5'),  # 每5分鐘檢查
    },
    
    # 關閉下注（戰鬥前5分鐘）
    'close-betting': {
        'task': 'game.tasks.close_betting',
        'schedule': crontab(minute='*/1'),  # 每分鐘檢查
    },
    
    # 開始定時戰鬥
    'start-scheduled-battles': {
        'task': 'game.tasks.start_scheduled_battles',
        'schedule': crontab(minute='*/1'),  # 每分鐘檢查
    },
    
    # 檢查已完成戰鬥
    'check-completed-battles': {
        'task': 'game.tasks.check_completed_battles',
        'schedule': crontab(minute='*/2'),  # 每2分鐘檢查
    },
    
    # 更新天梯排名
    'update-ladder-rankings': {
        'task': 'game.tasks.update_ladder_rankings',
        'schedule': crontab(minute=30),  # 每小時30分執行
    },
    
    # 清理舊戰鬥記錄
    'cleanup-old-battles': {
        'task': 'game.tasks.cleanup_old_battles',
        'schedule': crontab(hour=2, minute=0),  # 每日凌晨2點
    },
    
    # 每日任務重置
    'reset-daily-quests': {
        'task': 'game.tasks.reset_daily_quests',
        'schedule': crontab(hour=0, minute=0),  # 每日午夜
    },
    
    # 體力系統更新
    'update-energy-system': {
        'task': 'game.tasks.update_energy_system',
        'schedule': crontab(minute='*/10'),  # 每10分鐘
    },
}
```

#### 7.2.2 分散式任務調度
```python
# 分散式戰鬥生成任務
@shared_task
def run_battle_task(battle_id):
    """整合分散式節點的戰鬥生成任務"""
    try:
        with transaction.atomic():
            battle = Battle.objects.get(id=battle_id)
            player = battle.character1
            opponent = battle.character2
            
            # 準備戰鬥提示詞
            battle_prompt = generate_battle_prompt(player, opponent)
            
            # 嘗試使用分散式節點
            node_manager = NodeManager()
            battle_result = asyncio.run(
                node_manager.generate_battle_with_consensus(battle, battle_prompt)
            )
            
            # 如果節點失敗，回退到本地生成
            if battle_result is None:
                battle_result = local_gemini_generation(battle_prompt)
            
            # 驗證和保存結果
            if validate_battle_result(battle_result, player, opponent):
                save_battle_result(battle, battle_result)
            else:
                fix_and_save_battle_result(battle, battle_result, player, opponent)
                
    except Exception as e:
        logger.error(f"Battle task failed: {e}")
        mark_battle_as_error(battle_id, str(e))
```

### 7.3 任務監控與管理

#### 7.3.1 任務狀態追蹤
```python
# 任務狀態模型
class TaskExecutionLog(models.Model):
    task_id = models.CharField(max_length=100, unique=True)
    task_name = models.CharField(max_length=100)
    status = models.CharField(max_length=20)  # PENDING/RUNNING/SUCCESS/FAILURE
    
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True)
    error_message = models.TextField(null=True)
    
    # 性能指標
    execution_time = models.FloatField(null=True)
    memory_usage = models.IntegerField(null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

# 任務監控裝飾器
def monitor_task(func):
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        task_log = TaskExecutionLog.objects.create(
            task_id=self.request.id,
            task_name=func.__name__,
            status='RUNNING',
            started_at=timezone.now()
        )
        
        start_time = time.time()
        try:
            result = func(self, *args, **kwargs)
            
            task_log.status = 'SUCCESS'
            task_log.execution_time = time.time() - start_time
            task_log.completed_at = timezone.now()
            task_log.save()
            
            return result
            
        except Exception as e:
            task_log.status = 'FAILURE'
            task_log.error_message = str(e)
            task_log.execution_time = time.time() - start_time
            task_log.completed_at = timezone.now()
            task_log.save()
            
            raise
    
    return wrapper
```

---

## 8. 安全性設計

### 8.1 認證安全

#### 8.1.1 多層認證架構
```python
# 認證方式優先級
class AuthenticationBackend:
    """多重認證後端"""
    
    def authenticate(self, request):
        # 1. JWT Token認證（Web應用）
        if 'Authorization' in request.headers:
            return self.authenticate_jwt(request)
        
        # 2. Web3錢包簽名認證
        if 'X-Wallet-Signature' in request.headers:
            return self.authenticate_web3(request)
        
        # 3. Google OAuth（社交登入）
        if 'X-Google-Token' in request.headers:
            return self.authenticate_google(request)
        
        return None
    
    def authenticate_jwt(self, request):
        """JWT認證實現"""
        token = request.headers['Authorization'].replace('Bearer ', '')
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = User.objects.get(id=payload['user_id'])
            
            # 檢查token是否在黑名單中
            if TokenBlacklist.objects.filter(token=token).exists():
                raise AuthenticationFailed('Token has been revoked')
            
            return user, token
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Invalid token')
```

#### 8.1.2 Web3安全驗證
```python
class Web3SecurityValidator:
    """Web3錢包安全驗證"""
    
    def verify_wallet_signature(self, wallet_address, signature, message):
        """驗證錢包簽名"""
        try:
            # 重建原始訊息
            original_message = encode_defunct(text=message)
            
            # 恢復簽名者地址
            recovered_address = w3.eth.account.recover_message(
                original_message, 
                signature=signature
            )
            
            # 比較地址（不區分大小寫）
            return recovered_address.lower() == wallet_address.lower()
            
        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False
    
    def generate_nonce(self, wallet_address):
        """生成用於簽名的隨機nonce"""
        nonce = uuid.uuid4().hex
        
        # 緩存nonce（5分鐘有效期）
        cache.set(f"web3_nonce_{wallet_address}", nonce, timeout=300)
        
        return nonce
    
    def validate_nonce(self, wallet_address, nonce):
        """驗證nonce有效性"""
        cached_nonce = cache.get(f"web3_nonce_{wallet_address}")
        
        if not cached_nonce or cached_nonce != nonce:
            return False
        
        # 使用後刪除nonce（防止重放攻擊）
        cache.delete(f"web3_nonce_{wallet_address}")
        return True
```

### 8.2 API安全防護

#### 8.2.1 速率限制
```python
# 基於Redis的分層速率限制
class AdvancedRateLimiter:
    def __init__(self):
        self.redis_client = redis.Redis(connection_pool=redis_pool)
    
    def is_allowed(self, user_id, endpoint, rate_limit):
        """檢查是否允許請求"""
        key = f"rate_limit:{user_id}:{endpoint}"
        
        # 使用滑動窗口算法
        now = int(time.time())
        window_start = now - rate_limit['window']
        
        # 清理過期的請求記錄
        self.redis_client.zremrangebyscore(key, 0, window_start)
        
        # 檢查當前窗口內的請求數
        current_requests = self.redis_client.zcard(key)
        
        if current_requests >= rate_limit['max_requests']:
            return False
        
        # 記錄當前請求
        self.redis_client.zadd(key, {str(uuid.uuid4()): now})
        self.redis_client.expire(key, rate_limit['window'])
        
        return True

# 速率限制配置
RATE_LIMITS = {
    'character_create': {'max_requests': 10, 'window': 3600},  # 每小時10次
    'battle_create': {'max_requests': 100, 'window': 3600},   # 每小時100次
    'api_default': {'max_requests': 1000, 'window': 3600},    # 每小時1000次
}

# 速率限制中間件
class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.rate_limiter = AdvancedRateLimiter()
    
    def __call__(self, request):
        if request.user.is_authenticated:
            endpoint = self.get_endpoint_name(request)
            rate_limit = RATE_LIMITS.get(endpoint, RATE_LIMITS['api_default'])
            
            if not self.rate_limiter.is_allowed(request.user.id, endpoint, rate_limit):
                return JsonResponse({
                    'error': 'Rate limit exceeded',
                    'retry_after': rate_limit['window']
                }, status=429)
        
        return self.get_response(request)
```

#### 8.2.2 輸入驗證與清理
```python
class SecurityValidator:
    """安全驗證器"""
    
    @staticmethod
    def validate_character_name(name):
        """角色名稱安全驗證"""
        # 長度檢查
        if not (2 <= len(name) <= 50):
            raise ValidationError("角色名稱長度必須在2-50字符之間")
        
        # 字符白名單
        allowed_chars = re.compile(r'^[a-zA-Z0-9\u4e00-\u9fff\s\-_]+$')
        if not allowed_chars.match(name):
            raise ValidationError("角色名稱包含非法字符")
        
        # 敏感詞過濾
        if ProfanityFilter.contains_profanity(name):
            raise ValidationError("角色名稱包含敏感詞")
        
        return name
    
    @staticmethod
    def validate_battle_prompt(prompt):
        """戰鬥提示詞安全驗證"""
        # 長度限制
        if len(prompt) > 5000:
            raise ValidationError("提示詞過長")
        
        # SQL注入檢測
        sql_patterns = [
            r'(union|select|insert|update|delete|drop|create|alter)\s',
            r'(script|javascript|vbscript|onload|onerror)',
            r'(<script|</script>|<iframe|</iframe>)'
        ]
        
        for pattern in sql_patterns:
            if re.search(pattern, prompt, re.IGNORECASE):
                raise ValidationError("提示詞包含不安全內容")
        
        return prompt
    
    @staticmethod
    def sanitize_html_input(text):
        """HTML輸入清理"""
        import bleach
        
        # 允許的標籤和屬性
        allowed_tags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br']
        allowed_attributes = {}
        
        # 清理HTML
        clean_text = bleach.clean(
            text,
            tags=allowed_tags,
            attributes=allowed_attributes,
            strip=True
        )
        
        return clean_text
```

### 8.3 數據安全

#### 8.3.1 敏感數據加密
```python
class DataEncryption:
    """敏感數據加密工具"""
    
    def __init__(self):
        self.cipher = Fernet(settings.ENCRYPTION_KEY)
    
    def encrypt_wallet_data(self, wallet_data):
        """加密錢包相關數據"""
        if not wallet_data:
            return None
        
        # 序列化數據
        data_bytes = json.dumps(wallet_data).encode('utf-8')
        
        # 加密
        encrypted_data = self.cipher.encrypt(data_bytes)
        
        # Base64編碼存儲
        return base64.b64encode(encrypted_data).decode('utf-8')
    
    def decrypt_wallet_data(self, encrypted_data):
        """解密錢包數據"""
        if not encrypted_data:
            return None
        
        try:
            # Base64解碼
            encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
            
            # 解密
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            
            # 反序列化
            return json.loads(decrypted_bytes.decode('utf-8'))
            
        except Exception as e:
            logger.error(f"Failed to decrypt wallet data: {e}")
            return None

# 敏感字段加密模型
class EncryptedPlayer(models.Model):
    """加密玩家模型"""
    
    # 普通字段
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    
    # 加密字段
    _encrypted_wallet_data = models.TextField(null=True, blank=True)
    _encrypted_private_info = models.TextField(null=True, blank=True)
    
    @property
    def wallet_data(self):
        return DataEncryption().decrypt_wallet_data(self._encrypted_wallet_data)
    
    @wallet_data.setter
    def wallet_data(self, value):
        self._encrypted_wallet_data = DataEncryption().encrypt_wallet_data(value)
```

#### 8.3.2 數據庫安全配置
```python
# 數據庫連接安全配置
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
        'OPTIONS': {
            'sslmode': 'require',  # 強制SSL連接
            'sslcert': '/path/to/client-cert.pem',
            'sslkey': '/path/to/client-key.pem',
            'sslrootcert': '/path/to/ca-cert.pem',
        },
        'CONN_MAX_AGE': 600,  # 連接池
    }
}

# 數據庫查詢審計
class DatabaseAuditMiddleware:
    """數據庫操作審計中間件"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 記錄敏感操作
        if request.method in ['POST', 'PUT', 'DELETE']:
            AuditLog.objects.create(
                user=getattr(request, 'user', None),
                action=request.method,
                path=request.path,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                timestamp=timezone.now()
            )
        
        response = self.get_response(request)
        return response
```

---

## 9. 監控與日誌

### 9.1 應用監控系統

#### 9.1.1 性能指標收集
```python
# 自定義指標收集器
class MetricsCollector:
    """應用性能指標收集"""
    
    def __init__(self):
        self.redis_client = redis.Redis(connection_pool=redis_pool)
    
    def record_api_call(self, endpoint, method, status_code, response_time):
        """記錄API調用指標"""
        timestamp = int(time.time())
        key_prefix = f"metrics:api:{endpoint}:{method}"
        
        # 記錄響應時間
        self.redis_client.lpush(f"{key_prefix}:response_time", response_time)
        self.redis_client.ltrim(f"{key_prefix}:response_time", 0, 999)  # 保留最近1000條
        
        # 記錄狀態碼統計
        self.redis_client.hincrby(f"{key_prefix}:status_codes", status_code, 1)
        
        # 記錄每分鐘請求量
        minute_key = f"{key_prefix}:requests:{timestamp // 60}"
        self.redis_client.incr(minute_key)
        self.redis_client.expire(minute_key, 3600)  # 1小時過期
    
    def record_battle_metrics(self, battle_type, generation_time, node_count=0):
        """記錄戰鬥生成指標"""
        timestamp = int(time.time())
        
        # 戰鬥生成時間
        key = f"metrics:battle:{battle_type}:generation_time"
        self.redis_client.lpush(key, generation_time)
        self.redis_client.ltrim(key, 0, 999)
        
        # 節點使用統計
        if node_count > 0:
            node_key = f"metrics:battle:distributed_nodes:{timestamp // 3600}"
            self.redis_client.hincrby(node_key, str(node_count), 1)
            self.redis_client.expire(node_key, 86400)  # 24小時過期
    
    def get_metrics_summary(self, endpoint, timeframe=3600):
        """獲取指標摘要"""
        key_prefix = f"metrics:api:{endpoint}"
        
        # 響應時間統計
        response_times = self.redis_client.lrange(
            f"{key_prefix}:response_time", 0, -1
        )
        response_times = [float(t) for t in response_times]
        
        # 狀態碼統計
        status_codes = self.redis_client.hgetall(f"{key_prefix}:status_codes")
        
        # 請求量統計（最近1小時）
        now = int(time.time())
        total_requests = 0
        for minute in range(60):
            minute_key = f"{key_prefix}:requests:{(now - minute * 60) // 60}"
            requests = self.redis_client.get(minute_key)
            if requests:
                total_requests += int(requests)
        
        return {
            'avg_response_time': sum(response_times) / len(response_times) if response_times else 0,
            'max_response_time': max(response_times) if response_times else 0,
            'min_response_time': min(response_times) if response_times else 0,
            'total_requests': total_requests,
            'status_codes': {k.decode(): int(v) for k, v in status_codes.items()},
            'error_rate': self.calculate_error_rate(status_codes)
        }

# 性能監控中間件
class PerformanceMonitoringMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.metrics_collector = MetricsCollector()
    
    def __call__(self, request):
        start_time = time.time()
        
        response = self.get_response(request)
        
        # 記錄性能指標
        response_time = time.time() - start_time
        endpoint = self.get_endpoint_name(request)
        
        self.metrics_collector.record_api_call(
            endpoint=endpoint,
            method=request.method,
            status_code=response.status_code,
            response_time=response_time
        )
        
        # 慢查詢告警
        if response_time > 2.0:  # 超過2秒的請求
            logger.warning(f"Slow request detected: {endpoint} took {response_time:.2f}s")
        
        return response
```

#### 9.1.2 健康檢查系統
```python
class HealthCheckService:
    """系統健康檢查服務"""
    
    def __init__(self):
        self.checks = {
            'database': self.check_database,
            'redis': self.check_redis,
            'ai_nodes': self.check_ai_nodes,
            'external_apis': self.check_external_apis,
            'disk_space': self.check_disk_space,
            'memory_usage': self.check_memory_usage,
        }
    
    def run_all_checks(self):
        """執行所有健康檢查"""
        results = {}
        overall_status = 'healthy'
        
        for check_name, check_func in self.checks.items():
            try:
                result = check_func()
                results[check_name] = result
                
                if result['status'] != 'healthy':
                    overall_status = 'degraded' if overall_status == 'healthy' else 'unhealthy'
                    
            except Exception as e:
                results[check_name] = {
                    'status': 'unhealthy',
                    'error': str(e),
                    'timestamp': timezone.now().isoformat()
                }
                overall_status = 'unhealthy'
        
        return {
            'overall_status': overall_status,
            'checks': results,
            'timestamp': timezone.now().isoformat()
        }
    
    def check_database(self):
        """數據庫健康檢查"""
        try:
            start_time = time.time()
            
            # 執行簡單查詢
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            
            response_time = time.time() - start_time
            
            return {
                'status': 'healthy' if response_time < 0.1 else 'degraded',
                'response_time': response_time,
                'timestamp': timezone.now().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': timezone.now().isoformat()
            }
    
    def check_ai_nodes(self):
        """AI節點健康檢查"""
        total_nodes = AINode.objects.count()
        online_nodes = AINode.objects.filter(
            status='online',
            last_heartbeat__gte=timezone.now() - timedelta(minutes=5)
        ).count()
        
        if total_nodes == 0:
            status = 'healthy'  # 沒有節點時使用本地生成
        elif online_nodes / total_nodes >= 0.5:
            status = 'healthy'
        elif online_nodes > 0:
            status = 'degraded'
        else:
            status = 'unhealthy'
        
        return {
            'status': status,
            'total_nodes': total_nodes,
            'online_nodes': online_nodes,
            'availability': online_nodes / total_nodes if total_nodes > 0 else 1.0,
            'timestamp': timezone.now().isoformat()
        }

# 健康檢查API端點
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """健康檢查端點"""
    health_service = HealthCheckService()
    result = health_service.run_all_checks()
    
    # 根據健康狀態返回適當的HTTP狀態碼
    status_code = {
        'healthy': 200,
        'degraded': 200,  # 部分功能可用
        'unhealthy': 503   # 服務不可用
    }.get(result['overall_status'], 503)
    
    return Response(result, status=status_code)
```

### 9.2 日誌系統設計

#### 9.2.1 結構化日誌配置
```python
# 日誌配置
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d'
        },
        'detailed': {
            'format': '[{asctime}] {levelname} {name} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/aiherobattle/app.log',
            'maxBytes': 50 * 1024 * 1024,  # 50MB
            'backupCount': 10,
            'formatter': 'json',
        },
        'error_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/aiherobattle/error.log',
            'maxBytes': 50 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'json',
            'level': 'ERROR',
        },
        'security_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/aiherobattle/security.log',
            'maxBytes': 100 * 1024 * 1024,  # 100MB
            'backupCount': 20,
            'formatter': 'json',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
        'game': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'security': {
            'handlers': ['security_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
    },
    'root': {
        'handlers': ['console', 'file', 'error_file'],
        'level': 'INFO',
    },
}

# 自定義日誌記錄器
class GameLogger:
    """遊戲專用日誌記錄器"""
    
    def __init__(self):
        self.logger = logging.getLogger('game')
        self.security_logger = logging.getLogger('security')
    
    def log_battle_created(self, battle, user):
        """記錄戰鬥創建"""
        self.logger.info("Battle created", extra={
            'event_type': 'battle_created',
            'battle_id': str(battle.id),
            'user_id': user.id,
            'character1_id': str(battle.character1.id),
            'character2_id': str(battle.character2.id),
            'timestamp': timezone.now().isoformat()
        })
    
    def log_distributed_battle(self, battle_id, node_count, consensus_reached):
        """記錄分散式戰鬥生成"""
        self.logger.info("Distributed battle generation", extra={
            'event_type': 'distributed_battle',
            'battle_id': battle_id,
            'node_count': node_count,
            'consensus_reached': consensus_reached,
            'timestamp': timezone.now().isoformat()
        })
    
    def log_security_event(self, event_type, user, details):
        """記錄安全事件"""
        self.security_logger.warning("Security event detected", extra={
            'event_type': event_type,
            'user_id': getattr(user, 'id', None),
            'username': getattr(user, 'username', 'anonymous'),
            'details': details,
            'timestamp': timezone.now().isoformat()
        })
    
    def log_performance_issue(self, endpoint, response_time, details):
        """記錄性能問題"""
        self.logger.warning("Performance issue detected", extra={
            'event_type': 'performance_issue',
            'endpoint': endpoint,
            'response_time': response_time,
            'details': details,
            'timestamp': timezone.now().isoformat()
        })
```

#### 9.2.2 日誌分析與告警
```python
class LogAnalyzer:
    """日誌分析器"""
    
    def __init__(self):
        self.redis_client = redis.Redis(connection_pool=redis_pool)
    
    def analyze_error_patterns(self, time_window=3600):
        """分析錯誤模式"""
        # 這裡可以集成ELK Stack或其他日誌分析工具
        # 簡化版本使用Redis進行基本統計
        
        error_patterns = {}
        current_time = int(time.time())
        
        # 分析最近1小時的錯誤日誌
        for minute in range(60):
            timestamp = current_time - minute * 60
            error_key = f"errors:{timestamp // 60}"
            
            errors = self.redis_client.hgetall(error_key)
            for error_type, count in errors.items():
                error_type = error_type.decode()
                if error_type not in error_patterns:
                    error_patterns[error_type] = 0
                error_patterns[error_type] += int(count)
        
        # 檢測異常模式
        alerts = []
        for error_type, count in error_patterns.items():
            if count > 50:  # 1小時內超過50次相同錯誤
                alerts.append({
                    'type': 'high_error_rate',
                    'error_type': error_type,
                    'count': count,
                    'severity': 'high' if count > 100 else 'medium'
                })
        
        return {
            'error_patterns': error_patterns,
            'alerts': alerts,
            'analysis_timestamp': timezone.now().isoformat()
        }
    
    def send_alert(self, alert):
        """發送告警通知"""
        # 可以集成Slack、郵件、短信等通知方式
        if alert['severity'] == 'high':
            # 發送緊急通知
            self.send_slack_notification(alert)
            self.send_email_notification(alert)
        else:
            # 發送常規通知
            self.send_slack_notification(alert)
```

---

## 10. 部署架構

### 10.1 容器化部署

#### 10.1.1 Docker配置
```dockerfile
# 主應用Dockerfile
FROM python:3.11-slim

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 複製依賴文件
COPY requirements.txt .

# 安裝Python依賴
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用代碼
COPY . .

# 創建非root用戶
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

# 暴露端口
EXPOSE 8000

# 啟動命令
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "backend.wsgi:application"]
```

#### 10.1.2 Docker Compose生產配置
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # 主應用服務
  web:
    build: 
      context: .
      dockerfile: Dockerfile.prod
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
      - ./logs:/var/log/aiherobattle
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings.production
      - DATABASE_URL=postgresql://user:pass@db:5432/aiherobattle
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - app-network

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - static_volume:/app/staticfiles
      - media_volume:/app/media
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - web
    restart: unless-stopped
    networks:
      - app-network

  # PostgreSQL數據庫
  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf
    environment:
      - POSTGRES_DB=aiherobattle
      - POSTGRES_USER=aihero
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped
    networks:
      - app-network

  # Redis緩存和任務隊列
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - app-network

  # Celery Worker
  celery:
    build: 
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A backend worker -l info -Q ai_generation,scheduled,cleanup
    volumes:
      - ./logs:/var/log/aiherobattle
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings.production
      - DATABASE_URL=postgresql://user:pass@db:5432/aiherobattle
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - app-network

  # Celery Beat調度器
  celery-beat:
    build: 
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A backend beat -l info
    volumes:
      - ./logs:/var/log/aiherobattle
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings.production
      - DATABASE_URL=postgresql://user:pass@db:5432/aiherobattle
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - app-network

  # AI節點服務
  ai-node-1:
    build: 
      context: ./ai_node
      dockerfile: Dockerfile
    environment:
      - NODE_NAME=production-node-1
      - AGGREGATOR_URL=http://web:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - NODE_WEIGHT=2
    restart: unless-stopped
    networks:
      - app-network

  ai-node-2:
    build: 
      context: ./ai_node
      dockerfile: Dockerfile
    environment:
      - NODE_NAME=production-node-2
      - AGGREGATOR_URL=http://web:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - NODE_WEIGHT=2
    restart: unless-stopped
    networks:
      - app-network

  ai-node-3:
    build: 
      context: ./ai_node
      dockerfile: Dockerfile
    environment:
      - NODE_NAME=production-node-3
      - AGGREGATOR_URL=http://web:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - NODE_WEIGHT=1
    restart: unless-stopped
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:
  static_volume:
  media_volume:

networks:
  app-network:
    driver: bridge
```

### 10.2 Kubernetes部署

#### 10.2.1 K8s部署配置
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: aiherobattle

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: aiherobattle
data:
  DJANGO_SETTINGS_MODULE: "backend.settings.production"
  CELERY_BROKER_URL: "redis://redis-service:6379/0"
  DATABASE_URL: "postgresql://user:pass@postgres-service:5432/aiherobattle"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: aiherobattle
type: Opaque
data:
  DJANGO_SECRET_KEY: <base64-encoded-secret>
  DB_PASSWORD: <base64-encoded-password>
  GEMINI_API_KEY: <base64-encoded-api-key>

---
# k8s/web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
  namespace: aiherobattle
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: aiherobattle:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health/
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/web-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
  namespace: aiherobattle
spec:
  selector:
    app: web
  ports:
  - protocol: TCP
    port: 8000
    targetPort: 8000
  type: ClusterIP

---
# k8s/ai-node-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-node-deployment
  namespace: aiherobattle
spec:
  replicas: 5
  selector:
    matchLabels:
      app: ai-node
  template:
    metadata:
      labels:
        app: ai-node
    spec:
      containers:
      - name: ai-node
        image: aiherobattle-node:latest
        ports:
        - containerPort: 8001
        env:
        - name: AGGREGATOR_URL
          value: "http://web-service:8000"
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        envFrom:
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
  namespace: aiherobattle
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-deployment
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 10.3 CI/CD流水線

#### 10.3.1 GitHub Actions配置
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    
    - name: Run tests
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379/0
      run: |
        cd backend
        python manage.py migrate
        python manage.py test
    
    - name: Run security checks
      run: |
        cd backend
        pip install bandit safety
        bandit -r . -x */tests/*
        safety check
    
    - name: Run linting
      run: |
        cd backend
        pip install flake8 black isort
        flake8 .
        black --check .
        isort --check-only .

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    permissions:
      contents: read
      packages: write
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix=commit-
    
    - name: Build and push main image
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
    
    - name: Build and push AI node image
      uses: docker/build-push-action@v4
      with:
        context: ./ai_node
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-node:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to production
      uses: appleboy/ssh-action@v0.1.8
      with:
        host: ${{ secrets.PROD_HOST }}
        username: ${{ secrets.PROD_USER }}
        key: ${{ secrets.PROD_SSH_KEY }}
        script: |
          cd /opt/aiherobattle
          docker-compose -f docker-compose.prod.yml pull
          docker-compose -f docker-compose.prod.yml up -d
          docker system prune -f
    
    - name: Verify deployment
      run: |
        sleep 60  # 等待服務啟動
        curl -f ${{ secrets.PROD_URL }}/api/health/ || exit 1
```

---

## 11. 擴展性設計

### 11.1 水平擴展策略

#### 11.1.1 服務分層擴展
```python
# 服務分層設計
class ServiceLayer:
    """服務分層架構"""
    
    # 無狀態服務層（可水平擴展）
    class StatelessServices:
        - API Gateway          # 請求路由和負載均衡
        - Authentication Service # 認證服務
        - Game Logic Service   # 遊戲邏輯處理
        - Battle Generation Service # 戰鬥生成服務
        - Notification Service # 通知服務
    
    # 有狀態服務層（需要特殊處理）
    class StatefulServices:
        - Database Cluster     # 主從複製 + 讀寫分離
        - Redis Cluster       # 分片 + 高可用
        - Message Queue       # 分散式隊列
        - File Storage        # 分散式文件存儲

# 負載均衡配置
class LoadBalancerConfig:
    """負載均衡器配置"""
    
    # API層負載均衡
    API_LOAD_BALANCER = {
        'algorithm': 'round_robin',  # 輪詢算法
        'health_check': {
            'path': '/api/health/',
            'interval': 30,
            'timeout': 5,
            'retries': 3
        },
        'sticky_sessions': False,  # 無狀態服務不需要會話黏性
        'max_connections': 1000
    }
    
    # AI節點負載均衡
    AI_NODE_LOAD_BALANCER = {
        'algorithm': 'weighted_least_connections',  # 加權最少連接
        'weights': {
            'high_performance_nodes': 3,
            'standard_nodes': 2,
            'backup_nodes': 1
        },
        'circuit_breaker': {
            'failure_threshold': 5,
            'timeout': 60,
            'recovery_timeout': 300
        }
    }
```

#### 11.1.2 數據庫擴展策略
```python
# 數據庫分片策略
class DatabaseSharding:
    """數據庫分片設計"""
    
    def __init__(self):
        self.shards = {
            'shard_1': {  # 用戶數據分片
                'range': 'user_id % 3 == 0',
                'tables': ['game_player', 'auth_user', 'game_character'],
                'host': 'db-shard-1.example.com'
            },
            'shard_2': {
                'range': 'user_id % 3 == 1',
                'tables': ['game_player', 'auth_user', 'game_character'],
                'host': 'db-shard-2.example.com'
            },
            'shard_3': {
                'range': 'user_id % 3 == 2',
                'tables': ['game_player', 'auth_user', 'game_character'],
                'host': 'db-shard-3.example.com'
            },
            'global_shard': {  # 全局數據
                'tables': ['game_battle', 'game_ladderseason', 'game_ainode'],
                'host': 'db-global.example.com'
            }
        }
    
    def get_shard(self, user_id=None, table_name=None):
        """根據用戶ID或表名獲取對應分片"""
        if table_name in ['game_battle', 'game_ladderseason', 'game_ainode']:
            return self.shards['global_shard']
        
        if user_id:
            shard_key = f'shard_{(user_id % 3) + 1}'
            return self.shards[shard_key]
        
        raise ValueError("Either user_id or table_name must be provided")

# 讀寫分離配置
DATABASES = {
    'default': {},  # 寫庫
    'read_replica_1': {  # 讀庫1
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': 'read-replica-1.example.com',
        # ... 其他配置
    },
    'read_replica_2': {  # 讀庫2
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': 'read-replica-2.example.com',
        # ... 其他配置
    }
}

DATABASE_ROUTERS = ['game.routers.DatabaseRouter']

class DatabaseRouter:
    """數據庫路由器 - 實現讀寫分離"""
    
    def db_for_read(self, model, **hints):
        """讀操作路由到讀副本"""
        if model._meta.app_label == 'game':
            return random.choice(['read_replica_1', 'read_replica_2'])
        return None
    
    def db_for_write(self, model, **hints):
        """寫操作路由到主庫"""
        if model._meta.app_label == 'game':
            return 'default'
        return None
```

### 11.2 緩存策略設計

#### 11.2.1 多層緩存架構
```python
# 多層緩存設計
class CacheManager:
    """多層緩存管理器"""
    
    def __init__(self):
        # L1緩存：本地內存（最快，但容量小）
        self.l1_cache = {}
        self.l1_max_size = 1000
        
        # L2緩存：Redis（快速，容量中等）
        self.l2_cache = redis.Redis(connection_pool=redis_pool)
        
        # L3緩存：分散式緩存（容量大，速度適中）
        self.l3_cache = self.setup_distributed_cache()
    
    def get(self, key):
        """多層緩存讀取"""
        # 1. 檢查L1緩存
        if key in self.l1_cache:
            return self.l1_cache[key]
        
        # 2. 檢查L2緩存
        value = self.l2_cache.get(key)
        if value:
            # 回寫到L1緩存
            self.set_l1_cache(key, value)
            return pickle.loads(value)
        
        # 3. 檢查L3緩存
        value = self.l3_cache.get(key)
        if value:
            # 回寫到L1和L2緩存
            self.set_l1_cache(key, value)
            self.l2_cache.setex(key, 3600, pickle.dumps(value))
            return value
        
        return None
    
    def set(self, key, value, ttl=3600):
        """多層緩存寫入"""
        # 寫入所有緩存層
        self.set_l1_cache(key, value)
        self.l2_cache.setex(key, ttl, pickle.dumps(value))
        self.l3_cache.set(key, value, ttl)
    
    def invalidate(self, pattern):
        """緩存失效"""
        # 清理所有層的相關緩存
        for key in list(self.l1_cache.keys()):
            if fnmatch.fnmatch(key, pattern):
                del self.l1_cache[key]
        
        # Redis模式匹配刪除
        for key in self.l2_cache.scan_iter(match=pattern):
            self.l2_cache.delete(key)

# 緩存策略配置
CACHE_STRATEGIES = {
    # 用戶數據緩存（長期）
    'user_profile': {
        'ttl': 3600 * 24,  # 24小時
        'pattern': 'user_profile:{user_id}',
        'invalidate_on': ['profile_update', 'user_logout']
    },
    
    # 角色數據緩存（中期）
    'character_data': {
        'ttl': 3600 * 6,   # 6小時
        'pattern': 'character:{character_id}',
        'invalidate_on': ['character_update', 'character_upgrade']
    },
    
    # 排行榜緩存（短期）
    'leaderboard': {
        'ttl': 300,        # 5分鐘
        'pattern': 'leaderboard:*',
        'invalidate_on': ['battle_completed', 'rankings_updated']
    },
    
    # 戰鬥結果緩存（永久，除非手動清理）
    'battle_results': {
        'ttl': 3600 * 24 * 30,  # 30天
        'pattern': 'battle:{battle_id}',
        'invalidate_on': []  # 戰鬥結果不變，很少失效
    }
}
```

#### 11.2.2 智能緩存預熱
```python
class CacheWarmer:
    """緩存預熱器"""
    
    def __init__(self):
        self.cache_manager = CacheManager()
    
    def warm_user_cache(self, user_id):
        """預熱用戶相關緩存"""
        # 預載用戶資料
        user_profile = self.get_user_profile(user_id)
        self.cache_manager.set(f'user_profile:{user_id}', user_profile)
        
        # 預載用戶角色
        characters = self.get_user_characters(user_id)
        for character in characters:
            self.cache_manager.set(f'character:{character.id}', character)
        
        # 預載戰鬥歷史（最近10場）
        recent_battles = self.get_recent_battles(user_id, limit=10)
        for battle in recent_battles:
            self.cache_manager.set(f'battle:{battle.id}', battle)
    
    def warm_popular_data(self):
        """預熱熱門數據"""
        # 預熱排行榜
        leaderboard = self.get_current_leaderboard()
        self.cache_manager.set('leaderboard:current', leaderboard)
        
        # 預熱熱門角色
        popular_characters = self.get_popular_characters(limit=100)
        for character in popular_characters:
            self.cache_manager.set(f'character:{character.id}', character)
    
    @shared_task
    def scheduled_cache_warming(self):
        """定時緩存預熱任務"""
        # 分析訪問模式，預測需要預熱的數據
        active_users = self.get_active_users(hours=24)
        
        for user_id in active_users:
            self.warm_user_cache(user_id)
        
        self.warm_popular_data()
```

### 11.3 微服務架構演進

#### 11.3.1 服務拆分策略
```python
# 微服務拆分設計
class MicroserviceArchitecture:
    """微服務架構設計"""
    
    # 核心服務
    CORE_SERVICES = {
        'user-service': {
            'responsibilities': [
                'User authentication and authorization',
                'User profile management',
                'Wallet integration'
            ],
            'data_models': ['Player', 'UserSession', 'WalletData'],
            'apis': ['/auth', '/users', '/profiles']
        },
        
        'character-service': {
            'responsibilities': [
                'Character creation and management',
                'Character attributes and skills',
                'Character image generation'
            ],
            'data_models': ['Character', 'CharacterSkill', 'CharacterImage'],
            'apis': ['/characters', '/skills', '/images']
        },
        
        'battle-service': {
            'responsibilities': [
                'Battle creation and execution',
                'Battle result processing',
                'Battle history management'
            ],
            'data_models': ['Battle', 'BattleLog', 'BattleResult'],
            'apis': ['/battles', '/results', '/history']
        },
        
        'ladder-service': {
            'responsibilities': [
                'Ranking system management',
                'Tournament organization',
                'Seasonal competitions'
            ],
            'data_models': ['LadderSeason', 'LadderRank', 'Tournament'],
            'apis': ['/rankings', '/tournaments', '/seasons']
        },
        
        'ai-orchestrator': {
            'responsibilities': [
                'AI node management',
                'Distributed battle generation',
                'Consensus mechanism'
            ],
            'data_models': ['AINode', 'BattleVotingRecord', 'ConsensusResult'],
            'apis': ['/ai-nodes', '/consensus', '/distributed-battles']
        }
    }
    
    # 支撐服務
    SUPPORT_SERVICES = {
        'notification-service': {
            'responsibilities': ['Push notifications', 'Email alerts', 'In-app messages'],
            'apis': ['/notifications', '/alerts']
        },
        
        'analytics-service': {
            'responsibilities': ['User behavior tracking', 'Game metrics', 'Performance analytics'],
            'apis': ['/analytics', '/metrics']
        },
        
        'payment-service': {
            'responsibilities': ['In-app purchases', 'Cryptocurrency transactions', 'Billing'],
            'apis': ['/payments', '/transactions']
        }
    }

# 服務間通信設計
class ServiceCommunication:
    """服務間通信管理"""
    
    # 同步通信（REST API）
    SYNC_COMMUNICATION = {
        'user_authentication': {
            'from': 'character-service',
            'to': 'user-service',
            'method': 'GET /users/{user_id}/verify',
            'timeout': 5000,  # 5秒
            'circuit_breaker': True
        },
        
        'character_validation': {
            'from': 'battle-service',
            'to': 'character-service',
            'method': 'POST /characters/validate',
            'timeout': 3000,
            'circuit_breaker': True
        }
    }
    
    # 異步通信（Message Queue）
    ASYNC_COMMUNICATION = {
        'battle_completed': {
            'publisher': 'battle-service',
            'subscribers': ['ladder-service', 'analytics-service', 'notification-service'],
            'message_format': {
                'event_type': 'battle_completed',
                'battle_id': 'uuid',
                'winner_id': 'uuid',
                'timestamp': 'iso_datetime'
            }
        },
        
        'character_created': {
            'publisher': 'character-service',
            'subscribers': ['analytics-service', 'notification-service'],
            'message_format': {
                'event_type': 'character_created',
                'character_id': 'uuid',
                'user_id': 'uuid',
                'rarity': 'integer'
            }
        }
    }
```

#### 11.3.2 API Gateway設計
```python
# API Gateway配置
class APIGateway:
    """API網關設計"""
    
    ROUTING_CONFIG = {
        # 路由規則
        'routes': [
            {
                'path': '/api/auth/*',
                'service': 'user-service',
                'load_balancer': 'round_robin',
                'timeout': 10000,
                'retry': 3
            },
            {
                'path': '/api/characters/*',
                'service': 'character-service',
                'load_balancer': 'least_connections',
                'timeout': 15000,
                'retry': 2
            },
            {
                'path': '/api/battles/*',
                'service': 'battle-service',
                'load_balancer': 'weighted_round_robin',
                'timeout': 30000,  # 戰鬥生成可能需要更長時間
                'retry': 1
            }
        ],
        
        # 中間件配置
        'middleware': [
            'rate_limiting',      # 速率限制
            'authentication',     # 認證
            'authorization',      # 授權
            'request_logging',    # 請求日誌
            'response_caching',   # 響應緩存
            'circuit_breaker'     # 熔斷器
        ],
        
        # 安全配置
        'security': {
            'cors': {
                'allowed_origins': ['https://yourdomain.com'],
                'allowed_methods': ['GET', 'POST', 'PUT', 'DELETE'],
                'allowed_headers': ['Content-Type', 'Authorization']
            },
            'rate_limiting': {
                'requests_per_minute': 1000,
                'burst_size': 100
            }
        }
    }

# 服務發現配置
class ServiceDiscovery:
    """服務發現機制"""
    
    def __init__(self):
        self.consul_client = consul.Consul(
            host=os.getenv('CONSUL_HOST', 'localhost'),
            port=int(os.getenv('CONSUL_PORT', 8500))
        )
    
    def register_service(self, service_name, service_id, address, port):
        """註冊服務到服務發現"""
        self.consul_client.agent.service.register(
            name=service_name,
            service_id=service_id,
            address=address,
            port=port,
            check=consul.Check.http(
                url=f"http://{address}:{port}/health",
                interval="30s",
                timeout="10s"
            )
        )
    
    def discover_service(self, service_name):
        """發現服務實例"""
        _, services = self.consul_client.health.service(
            service_name, 
            passing=True
        )
        
        if not services:
            raise ServiceUnavailableError(f"No healthy instances of {service_name}")
        
        # 簡單的負載均衡
        service = random.choice(services)
        return {
            'address': service['Service']['Address'],
            'port': service['Service']['Port']
        }
```

---

## 總結

本文檔詳細描述了 AI Hero Battle 後端系統的完整架構設計，包括：

### 🎯 核心特點
- **分散式AI節點架構**：實現高可用的AI戰鬥生成系統
- **微服務友好設計**：支援未來的服務拆分和獨立擴展
- **多層安全防護**：從認證到數據加密的全方位安全保護
- **智能緩存策略**：多層緩存提升系統響應性能
- **完整監控體系**：從應用到基礎設施的全棧監控

### 🚀 技術亮點
- **最小改動原則**：保持現有架構穩定，平滑升級到分散式
- **共識機制**：多節點投票確保AI生成結果的一致性和可靠性
- **容錯設計**：多層回退機制確保系統高可用性
- **水平擴展**：支援動態添加節點和服務實例

### 📈 擴展能力
- **數據庫分片**：支援大規模用戶數據的水平擴展
- **服務拆分**：為未來微服務化奠定基礎
- **多雲部署**：支援Kubernetes和Docker的靈活部署

這個架構設計不僅滿足當前的業務需求，更為未來的技術演進和業務擴展預留了充分的空間。通過分散式AI節點系統，實現了在保持現有系統穩定性的同時，大幅提升系統的可靠性和擴展性。