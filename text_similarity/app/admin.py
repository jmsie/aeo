from django.contrib import admin
from .models import TextPair, SessionRecord  # Import the models


# Customize the admin interface for SessionRecord
class SessionRecordAdmin(admin.ModelAdmin):
    list_display = (
        'summary',
        'created_at',
    )  # Display 'summary' and 'created_at' in the admin list view


# Register the models
admin.site.register(TextPair)

admin.site.register(SessionRecord, SessionRecordAdmin)