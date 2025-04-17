import os
from google import genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


client = genai.Client(api_key=os.getenv('APIKEY')) # READ THE API KEY

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslationRequest(BaseModel): # MODEL FOR THE POST REQUEST
    text: str
    from_language: str
    to_language: str

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    try:
        response = client.models.generate_content( # ASK THE GENERATIVE IA (in this case Gemini but is easy to implement any API, i implemented Gemini because its free C:)
            model="gemini-2.0-flash",
            contents=[f"Translate the following {request.from_language} text to {request.to_language}: '{request.text}', just return the transalated text, i dont want anything else"] # ASK FOR JUST THE TRANSLATED TEXT
        )
        translated_text = str(response.text).replace("\n","")
        return {"translatedText": translated_text} # RETURN THE TRANSLATED TEXT
    except Exception as e:
        return {"error": str(e)}