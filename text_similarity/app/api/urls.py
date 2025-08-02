from django.urls import path
from . import views

urlpatterns = [
    path('save_session/', views.save_session, name='save_session'),
    path('get_session_data/', views.get_session_data, name='get_session_data'),
    path('get_similarity/', views.get_similarity, name='get_similarity'),
    path('get_session_id/', views.get_session_id, name='get_session_id'),
    path(
        'generate_search_intents/',
        views.generate_search_intents,
        name='generate_search_intents',
    ),
]
