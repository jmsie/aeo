#!/bin/sh

# Collect static files
python manage.py collectstatic --noinput

# Start the server (pass all arguments, e.g. gunicorn or runserver)
exec "$@"
