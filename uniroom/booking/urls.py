from django.urls import path
from . import views
from . import api

urlpatterns = [
    path("", views.index, name="index"),

    # API
    path("api/rooms", api.rooms_list, name="api_rooms"),
    path("api/availability", api.availability_for_day, name="api_availability"),
    path("api/bookings", api.create_booking, name="api_create_booking"),
    path("api/my-bookings", api.my_bookings, name="api_my_bookings"),
    path("api/bookings/<int:booking_id>", api.cancel_booking, name="api_cancel_booking"),
    path("api/session/me", api.session_me, name="api_session_me"),
    path("api/session/login", api.session_login, name="api_session_login"),
    path("api/session/logout", api.session_logout, name="api_session_logout"),
]