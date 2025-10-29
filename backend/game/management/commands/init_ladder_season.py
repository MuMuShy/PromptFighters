#!/usr/bin/env python
"""
Django 管理命令：初始化天梯賽季
用法：python manage.py init_ladder_season --name "Season 1" --start-date "2024-01-01" --end-date "2024-12-31"
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from game.ladder_service import LadderService
from game.models import LadderSeason


class Command(BaseCommand):
    help = '創建一個新的天梯賽季並初始化排名'

    def add_arguments(self, parser):
        parser.add_argument(
            '--name',
            type=str,
            default=None,
            help='賽季名稱（例如：Season 1）'
        )
        parser.add_argument(
            '--start-date',
            type=str,
            default=None,
            help='開始日期 (格式: YYYY-MM-DD，默認為今天)'
        )
        parser.add_argument(
            '--end-date',
            type=str,
            default=None,
            help='結束日期 (格式: YYYY-MM-DD，默認為開始日期後30天)'
        )
        parser.add_argument(
            '--prize-pool',
            type=int,
            default=100000,
            help='獎池金額（默認: 100000）'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='強制創建新賽季，即使已有活躍賽季'
        )

    def handle(self, *args, **options):
        name = options.get('name')
        start_date_str = options.get('start_date')
        end_date_str = options.get('end_date')
        prize_pool = options.get('prize_pool', 100000)
        force = options.get('force', False)
        
        # 檢查是否已有活躍賽季
        existing_season = LadderSeason.objects.filter(is_active=True).first()
        if existing_season and not force:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠️  已有活躍賽季: {existing_season.name} (ID: {existing_season.id})\n'
                    f'   開始日期: {existing_season.start_date}\n'
                    f'   結束日期: {existing_season.end_date}\n'
                    f'   使用 --force 參數可以強制創建新賽季'
                )
            )
            return
        
        # 處理日期
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').replace(tzinfo=timezone.get_current_timezone())
            except ValueError:
                self.stdout.write(
                    self.style.ERROR('❌ 日期格式錯誤，請使用 YYYY-MM-DD 格式')
                )
                return
        else:
            start_date = timezone.now()
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').replace(tzinfo=timezone.get_current_timezone())
            except ValueError:
                self.stdout.write(
                    self.style.ERROR('❌ 日期格式錯誤，請使用 YYYY-MM-DD 格式')
                )
                return
        else:
            end_date = start_date + timedelta(days=30)
        
        # 檢查日期邏輯
        if end_date <= start_date:
            self.stdout.write(
                self.style.ERROR('❌ 結束日期必須晚於開始日期')
            )
            return
        
        # 生成賽季名稱
        if not name:
            season_number = LadderSeason.objects.count() + 1
            name = f'Season {season_number}'
        
        # 如果已有活躍賽季且使用 force，先停用舊賽季
        if existing_season and force:
            self.stdout.write(
                self.style.WARNING(f'⚠️  停用現有活躍賽季: {existing_season.name}')
            )
            existing_season.is_active = False
            existing_season.save()
        
        # 創建賽季
        self.stdout.write(f'\n📅 創建賽季: {name}')
        self.stdout.write(f'   開始日期: {start_date.strftime("%Y-%m-%d %H:%M:%S")}')
        self.stdout.write(f'   結束日期: {end_date.strftime("%Y-%m-%d %H:%M:%S")}')
        self.stdout.write(f'   獎池: {prize_pool:,} 金幣\n')
        
        try:
            season = LadderService.create_season(
                name=name,
                start_date=start_date,
                end_date=end_date,
                prize_pool=prize_pool
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ 賽季創建成功！\n'
                    f'   賽季 ID: {season.id}\n'
                    f'   賽季名稱: {season.name}\n'
                    f'   活躍狀態: {season.is_active}'
                )
            )
            
            # 顯示排名統計
            from game.models import LadderRank
            ranking_count = LadderRank.objects.filter(season=season).count()
            self.stdout.write(f'\n📊 已初始化 {ranking_count} 個角色排名')
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 創建賽季失敗: {str(e)}')
            )
            import traceback
            traceback.print_exc()

