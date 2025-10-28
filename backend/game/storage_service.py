"""
雲端儲存服務 - 支援 AWS S3 和 Cloudflare R2
"""
import os
import boto3
from botocore.exceptions import ClientError
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class CloudStorageService:
    """
    雲端儲存服務，支援 S3 兼容的儲存（AWS S3, Cloudflare R2）
    """
    
    def __init__(self):
        self.enabled = self._check_config()
        if self.enabled:
            self.s3_client = self._init_s3_client()
            self.bucket_name = os.getenv('S3_BUCKET_NAME')
            self.cdn_url = os.getenv('CDN_URL', '')  # Cloudflare R2 公開 URL 或 CloudFront URL
    
    def _check_config(self) -> bool:
        """檢查雲端儲存是否已配置"""
        required_vars = ['S3_BUCKET_NAME', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']
        return all(os.getenv(var) for var in required_vars)
    
    def _init_s3_client(self):
        """初始化 S3 客戶端"""
        endpoint_url = os.getenv('S3_ENDPOINT_URL')  # Cloudflare R2 需要自定義端點
        
        config = {
            'aws_access_key_id': os.getenv('S3_ACCESS_KEY'),
            'aws_secret_access_key': os.getenv('S3_SECRET_KEY'),
        }
        
        # 如果有自定義端點（例如 Cloudflare R2）
        if endpoint_url:
            config['endpoint_url'] = endpoint_url
        else:
            # AWS S3 需要指定區域
            config['region_name'] = os.getenv('S3_REGION', 'us-east-1')
        
        return boto3.client('s3', **config)
    
    def upload_file(self, file_data: bytes, file_name: str, content_type: str = 'image/png') -> str:
        """
        上傳檔案到雲端儲存
        
        Args:
            file_data: 檔案的二進制數據
            file_name: 檔案名稱（例如 'character_uuid.png'）
            content_type: 檔案 MIME 類型
        
        Returns:
            檔案的公開 URL
        """
        if not self.enabled:
            logger.warning("雲端儲存未配置，無法上傳檔案")
            return None
        
        try:
            # 上傳到 S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_name,
                Body=file_data,
                ContentType=content_type,
                CacheControl='public, max-age=31536000',  # 快取 1 年
            )
            
            # 返回公開 URL
            if self.cdn_url:
                # 使用自定義 CDN URL（Cloudflare R2 公開域名或 CloudFront）
                return f"{self.cdn_url.rstrip('/')}/{file_name}"
            else:
                # 使用 S3 預設 URL
                region = os.getenv('S3_REGION', 'us-east-1')
                return f"https://{self.bucket_name}.s3.{region}.amazonaws.com/{file_name}"
        
        except ClientError as e:
            logger.error(f"上傳檔案到雲端失敗: {e}")
            return None
    
    def delete_file(self, file_name: str) -> bool:
        """
        從雲端儲存刪除檔案
        
        Args:
            file_name: 檔案名稱
        
        Returns:
            是否成功刪除
        """
        if not self.enabled:
            return False
        
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_name
            )
            logger.info(f"成功刪除雲端檔案: {file_name}")
            return True
        except ClientError as e:
            logger.error(f"刪除雲端檔案失敗: {e}")
            return False
    
    def file_exists(self, file_name: str) -> bool:
        """
        檢查檔案是否存在於雲端儲存
        
        Args:
            file_name: 檔案名稱
        
        Returns:
            檔案是否存在
        """
        if not self.enabled:
            return False
        
        try:
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=file_name
            )
            return True
        except ClientError:
            return False


# 單例模式
_cloud_storage_instance = None

def get_cloud_storage() -> CloudStorageService:
    """獲取雲端儲存服務單例"""
    global _cloud_storage_instance
    if _cloud_storage_instance is None:
        _cloud_storage_instance = CloudStorageService()
    return _cloud_storage_instance

