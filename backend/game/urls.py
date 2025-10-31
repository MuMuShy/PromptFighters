from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CharacterViewSet, BattleViewSet, PlayerProfileView, SocialLoginView, 
    LeaderboardView, Web3LoginView, Web3NonceView, health_check, 
    PlayerResourceView, SpendResourceView, DailyQuestView, CheckInView, QuestProgressView,
    CharacterGrowthAPIView, mint_character_nft, verify_character_ownership, proxy_image
)
from .betting_views import (
    get_ladder_rankings, get_upcoming_battles, get_current_betting_battle,
    place_bet, get_my_bets, get_betting_stats, get_battle_details, join_ladder,
    get_battle_history, get_battle_onchain, get_player_recent_onchain, get_character_onchain_history
)
from .node_views import (
    register_node, node_heartbeat, list_nodes, health_check_all, 
    remove_node, update_node
)

router = DefaultRouter()
router.register(r'characters', CharacterViewSet, basename='character')
router.register(r'battles', BattleViewSet, basename='battle')

urlpatterns = [
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('social-login/', SocialLoginView.as_view(), name='social-login'),
    path('player/resources/', PlayerResourceView.as_view(), name='player-resources'),
    path('player/spend/', SpendResourceView.as_view(), name='spend-resources'),
    path('daily-quests/', DailyQuestView.as_view(), name='daily-quests'),
    path('checkin/', CheckInView.as_view(), name='checkin'),
    path('quest-progress/', QuestProgressView.as_view(), name='quest-progress'),
    
    # NFT 功能（必須在 character-growth 之前）
    path('characters/<uuid:character_id>/mint/', mint_character_nft, name='mint-character-nft'),
    path('characters/<uuid:character_id>/verify-ownership/', verify_character_ownership, name='verify-character-ownership'),
    
    path('characters/<uuid:character_id>/<str:action>/', CharacterGrowthAPIView.as_view(), name='character-growth'),
    path('', include(router.urls)),
    path('health/', health_check, name='health_check'),
    path('characters/advanced_summon/', CharacterViewSet.as_view({'post': 'advanced_summon'}), name='advanced_summon'),
    path('auth/web3-nonce/', Web3NonceView.as_view(), name='web3-nonce'),
    path('auth/web3-login/', Web3LoginView.as_view(), name='web3-login'),
    path('player/profile/', PlayerProfileView.as_view(), name='player-profile'),
    
    # 天梯下注系統
    path('ladder/rankings/', get_ladder_rankings, name='ladder-rankings'),
    path('ladder/battles/upcoming/', get_upcoming_battles, name='upcoming-battles'),
    path('ladder/battles/current/', get_current_betting_battle, name='current-betting-battle'),
    path('ladder/battles/<uuid:battle_id>/', get_battle_details, name='battle-details'),
    path('ladder/bet/', place_bet, name='place-bet'),
    path('ladder/my-bets/', get_my_bets, name='my-bets'),
    path('ladder/stats/', get_betting_stats, name='betting-stats'),
    path('ladder/join/', join_ladder, name='join-ladder'),
    path('ladder/battles/history/', get_battle_history, name='battle-history'),
    # On-chain 查詢
    path('battles/<uuid:battle_id>/onchain/', get_battle_onchain, name='battle-onchain'),
    path('player/onchain/recent/', get_player_recent_onchain, name='player-recent-onchain'),
    path('characters/<uuid:character_id>/onchain/history/', get_character_onchain_history, name='character-onchain-history'),
    
    # AI節點管理
    path('nodes/register/', register_node, name='register-node'),
    path('nodes/heartbeat/', node_heartbeat, name='node-heartbeat'),
    path('nodes/', list_nodes, name='list-nodes'),
    path('nodes/health-check/', health_check_all, name='health-check-all'),
    path('nodes/<uuid:node_id>/', update_node, name='update-node'),
    path('nodes/<uuid:node_id>/remove/', remove_node, name='remove-node'),
    
    # 圖片代理（用於分享功能，解決 CORS 問題）
    path('proxy-image/', proxy_image, name='proxy-image'),
]  