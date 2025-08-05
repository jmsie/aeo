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

# Explicitly set the OpenAI API key
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# 儲存 session 資料
@csrf_exempt
@require_POST
def save_session(request):
    try:
        body = json.loads(request.body.decode())
        session_id = body.get('session_id')
        data = body.get('data')
        if not session_id or not data:
            return JsonResponse(
                {'error': 'Missing session_id or data'}, status=400
            )

        # Check if the session already exists
        obj, created = SessionRecord.objects.update_or_create(
            session_id=session_id,
            defaults={
                'data': json.dumps(data),
            }
        )

        # Generate summary only if the session is newly created
        if created and 'main_text' in data:
            main_text = data.get('main_text', '')
            if main_text:
                gpt_response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "Summarize the following text in 30 characters or less, You must generate a summary in same language."},
                        {"role": "user", "content": main_text}
                    ]
                )
                summary = gpt_response.choices[0].message.content
                summary = summary.strip()
                if len(summary) > 30:
                    summary = summary[:25] + "…"  # 如果你願意截斷
                obj.summary = summary
                obj.save()

        return JsonResponse({'success': True, 'summary': obj.summary})
    except Exception as e:
        print(f"Error saving session: {e}")
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
        return JsonResponse({
            'data': json.loads(obj.data),
            'summary': obj.summary  # Include summary in the response
        })
    except SessionRecord.DoesNotExist:
        return JsonResponse({'data': None, 'summary': None})


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
        text1 = request.POST.get('text1', '')[:3000]  # Limit text1 length
        text2 = request.POST.get('text2', '')[:3000]  # Limit text2 length
        similarity_score = calculate_similarity(text1, text2)
        TextPair.objects.create(
            text1=text1, text2=text2, session_id=session_id
        )
        return JsonResponse({
            'similarity_score': similarity_score,
            'session_id': session_id
        })
    return JsonResponse({'error': 'Invalid request'}, status=400)


def calculate_similarity(text1, text2):
    """
    Use OpenAI embedding API (v1+) and cosine similarity to compare two texts.
    Returns a float similarity score as a percentage rounded to 2 decimal
    places.
    """
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=[text1.strip(), text2.strip()]
        )
        emb1 = np.array(response.data[0].embedding)
        emb2 = np.array(response.data[1].embedding)
        cosine_sim = float(
            np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        )
        percentage = round(cosine_sim * 100, 2)
        return percentage
    except Exception as e:
        print(f"Embedding or similarity calculation failed: {e}")
        return 0.0


@csrf_exempt
def generate_search_intents(request):
    if request.method == 'POST':
        try:
            body = json.loads(request.body)
            user_text = body.get('text', '')[:3000]  # Limit user_text length

            if not user_text:
                return JsonResponse({'error': 'Text is required'}, status=400)

            # Call OpenAI GPT API to generate search intents in JSON format
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Generate 5 search intents based on the following text. "
                            "You must generate relevant search intents with "
                            "same language as the input text."
                            "盡可能貼近人類用語的方式生成搜索意圖。"
                            "Return the result as a JSON array of strings."
                        )
                    },
                    {"role": "user", "content": user_text}
                ],
                max_tokens=150,
                n=1,
                temperature=0.7
            )

            # Parse the JSON response from the LLM
            intents = json.loads(response.choices[0].message.content.strip())

            return JsonResponse(
                {'intents': intents},
                status=200
            )
        except json.JSONDecodeError:
            return JsonResponse(
                {'error': 'Failed to parse JSON from LLM response'},
                status=500
            )
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    else:
        return JsonResponse({'error': 'Invalid request method'}, status=405)
