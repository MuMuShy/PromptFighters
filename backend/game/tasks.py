from celery import shared_task
from google import genai
from google.genai import types
from django.conf import settings
from .models import Character
import os

@shared_task
def generate_character_image(character_id):
    char = Character.objects.get(id=character_id)
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=f"請畫出一個中二風格的{char.prompt}角色，動漫風格，彩色插畫。必殺技描述：{char.skill_description}。請注意：圖片中絕對不要出現任何文字、標語、說明、標籤，只產生純角色圖像，不要有任何中文字或英文在圖片裡。",
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                filename = f"character_{character_id}.png"
                media_path = os.path.join(settings.MEDIA_ROOT, filename)
                with open(media_path, "wb") as f:
                    f.write(part.inline_data.data)
                char.image_url = settings.MEDIA_URL + filename
                char.save()
                break
    except Exception as e:
        # 可加 log 或通知
        print(f"Error generating character image for {character_id}: {e}")
        pass 