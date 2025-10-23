# Node management API views
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from .models import AINode
from .node_service import NodeHealthChecker
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])  # 節點註冊不需要用戶認證
def register_node(request):
    """節點註冊API"""
    try:
        data = request.data
        
        required_fields = ['name', 'url']
        for field in required_fields:
            if field not in data:
                return Response({
                    'error': f'Missing required field: {field}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # 檢查是否已存在相同URL的節點
        existing_node = AINode.objects.filter(url=data['url']).first()
        if existing_node:
            # 更新現有節點信息
            existing_node.name = data['name']
            existing_node.api_key = data.get('api_key', existing_node.api_key)
            existing_node.weight = data.get('weight', existing_node.weight)
            existing_node.max_concurrent_requests = data.get('max_concurrent_requests', existing_node.max_concurrent_requests)
            existing_node.update_heartbeat()
            existing_node.save()
            
            logger.info(f"Updated existing node: {existing_node.name}")
            return Response({
                'message': 'Node updated successfully',
                'node_id': str(existing_node.id),
                'status': existing_node.status
            })
        
        # 創建新節點
        node = AINode.objects.create(
            name=data['name'],
            url=data['url'],
            api_key=data.get('api_key'),
            weight=data.get('weight', 1),
            max_concurrent_requests=data.get('max_concurrent_requests', 5),
            status='online'
        )
        node.update_heartbeat()
        
        logger.info(f"Registered new node: {node.name}")
        return Response({
            'message': 'Node registered successfully',
            'node_id': str(node.id),
            'status': node.status
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error registering node: {str(e)}")
        return Response({
            'error': 'Registration failed',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def node_heartbeat(request):
    """節點心跳API"""
    try:
        data = request.data
        node_id = data.get('node_id')
        
        if not node_id:
            return Response({
                'error': 'node_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            node = AINode.objects.get(id=node_id)
        except AINode.DoesNotExist:
            return Response({
                'error': 'Node not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 更新心跳和狀態信息
        node.update_heartbeat()
        
        # 更新負載信息
        if 'current_requests' in data:
            node.current_requests = data['current_requests']
            node.save(update_fields=['current_requests'])
        
        return Response({
            'message': 'Heartbeat received',
            'status': node.status,
            'last_heartbeat': node.last_heartbeat
        })
        
    except Exception as e:
        logger.error(f"Error processing heartbeat: {str(e)}")
        return Response({
            'error': 'Heartbeat failed',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])  # 需要管理員權限查看節點狀態
def list_nodes(request):
    """列出所有節點狀態"""
    try:
        nodes = AINode.objects.all().order_by('-last_heartbeat')
        
        nodes_data = []
        for node in nodes:
            nodes_data.append({
                'id': str(node.id),
                'name': node.name,
                'url': node.url,
                'status': node.status,
                'is_online': node.is_online,
                'is_available': node.is_available,
                'last_heartbeat': node.last_heartbeat,
                'total_requests': node.total_requests,
                'successful_requests': node.successful_requests,
                'success_rate': node.success_rate,
                'avg_response_time': node.avg_response_time,
                'weight': node.weight,
                'current_requests': node.current_requests,
                'max_concurrent_requests': node.max_concurrent_requests,
                'created_at': node.created_at
            })
        
        return Response({
            'nodes': nodes_data,
            'total_nodes': len(nodes_data),
            'online_nodes': sum(1 for node in nodes if node.is_online)
        })
        
    except Exception as e:
        logger.error(f"Error listing nodes: {str(e)}")
        return Response({
            'error': 'Failed to list nodes',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def health_check_all(request):
    """觸發所有節點健康檢查"""
    try:
        # 使用同步的健康檢查任務
        from .tasks import check_node_health
        result = check_node_health()
        
        # 獲取當前節點狀態
        from .models import AINode
        nodes = AINode.objects.all()
        online_count = nodes.filter(status='online').count()
        offline_count = nodes.filter(status='offline').count()
        
        return Response({
            'message': 'Health check completed',
            'result': result,
            'online_nodes': online_count,
            'offline_nodes': offline_count,
            'total_nodes': nodes.count()
        })
        
    except Exception as e:
        logger.error(f"Error in health check: {str(e)}")
        return Response({
            'error': 'Health check failed',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_node(request, node_id):
    """移除節點"""
    try:
        node = AINode.objects.get(id=node_id)
        node_name = node.name
        node.delete()
        
        logger.info(f"Removed node: {node_name}")
        return Response({
            'message': f'Node {node_name} removed successfully'
        })
        
    except AINode.DoesNotExist:
        return Response({
            'error': 'Node not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error removing node: {str(e)}")
        return Response({
            'error': 'Failed to remove node',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_node(request, node_id):
    """更新節點配置"""
    try:
        node = AINode.objects.get(id=node_id)
        data = request.data
        
        # 允許更新的字段
        updatable_fields = ['name', 'weight', 'max_concurrent_requests', 'status']
        
        for field in updatable_fields:
            if field in data:
                setattr(node, field, data[field])
        
        node.save()
        
        logger.info(f"Updated node: {node.name}")
        return Response({
            'message': 'Node updated successfully',
            'node': {
                'id': str(node.id),
                'name': node.name,
                'status': node.status,
                'weight': node.weight,
                'max_concurrent_requests': node.max_concurrent_requests
            }
        })
        
    except AINode.DoesNotExist:
        return Response({
            'error': 'Node not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error updating node: {str(e)}")
        return Response({
            'error': 'Failed to update node',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)