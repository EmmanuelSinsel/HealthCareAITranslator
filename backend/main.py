import os
from google import genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

client = genai.Client(api_key="AIzaSyBYmOYo82vxy7lPOHBPDi_nuSuXcVqUtOA")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslationRequest(BaseModel):
    text: str
    from_language: str
    to_language: str

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    try:
        print("req: "+request.text)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[f"Translate the following {request.from_language} text to {request.to_language}: '{request.text}', just return the transalated text, i dont want anything else"]
        )
        print("res: "+response.text)
        translated_text = str(response.text).replace("\n","")
        return {"translatedText": translated_text}
    except Exception as e:
        return {"error": str(e)}