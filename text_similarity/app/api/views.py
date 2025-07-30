from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from ..models import TextPair
import openai
import numpy as np
import os
from dotenv import load_dotenv

load_dotenv()

@method_decorator(csrf_exempt, name='dispatch')
def get_similarity(request):
    if request.method == 'POST':
        text1 = request.POST.get('text1')
        text2 = request.POST.get('text2')
        # Implement text similarity logic here
        similarity_score = calculate_similarity(text1, text2)

        # Save text1 and text2 to the database
        text_pair = TextPair.objects.create(text1=text1, text2=text2)

        # Use the saved text_pair object if needed
        print(f"Saved TextPair with ID: {text_pair.id}")

        return JsonResponse({'similarity_score': similarity_score})
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
