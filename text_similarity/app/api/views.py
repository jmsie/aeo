
import json
import os
import uuid
import openai
import numpy as np
from dotenv import load_dotenv
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.utils.decorators import method_decorator
from ..models import TextPair, SessionRecord

load_dotenv()


# 儲存 session 資料
@csrf_exempt
@require_POST
def save_session(request):
    try:
        body = json.loads(request.body.decode())
        session_id = body.get('session_id')
        data = body.get('data')
        if not session_id or not data:
            return JsonResponse({'error': 'Missing session_id or data'}, status=400)
        obj, created = SessionRecord.objects.update_or_create(
            session_id=session_id,
            defaults={'data': json.dumps(data)}
        )
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# 取得 session 資料
@csrf_exempt
@require_GET
def get_session_data(request):
    session_id = request.GET.get('session_id')
    if not session_id:
        return JsonResponse({'error': 'Missing session_id'}, status=400)
    try:
        obj = SessionRecord.objects.get(session_id=session_id)
        return JsonResponse({'data': json.loads(obj.data)})
    except SessionRecord.DoesNotExist:
        return JsonResponse({'data': None})


@csrf_exempt
def get_session_id(request):
    """產生新的 session_id 並回傳"""
    session_id = str(uuid.uuid4())
    return JsonResponse({'session_id': session_id})


@method_decorator(csrf_exempt, name='dispatch')
def get_similarity(request):
    session_id = request.GET.get('session_id')
    if not session_id:
        return JsonResponse({'error': 'Missing session_id'}, status=400)
    if request.method == 'POST':
        text1 = request.POST.get('text1')
        text2 = request.POST.get('text2')
        similarity_score = calculate_similarity(text1, text2)
        text_pair = TextPair.objects.create(text1=text1, text2=text2, session_id=session_id)
        return JsonResponse({'similarity_score': similarity_score, 'session_id': session_id})
    return JsonResponse({'error': 'Invalid request'}, status=400)


def calculate_similarity(text1, text2):
    """
    Use OpenAI embedding API (v1+) and cosine similarity to compare two texts.
    Returns a float similarity score as a percentage rounded to 2 decimal places.
    """
    try:
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=[text1.strip(), text2.strip()]
        )
        emb1 = np.array(response.data[0].embedding)
        emb2 = np.array(response.data[1].embedding)
        cosine_sim = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))
        percentage = round(cosine_sim * 100, 2)
        return percentage
    except Exception as e:
        print(f"Embedding or similarity calculation failed: {e}")
        return 0.0
