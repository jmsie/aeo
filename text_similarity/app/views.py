from django.shortcuts import render
from django.http import JsonResponse
from .models import TextPair
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


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


def home(request):
    return render(request, 'app/home.html')


def text_similarity(request):
    return render(request, 'app/text_similarity.html')


def calculate_similarity(text1, text2):
    # Placeholder for actual similarity calculation logic
    return 0.0  # Replace with actual calculation logic
from django.shortcuts import render

def query_based_text_optimize(request):
    return render(request, 'app/query_based_text_optimize.html')