from django.contrib import admin
from .models import TextPair  # Import the TextPair model

# Register the TextPair model
from .models import SessionRecord  # Import the SessionRecord model
admin.site.register(TextPair)
admin.site.register(SessionRecord)  # Register the SessionRecord model