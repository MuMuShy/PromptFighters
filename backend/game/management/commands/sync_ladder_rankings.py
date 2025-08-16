#!/usr/bin/env python
"""
Django 管理命令：同步天梯排名
用法：python manage.py sync_ladder_rankings
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from game.ladder_service import LadderService
from game.models import LadderSeason


class Command(BaseCommand):
    help = '同步所有活躍賽季的天梯排名，添加新角色並更新現有排名'

    def add_arguments(self, parser):
        parser.add_argument(
            '--season-id',
            type=str,
            help='指定賽季ID，如果不指定則同步所有活躍賽季'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='強制重新初始化排名（會清空現有排名）'
        )

    def handle(self, *args, **options):
        season_id = options.get('season_id')
        force = options.get('force')
        
        self.stdout.write(
            self.style.SUCCESS('開始同步天梯排名...')
        )
        
        if season_id:
            # 同步指定賽季
            try:
                season = LadderSeason.objects.get(id=season_id)
                if force:
                    # 強制重新初始化
                    self.stdout.write(f'強制重新初始化賽季: {season.name}')
                    # 清空現有排名
                    season.rankings.all().delete()
                    LadderService.initialize_season_rankings(season)
                else:
                    # 同步排名
                    LadderService.sync_season_rankings(season)
                
                self.stdout.write(
                    self.style.SUCCESS(f'賽季 {season.name} 排名同步完成')
                )
            except LadderSeason.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'賽季 {season_id} 不存在')
                )
        else:
            # 同步所有活躍賽季
            active_seasons = LadderSeason.objects.filter(is_active=True)
            
            if not active_seasons.exists():
                self.stdout.write(
                    self.style.WARNING('沒有找到活躍的賽季')
                )
                return
            
            for season in active_seasons:
                self.stdout.write(f'同步賽季: {season.name}')
                if force:
                    # 強制重新初始化
                    season.rankings.all().delete()
                    LadderService.initialize_season_rankings(season)
                else:
                    # 同步排名
                    LadderService.sync_season_rankings(season)
            
            self.stdout.write(
                self.style.SUCCESS(f'所有活躍賽季排名同步完成，共 {active_seasons.count()} 個賽季')
            )
        
        self.stdout.write(
            self.style.SUCCESS('天梯排名同步完成！')
        )
