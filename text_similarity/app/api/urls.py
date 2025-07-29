from django.urls import path
from . import views

urlpatterns = [
    path('get_similarity/', views.get_similarity, name='get_similarity'),
]
