#!/usr/bin/env python
"""
Django 管理命令：將本地圖片遷移到雲端儲存
用法：python manage.py migrate_images_to_cloud
"""

from django.core.management.base import BaseCommand
from django.conf import settings
from game.models import Character
from game.storage_service import get_cloud_storage
import os


class Command(BaseCommand):
    help = '掃描所有角色，將本地 /media/ 路徑的圖片上傳到雲端並更新 URL'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='僅顯示將要遷移的角色，不實際上傳'
        )
        parser.add_argument(
            '--character-id',
            type=str,
            help='只遷移指定角色 ID'
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        character_id = options.get('character_id')
        
        # 獲取雲端儲存服務
        cloud_storage = get_cloud_storage()
        
        if not cloud_storage.enabled:
            self.stdout.write(
                self.style.ERROR('❌ 雲端儲存未配置！請檢查環境變數：S3_BUCKET_NAME, S3_ACCESS_KEY, S3_SECRET_KEY')
            )
            return
        
        self.stdout.write(self.style.SUCCESS('✅ 雲端儲存已配置'))
        
        # 查詢需要遷移的角色
        if character_id:
            characters = Character.objects.filter(id=character_id)
        else:
            characters = Character.objects.filter(image_url__startswith='/media/')
        
        total = characters.count()
        self.stdout.write(f'\n📊 找到 {total} 個需要遷移的角色\n')
        
        if total == 0:
            self.stdout.write(self.style.WARNING('⚠️ 沒有找到需要遷移的角色'))
            return
        
        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN 模式：只顯示，不實際上傳\n'))
        
        success_count = 0
        error_count = 0
        skip_count = 0
        
        for i, char in enumerate(characters, 1):
            self.stdout.write(f'[{i}/{total}] 處理角色: {char.name} (ID: {char.id})')
            
            # 檢查 image_url 是否以 /media/ 開頭
            if not char.image_url or not char.image_url.startswith('/media/'):
                self.stdout.write(self.style.WARNING(f'  ⚠️ 跳過：URL 不是本地路徑: {char.image_url}'))
                skip_count += 1
                continue
            
            # 提取文件名（例如：character_xxx.png）
            filename = char.image_url.replace('/media/', '')
            
            # 構建本地文件路徑
            local_path = os.path.join(settings.MEDIA_ROOT, filename)
            
            # 檢查文件是否存在
            if not os.path.exists(local_path):
                self.stdout.write(self.style.ERROR(f'  ❌ 文件不存在: {local_path}'))
                error_count += 1
                continue
            
            # 讀取文件
            try:
                with open(local_path, 'rb') as f:
                    image_data = f.read()
                
                file_size = len(image_data)
                self.stdout.write(f'  📁 本地文件大小: {file_size:,} bytes')
                
                if dry_run:
                    self.stdout.write(f'  🔍 [DRY RUN] 將會上傳: {filename}')
                    continue
                
                # 確定文件類型
                content_type = 'image/png'
                if filename.endswith('.jpg') or filename.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif filename.endswith('.gif'):
                    content_type = 'image/gif'
                elif filename.endswith('.webp'):
                    content_type = 'image/webp'
                
                # 使用角色 ID 作為文件名（如 tasks.py 中的邏輯）
                cloud_filename = f"character_{char.id}.png"
                
                # 上傳到雲端
                self.stdout.write(f'  ☁️ 上傳到雲端: {cloud_filename}...')
                cloud_url = cloud_storage.upload_file(
                    file_data=image_data,
                    file_name=cloud_filename,
                    content_type=content_type
                )
                
                if cloud_url:
                    # 更新角色的 image_url
                    old_url = char.image_url
                    char.image_url = cloud_url
                    char.save()
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  ✅ 成功！\n'
                            f'     舊 URL: {old_url}\n'
                            f'     新 URL: {cloud_url}'
                        )
                    )
                    success_count += 1
                else:
                    self.stdout.write(self.style.ERROR('  ❌ 上傳失敗'))
                    error_count += 1
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ 處理失敗: {str(e)}')
                )
                error_count += 1
        
        # 總結
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS(f'✅ 成功: {success_count}'))
        self.stdout.write(self.style.WARNING(f'⚠️ 跳過: {skip_count}'))
        self.stdout.write(self.style.ERROR(f'❌ 失敗: {error_count}'))
        self.stdout.write('='*60)

