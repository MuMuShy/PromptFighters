from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CharacterViewSet, BattleViewSet, PlayerProfileView, SocialLoginView, LeaderboardView, Web3LoginView, Web3NonceView, health_check, PlayerResourceView, SpendResourceView

router = DefaultRouter()
router.register(r'characters', CharacterViewSet, basename='character')
router.register(r'battles', BattleViewSet, basename='battle')

urlpatterns = [
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('social-login/', SocialLoginView.as_view(), name='social-login'),
    path('player/resources/', PlayerResourceView.as_view(), name='player-resources'),
    path('player/spend/', SpendResourceView.as_view(), name='spend-resources'),
    path('', include(router.urls)),
    path('health/', health_check, name='health_check'),
    path('characters/advanced_summon/', CharacterViewSet.as_view({'post': 'advanced_summon'}), name='advanced_summon'),
    path('auth/web3-nonce/', Web3NonceView.as_view(), name='web3-nonce'),
    path('auth/web3-login/', Web3LoginView.as_view(), name='web3-login'),
    path('player/profile/', PlayerProfileView.as_view(), name='player-profile'),
]  