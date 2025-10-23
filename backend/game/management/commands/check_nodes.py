from django.core.management.base import BaseCommand
from game.tasks import check_node_health
from game.models import AINode
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = '手動檢查所有 AI 節點的健康狀態'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force-offline',
            action='store_true',
            help='強制將所有節點標記為離線',
        )
        parser.add_argument(
            '--show-status',
            action='store_true',
            help='只顯示節點狀態，不執行檢查',
        )

    def handle(self, *args, **options):
        if options['force_offline']:
            self.stdout.write('🔄 強制將所有節點標記為離線...')
            AINode.objects.all().update(status='offline')
            self.stdout.write(self.style.SUCCESS('✅ 所有節點已標記為離線'))
            return

        if options['show_status']:
            self.show_node_status()
            return

        self.stdout.write('🔍 開始手動節點健康檢查...')
        
        # 顯示檢查前的狀態
        self.stdout.write('\n📊 檢查前節點狀態:')
        self.show_node_status()
        
        # 執行健康檢查
        result = check_node_health()
        
        self.stdout.write(f'\n✅ 健康檢查完成: {result}')
        
        # 顯示檢查後的狀態
        self.stdout.write('\n📊 檢查後節點狀態:')
        self.show_node_status()

    def show_node_status(self):
        nodes = AINode.objects.all().order_by('name')
        
        if not nodes:
            self.stdout.write('❌ 沒有找到任何節點')
            return
            
        self.stdout.write(f'📋 共 {nodes.count()} 個節點:')
        
        for node in nodes:
            # 狀態顏色
            if node.status == 'online':
                status_color = self.style.SUCCESS
                status_icon = '🟢'
            elif node.status == 'offline':
                status_color = self.style.ERROR
                status_icon = '🔴'
            else:
                status_color = self.style.WARNING
                status_icon = '🟡'
            
            # 心跳信息
            if node.last_heartbeat:
                time_diff = timezone.now() - node.last_heartbeat
                heartbeat_info = f'最後心跳: {time_diff.total_seconds():.0f}秒前'
                
                # 如果超過5分鐘，標記為異常
                if time_diff > timedelta(minutes=5):
                    heartbeat_info = self.style.ERROR(f'{heartbeat_info} (超時)')
                else:
                    heartbeat_info = self.style.SUCCESS(heartbeat_info)
            else:
                heartbeat_info = self.style.ERROR('無心跳記錄')
            
            # 輸出節點信息
            self.stdout.write(
                f'  {status_icon} {node.name} ({node.url}) - '
                f'{status_color(node.status)} - {heartbeat_info}'
            )
            
            # 顯示統計信息
            if node.total_requests > 0:
                success_rate = (node.successful_requests / node.total_requests) * 100
                self.stdout.write(
                    f'    📈 請求統計: {node.successful_requests}/{node.total_requests} '
                    f'({success_rate:.1f}% 成功率)'
                )
