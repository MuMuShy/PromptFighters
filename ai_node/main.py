# AI Node FastAPI Service
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
import os
import asyncio
import aiohttp
import time
import uuid
import random
from datetime import datetime
import logging
from google import genai
from google.genai import types

# Configure logging
import os
from datetime import datetime

# Create logs directory if it doesn't exist
log_dir = "/app/logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# Use node name in log filename for multiple instances
node_name = os.getenv('NODE_NAME', 'ai-node')
log_filename = f"{log_dir}/{node_name}_{datetime.now().strftime('%Y%m%d')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_filename, encoding='utf-8'),
        logging.StreamHandler()  # Keep console output
    ]
)
logger = logging.getLogger(__name__)

# Global variables
heartbeat_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    global heartbeat_task, NODE_ID
    
    # Startup
    logger.info(f"Starting AI Node: {NODE_NAME} (ID: {NODE_ID})")
    logger.info(f"Aggregator URL: {AGGREGATOR_URL}")
    
    # Register with aggregator
    if AGGREGATOR_URL:
        registered_id = await register_with_aggregator()
        if registered_id:
            NODE_ID = registered_id
            logger.info(f"Node registered with ID: {NODE_ID}")
        
        # Start heartbeat loop
        heartbeat_task = asyncio.create_task(heartbeat_loop())
    
    logger.info("AI Node started successfully")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down AI Node: {NODE_NAME}")
    if heartbeat_task:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="AI Battle Node",
    description="Distributed AI node for generating battle results",
    version="1.0.0",
    lifespan=lifespan
)

# Security
security = HTTPBearer(auto_error=False)

# Configuration from environment
NODE_ID = os.getenv('NODE_ID', str(uuid.uuid4()))
NODE_NAME = os.getenv('NODE_NAME', f'node-{NODE_ID[:8]}')
AGGREGATOR_URL = os.getenv('AGGREGATOR_URL', 'http://localhost:8000')
NODE_API_KEY = os.getenv('NODE_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
HEARTBEAT_INTERVAL = int(os.getenv('HEARTBEAT_INTERVAL', '60'))  # seconds

# Node state
current_requests = 0
max_concurrent_requests = int(os.getenv('MAX_CONCURRENT_REQUESTS', '5'))

# Pydantic models matching the main server
class BattleLogEntry(BaseModel):
    attacker: str
    defender: str
    action: str
    damage: int
    description: str
    remaining_hp: int

class BattleResult(BaseModel):
    winner: str
    battle_log: List[BattleLogEntry]
    battle_description: str

class BattleRequest(BaseModel):
    battle_id: str
    prompt: str
    seed: Optional[int] = None

class NodeRegistration(BaseModel):
    name: str
    url: str
    api_key: Optional[str] = None
    weight: int = 1
    max_concurrent_requests: int = 5

class HeartbeatData(BaseModel):
    node_id: str
    current_requests: int = 0


def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API key if configured"""
    if NODE_API_KEY and credentials:
        if credentials.credentials != NODE_API_KEY:
            raise HTTPException(status_code=401, detail="Invalid API key")
    return credentials


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "node_id": NODE_ID,
        "node_name": NODE_NAME,
        "current_requests": current_requests,
        "max_concurrent_requests": max_concurrent_requests,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/generate_battle", response_model=BattleResult)
async def generate_battle(
    request: BattleRequest,
    credentials: HTTPAuthorizationCredentials = Depends(verify_api_key)
):
    """Generate battle result using Gemini API"""
    global current_requests
    
    # Check concurrent request limit
    if current_requests >= max_concurrent_requests:
        raise HTTPException(
            status_code=503, 
            detail=f"Node at capacity ({current_requests}/{max_concurrent_requests})"
        )
    
    current_requests += 1
    start_time = time.time()
    
    try:
        logger.info(f"=== 開始生成戰鬥 ===")
        logger.info(f"戰鬥ID: {request.battle_id}")
        logger.info(f"種子值: {request.seed}")
        logger.info(f"Prompt長度: {len(request.prompt)} 字符")
        logger.info(f"當前並發請求: {current_requests}/{max_concurrent_requests}")
        
        # Initialize Gemini client
        if not GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY 未配置")
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
        
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Set random seed for reproducibility if provided
        if request.seed:
            random.seed(request.seed)
            logger.info(f"設置隨機種子: {request.seed}")
        
        logger.info("開始調用 Gemini API...")
        
        # Generate battle result using structured output
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=request.prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": BattleResult,
            }
        )
        
        if not response.parsed:
            logger.error("Gemini API 返回結果解析失敗")
            raise HTTPException(status_code=500, detail="Failed to parse battle result from Gemini API")
        
        battle_result = response.parsed
        
        # Log processing time and result
        processing_time = time.time() - start_time
        logger.info(f"=== 戰鬥生成完成 ===")
        logger.info(f"處理時間: {processing_time:.2f}秒")
        logger.info(f"獲勝者: {battle_result.winner}")
        logger.info(f"戰鬥回合數: {len(battle_result.battle_log)}")
        logger.info(f"戰鬥描述長度: {len(battle_result.battle_description)} 字符")
        logger.info(f"戰鬥結果: {battle_result}")
        
        return battle_result
        
    except Exception as e:
        logger.error(f"Error generating battle {request.battle_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Battle generation failed: {str(e)}")
    
    finally:
        current_requests -= 1


@app.get("/stats")
async def get_node_stats(credentials: HTTPAuthorizationCredentials = Depends(verify_api_key)):
    """Get node statistics"""
    return {
        "node_id": NODE_ID,
        "node_name": NODE_NAME,
        "current_requests": current_requests,
        "max_concurrent_requests": max_concurrent_requests,
        "uptime": time.time() - start_time_global,
        "aggregator_url": AGGREGATOR_URL
    }


# Global variable to track startup time
start_time_global = time.time()


def get_public_ip():
    """Get public IP address"""
    try:
        import requests
        response = requests.get('https://api.ipify.org?format=text', timeout=5)
        return response.text.strip()
    except:
        return None

def get_local_ip():
    """Get local network IP address"""
    try:
        import socket
        # Connect to a remote address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return None

def detect_node_url():
    """Auto-detect the correct URL for this node"""
    node_port = os.getenv('NODE_PORT', '8001')
    
    # Priority order for determining external host:
    # 1. Explicit configuration
    # 2. Public IP (for production)
    # 3. Local network IP
    # 4. Docker host (for local development)
    # 5. localhost (fallback)
    
    node_external_host = os.getenv('NODE_EXTERNAL_HOST')
    
    if node_external_host:
        # Explicitly configured - highest priority
        node_host = node_external_host
        logger.info(f"Using configured external host: {node_host}")
    else:
        # Auto-detect based on environment
        deployment_mode = os.getenv('DEPLOYMENT_MODE', 'auto')
        
        if deployment_mode == 'production':
            # Production mode - try to get public IP
            public_ip = get_public_ip()
            if public_ip:
                node_host = public_ip
                logger.info(f"Production mode: Using public IP: {node_host}")
            else:
                # Fallback to local IP
                local_ip = get_local_ip()
                node_host = local_ip if local_ip else 'localhost'
                logger.warning(f"Could not get public IP, using local IP: {node_host}")
        
        elif deployment_mode == 'local':
            # Local development mode
            if os.path.exists('/.dockerenv'):
                node_host = 'host.docker.internal'
                logger.info(f"Local Docker mode: Using host.docker.internal")
            else:
                node_host = 'localhost'
                logger.info(f"Local native mode: Using localhost")
        
        else:
            # Auto-detect mode
            if os.getenv('NODE_EXTERNAL_HOST'):
                node_host = os.getenv('NODE_EXTERNAL_HOST')
            elif os.path.exists('/.dockerenv'):
                # In Docker - check if we can reach host.docker.internal
                try:
                    import socket
                    socket.gethostbyname('host.docker.internal')
                    node_host = 'host.docker.internal'
                    logger.info(f"Auto-detect: Using host.docker.internal")
                except:
                    # host.docker.internal not available, try local IP
                    local_ip = get_local_ip()
                    node_host = local_ip if local_ip else 'localhost'
                    logger.info(f"Auto-detect: host.docker.internal unavailable, using {node_host}")
            else:
                # Not in Docker
                local_ip = get_local_ip()
                node_host = local_ip if local_ip else 'localhost'
                logger.info(f"Auto-detect: Native mode, using {node_host}")
    
    return f"http://{node_host}:{node_port}"

async def register_with_aggregator():
    """Register this node with the aggregator"""
    try:
        # Auto-detect the correct URL for this node
        node_url = detect_node_url()
        logger.info(f"Registering node with URL: {node_url}")
        
        registration_data = NodeRegistration(
            name=NODE_NAME,
            url=node_url,
            api_key=NODE_API_KEY,
            weight=int(os.getenv('NODE_WEIGHT', '1')),
            max_concurrent_requests=max_concurrent_requests
        )
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{AGGREGATOR_URL}/api/nodes/register/",
                json=registration_data.dict(),
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status in [200, 201]:
                    result = await response.json()
                    logger.info(f"✅ 節點註冊成功")
                    logger.info(f"註冊響應: {result}")
                    logger.info(f"分配的節點ID: {result.get('node_id')}")
                    return result.get('node_id')
                else:
                    error_text = await response.text()
                    logger.error(f"❌ 節點註冊失敗: HTTP {response.status}")
                    logger.error(f"錯誤詳情: {error_text}")
                    return None
                    
    except Exception as e:
        logger.error(f"Error registering with aggregator: {str(e)}")
        return None


async def send_heartbeat():
    """Send heartbeat to aggregator"""
    try:
        heartbeat_data = HeartbeatData(
            node_id=NODE_ID,
            current_requests=current_requests
        )
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{AGGREGATOR_URL}/api/nodes/heartbeat/",
                json=heartbeat_data.dict(),
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status == 200:
                    logger.debug("Heartbeat sent successfully")
                else:
                    logger.warning(f"Heartbeat failed: {response.status}")
                    
    except Exception as e:
        logger.error(f"Error sending heartbeat: {str(e)}")


async def heartbeat_loop():
    """Background task to send periodic heartbeats"""
    await asyncio.sleep(5)  # Wait a bit before starting heartbeats
    
    while True:
        await send_heartbeat()
        await asyncio.sleep(HEARTBEAT_INTERVAL)


# Startup and shutdown logic moved to lifespan context manager above


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('NODE_PORT', '8001'))
    # Always bind to 0.0.0.0 inside container to accept connections from any interface
    host = "0.0.0.0"
    
    # Get external URL for logging
    external_url = detect_node_url()
    logger.info(f"Starting AI Node on {host}:{port} (external URL: {external_url})")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )