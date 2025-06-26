from django.core.management.base import BaseCommand
from game.daily_quest_service import DailyQuestService


class Command(BaseCommand):
    help = '初始化預設的每日任務'

    def handle(self, *args, **options):
        self.stdout.write('開始創建預設每日任務...')
        
        DailyQuestService.create_default_quests()
        
        self.stdout.write(
            self.style.SUCCESS('預設每日任務創建完成！')
        )