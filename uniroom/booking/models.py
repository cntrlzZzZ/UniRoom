from django.db import models


class Room(models.Model):
    name = models.CharField(max_length=100, unique=True)
    capacity = models.PositiveIntegerField()
    location = models.CharField(max_length=200, blank=True)
    equipment = models.CharField(max_length=300, blank=True)

    def equipment_list(self):
        if not self.equipment:
            return []
        return [e.strip() for e in self.equipment.split(",") if e.strip()]

    def __str__(self) -> str:
        return self.name


class Booking(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="bookings")
    start = models.DateTimeField()
    end = models.DateTimeField()

    owner_email = models.EmailField()
    owner_student_id = models.CharField(max_length=32)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["room", "start", "end"]),
        ]
        ordering = ["start"]

    def __str__(self) -> str:
        return f"{self.room.name}: {self.start}–{self.end}"


class Attendee(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="attendees")
    email = models.EmailField()

    def __str__(self) -> str:
        return f"{self.email} ({self.booking.room.name})"