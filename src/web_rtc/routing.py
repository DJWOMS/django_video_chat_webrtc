from django.urls import path
from . import consumers


websocket_urlpatterns = [
    path('<str:user>', consumers.ConnectConsumer.as_asgi()),
    path('chat/<str:room_name>', consumers.ChatConsumer.as_asgi()),
]
