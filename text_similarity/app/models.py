from django.db import models

class SessionRecord(models.Model):
    session_id = models.CharField(max_length=64, unique=True)
    data = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.session_id
from django.db import models

class TextPair(models.Model):
    text1 = models.TextField()
    text2 = models.TextField()
    session_id = models.CharField(max_length=36, db_index=True, default="unknown")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"TextPair: {self.text1[:50]}... and {self.text2[:50]}..."