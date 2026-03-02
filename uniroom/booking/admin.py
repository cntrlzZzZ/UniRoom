from django.contrib import admin
from .models import Room, Booking, Attendee


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "capacity", "location", "equipment")
    search_fields = ("name", "location", "equipment")
    list_filter = ("capacity",)


class AttendeeInline(admin.TabularInline):
    model = Attendee
    extra = 1


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("room", "start", "end", "owner_email", "owner_student_id", "created_at")
    list_filter = ("room",)
    search_fields = ("owner_email", "owner_student_id", "room__name")
    inlines = [AttendeeInline]