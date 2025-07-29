# Text Similarity Web Application

## Overview
This project is a Django-based web application for comparing the similarity between multiple search queries and a main text. It features a user-friendly interface and an API for text similarity scoring.

## Features
- **Text Similarity Page**: `/text_similarity/` page with 5 input boxes for search queries, 1 main text area, and real-time similarity scores for each pair.
- **API Endpoint**: `/api/get_similarity/` accepts POST requests with `text1` and `text2` and returns a similarity score.
- **Database Storage**: Each text pair submitted is stored in the database.
- **Dockerized Setup**: Uses Docker Compose for easy deployment with PostgreSQL and Nginx.
- **Static Files**: Properly configured for static file serving in production.

## Usage
1. Visit `/text_similarity/` to compare search queries with a main text.
2. Enter up to 5 search queries and a main text, then click the button to calculate similarity scores.
3. API can be tested with:
   ```bash
   curl -X POST http://localhost:8000/api/get_similarity/ \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "text1=Hello&text2=World"
   ```

## Tech Stack
- Django
- PostgreSQL
- Gunicorn
- Nginx
- Docker Compose

## File Structure
- `app/views.py`: Contains views for rendering pages and API logic.
- `app/api/views.py`: API logic for similarity scoring.
- `app/templates/app/text_similarity.html`: Main UI for text similarity.
- `app/urls.py`, `app/api/urls.py`: URL routing.
- `Dockerfile`, `docker-compose.yml`: Container setup.
- `.env`: Environment variables.

## How It Works
- The user enters search queries and a main text.
- The frontend sends each pair to the API.
- The API calculates and returns a similarity score (placeholder logic).
- Scores are displayed next to each input.
- All pairs are saved to the database for record-keeping.

## Customization
- Replace the placeholder similarity logic in `calculate_similarity` with your own algorithm.
- Extend the UI or API as needed for more advanced features.