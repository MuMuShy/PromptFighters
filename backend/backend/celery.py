import os
from celery import Celery
from celery.schedules import crontab
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Celery Beat 調度配置 - 開發模式（快速間隔）
app.conf.beat_schedule = {
    # 每5分鐘排程新戰鬥（開發用）
    'schedule-battles-dev': {
        'task': 'game.tasks.schedule_hourly_battles',
        'schedule': 300.0,  # 每5分鐘執行
    },
    
    # 每10秒檢查是否需要開放下注
    'open-betting': {
        'task': 'game.tasks.open_betting',
        'schedule': 10.0,  # 每10秒執行
    },
    
    # 每10秒檢查是否需要關閉下注
    'close-betting': {
        'task': 'game.tasks.close_betting',
        'schedule': 10.0,  # 每10秒執行
    },
    
    # 每10秒檢查是否需要開始戰鬥
    'start-scheduled-battles': {
        'task': 'game.tasks.start_scheduled_battles',
        'schedule': 10.0,  # 每10秒執行
    },
    
    # 每10秒檢查已完成的戰鬥
    'check-completed-battles': {
        'task': 'game.tasks.check_completed_battles',
        'schedule': 10.0,  # 每10秒執行
    },
    
    # 每分鐘更新排名（開發用）
    'update-ladder-rankings': {
        'task': 'game.tasks.update_ladder_rankings',
        'schedule': 60.0,  # 每分鐘執行
    },
    
    # 每小時清理舊記錄（開發用）
    'cleanup-old-battles': {
        'task': 'game.tasks.cleanup_old_battles',
        'schedule': 3600.0,  # 每小時執行
    },
}

app.conf.timezone = 'Asia/Taipei' 