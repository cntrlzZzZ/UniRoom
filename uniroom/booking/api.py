import json
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from datetime import datetime, time
from django.http import JsonResponse, HttpResponseBadRequest
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_GET
from django.utils.timezone import make_aware
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from .models import Room, Booking, Attendee


@require_GET
def rooms_list(request):
    rooms = Room.objects.all().order_by("name")
    data = [
        {
            "id": r.id,
            "name": r.name,
            "capacity": r.capacity,
            "location": r.location,
            "equipment": r.equipment_list(),
        }
        for r in rooms
    ]
    return JsonResponse({"rooms": data})


@require_GET
def availability_for_day(request):
    """
    Returns bookings for a given date grouped by room.
    Query: ?date=YYYY-MM-DD
    """
    date_str = request.GET.get("date")
    if not date_str:
        return HttpResponseBadRequest("Missing ?date=YYYY-MM-DD")

    d = parse_date(date_str)
    if not d:
        return HttpResponseBadRequest("Invalid date format. Use YYYY-MM-DD")

    # Day boundaries in local timezone (good enough for now)
    start_dt = make_aware(datetime.combine(d, time.min))
    end_dt = make_aware(datetime.combine(d, time.max))

    bookings = (
        Booking.objects
        .select_related("room")
        .filter(start__lt=end_dt, end__gt=start_dt)
        .order_by("room__name", "start")
    )

    by_room = {}
    for b in bookings:
        by_room.setdefault(str(b.room_id), []).append({
            "id": b.id,
            "start": b.start.isoformat(),
            "end": b.end.isoformat(),
            "owner_email": b.owner_email,
        })

    return JsonResponse({
        "date": date_str,
        "bookings_by_room": by_room,
    })



def _ensure_aware(dt: datetime) -> datetime:
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


# Email helper: send booking confirmation/cancellation
def _send_booking_email(kind: str, booking: Booking, attendee_emails: list[str], request=None) -> None:
    """Send plain-text confirmation/cancellation emails to owner + attendees."""
    to_list = [booking.owner_email] + list(attendee_emails or [])

    # de-duplicate while preserving order
    seen = set()
    to_list = [e for e in to_list if e and not (e in seen or seen.add(e))]

    start_str = booking.start.strftime("%Y-%m-%d %H:%M")
    end_str = booking.end.strftime("%H:%M")
    room_name = booking.room.name

    if kind == "created":
        subject = f"UniRoom: Booking confirmed — {room_name} ({start_str}–{end_str})"
        intro = "Your booking is confirmed."
    else:
        subject = f"UniRoom: Booking cancelled — {room_name} ({start_str}–{end_str})"
        intro = "This booking has been cancelled."

    app_url = ""
    if request is not None:
        app_url = request.build_absolute_uri("/")

    message = (
        f"{intro}\n\n"
        f"Room: {room_name}\n"
        f"Start: {start_str}\n"
        f"End: {end_str}\n"
        f"Owner: {booking.owner_email}\n"
        f"Attendees: {', '.join(attendee_emails) if attendee_emails else '—'}\n\n"
        f"{'Open UniRoom: ' + app_url if app_url else ''}\n"
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=to_list,
        fail_silently=False,
    )


@csrf_exempt
@require_http_methods(["POST"])
def session_login(request):
    """Demo auth: store email + student id in the session."""
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    email = (payload.get("email") or "").strip().lower()
    student_id = (payload.get("student_id") or "").strip()

    if not email or not student_id:
        return JsonResponse({"error": "Email and student ID are required"}, status=400)

    request.session["owner_email"] = email
    request.session["owner_student_id"] = student_id

    return JsonResponse({"user": {"email": email, "student_id": student_id}})


@csrf_exempt
@require_http_methods(["POST"])
def session_logout(request):
    request.session.pop("owner_email", None)
    request.session.pop("owner_student_id", None)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def session_me(request):
    email = request.session.get("owner_email")
    student_id = request.session.get("owner_student_id")
    if not email or not student_id:
        return JsonResponse({"user": None})
    return JsonResponse({"user": {"email": email, "student_id": student_id}})


@csrf_exempt
@require_http_methods(["POST"])
def create_booking(request):
    """
    POST /api/bookings
    JSON body:
    {
      "room_id": 1,
      "start": "2026-01-29T16:00:00+01:00"  (or without timezone)
      "end":   "2026-01-29T18:00:00+01:00",
      "attendees": ["a@b.com", "c@d.com"]
    }
    """
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    session_email = request.session.get("owner_email")
    session_student_id = request.session.get("owner_student_id")
    if not session_email or not session_student_id:
        return JsonResponse({"error": "Not logged in", "code": "NOT_AUTHENTICATED"}, status=401)

    room_id = payload.get("room_id")
    start_raw = payload.get("start")
    end_raw = payload.get("end")
    attendees = payload.get("attendees", [])

    if not all([room_id, start_raw, end_raw]):
        return JsonResponse({"error": "Missing required fields"}, status=400)

    start_dt = parse_datetime(start_raw)
    end_dt = parse_datetime(end_raw)
    if not start_dt or not end_dt:
        return JsonResponse({"error": "Invalid datetime format (use ISO format)"}, status=400)

    start_dt = _ensure_aware(start_dt)
    end_dt = _ensure_aware(end_dt)

    if start_dt >= end_dt:
        return JsonResponse({"error": "Start must be before end"}, status=400)

    if not Room.objects.filter(id=room_id).exists():
        return JsonResponse({"error": "Room not found"}, status=404)

    # Conflict check (proper overlap logic)
    conflict = Booking.objects.filter(
        room_id=room_id,
        start__lt=end_dt,
        end__gt=start_dt,
    ).exists()

    if conflict:
        return JsonResponse(
            {"error": "Time slot conflicts with an existing booking", "code": "CONFLICT"},
            status=409
        )

    booking = Booking.objects.create(
        room_id=room_id,
        start=start_dt,
        end=end_dt,
        owner_email=session_email,
        owner_student_id=session_student_id,
    )

    # Create attendee rows (optional)
    cleaned = []
    if isinstance(attendees, list):
        for a in attendees:
            if isinstance(a, str):
                a = a.strip()
                if a:
                    cleaned.append(a)

    for email in cleaned:
        Attendee.objects.create(booking=booking, email=email)

    attendee_emails = cleaned

    def _on_commit():
        try:
            _send_booking_email("created", booking, attendee_emails, request=request)
        except Exception as e:
            # Do not break booking if email fails
            print("Email send failed:", e)

    transaction.on_commit(_on_commit)

    return JsonResponse({
        "booking": {
            "id": booking.id,
            "room_id": booking.room_id,
            "start": booking.start.isoformat(),
            "end": booking.end.isoformat(),
            "owner_email": booking.owner_email,
            "owner_student_id": booking.owner_student_id,
            "attendees": cleaned,
        }
    }, status=201)


@require_http_methods(["GET"])
def my_bookings(request):
    """
    GET /api/my-bookings
    (Later we’ll switch this to session auth.)
    """
    owner_email = request.session.get("owner_email")
    if not owner_email:
        return JsonResponse({"error": "Not logged in", "code": "NOT_AUTHENTICATED"}, status=401)

    qs = (
        Booking.objects
        .select_related("room")
        .prefetch_related("attendees")
        .filter(owner_email=owner_email)
        .order_by("start")
    )

    data = []
    for b in qs:
        data.append({
            "id": b.id,
            "room": {"id": b.room_id, "name": b.room.name},
            "start": b.start.isoformat(),
            "end": b.end.isoformat(),
            "attendees": [a.email for a in b.attendees.all()],
        })

    return JsonResponse({"bookings": data})


@csrf_exempt
@require_http_methods(["DELETE"])
def cancel_booking(request, booking_id: int):
    """
    DELETE /api/bookings/<id>
    Simple ownership check for safety.
    """
    owner_email = request.session.get("owner_email")
    if not owner_email:
        return JsonResponse({"error": "Not logged in", "code": "NOT_AUTHENTICATED"}, status=401)

    try:
        b = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Booking not found"}, status=404)

    if b.owner_email != owner_email:
        return JsonResponse({"error": "Not allowed"}, status=403)

    attendee_emails = list(b.attendees.values_list("email", flat=True))

    def _on_commit():
        try:
            _send_booking_email("cancelled", b, attendee_emails, request=request)
        except Exception as e:
            print("Email send failed:", e)

    transaction.on_commit(_on_commit)
    b.delete()
    return JsonResponse({"ok": True})