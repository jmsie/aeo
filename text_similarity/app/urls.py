from django.urls import path, include
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('text_similarity/', views.text_similarity, name='text_similarity'),
    path('api/', include('app.api.urls')),
    path('query_based_text_optimize/', views.query_based_text_optimize, name='query_based_text_optimize'),
]
