from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CharacterViewSet, BattleViewSet, SocialLoginView, LeaderboardView, health_check

router = DefaultRouter()
router.register(r'characters', CharacterViewSet, basename='character')
router.register(r'battles', BattleViewSet, basename='battle')

urlpatterns = [
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('social-login/', SocialLoginView.as_view(), name='social-login'),
    path('', include(router.urls)),
    path('health/', health_check, name='health_check'),
    path('characters/advanced_summon/', CharacterViewSet.as_view({'post': 'advanced_summon'}), name='advanced_summon'),
]  