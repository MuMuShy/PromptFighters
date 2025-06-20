from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CharacterViewSet, SocialLoginView

router = DefaultRouter()
router.register(r'characters', CharacterViewSet, basename='character')

urlpatterns = [
    path('', include(router.urls)),
    path('social-login/', SocialLoginView.as_view(), name='social-login'),
] 