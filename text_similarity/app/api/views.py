from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from ..models import TextPair


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
    # Placeholder for actual similarity calculation logic
    return 0.0  # Replace with actual calculation logic
