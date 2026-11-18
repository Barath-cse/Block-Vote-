import base64
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import insightface
from insightface.app import FaceAnalysis

app = FastAPI(
    title="Biometric AI Sidecar Service",
    description="Extracts 512-dimensional facial embeddings using InsightFace (buffalo_s)",
    version="1.0.0"
)

# Enable CORS for cross-origin requests from Spring Boot and React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize InsightFace model with buffalo_s model pack
# Uses CPU provider by default (or CUDA if available on environment)
print("Initializing InsightFace model (buffalo_s)...")
face_app = FaceAnalysis(name="buffalo_s", providers=['CPUExecutionProvider'])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("InsightFace model initialized successfully.")


class ImagePayload(BaseModel):
    image: str = Field(..., description="Base64 encoded image string (data URI or raw base64)")


class EmbeddingResponse(BaseModel):
    embedding: list[float] = Field(..., description="Normalized 512-dimensional feature vector")


def decode_base64_image(base64_str: str) -> np.ndarray:
    """
    Decodes a Base64 string into an OpenCV BGR image array.
    Handles data URI prefixes (e.g., 'data:image/jpeg;base64,...').
    """
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        
        image_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Failed to decode image bytes into valid OpenCV matrix")
            
        return img
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format: {str(e)}"
        )


@app.get("/health")
def health_check():
    """Health probe endpoint."""
    return {"status": "UP", "service": "ai-sidecar"}


@app.post("/extract-embedding", response_model=EmbeddingResponse)
def extract_embedding(payload: ImagePayload):
    """
    Extracts a 512-dimensional normalized face embedding vector from a Base64 image frame.
    
    Enforces strict detection rules:
    - 0 faces detected => HTTP 400 Bad Request
    - >1 faces detected => HTTP 400 Bad Request
    - 1 face detected => Returns normalized 512-length float list
    """
    img = decode_base64_image(payload.image)

    # Detect faces in image
    faces = face_app.get(img)
    face_count = len(faces)

    if face_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected. Please position your face clearly in front of the camera."
        )

    if face_count > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Multiple faces detected ({face_count}). Only one voter face must be present."
        )

    # Extract 512-d raw embedding from the single detected face
    face = faces[0]
    raw_embedding = face.embedding

    # =========================================================================
    # VECTOR NORMALIZATION EXPLANATION:
    # L2 normalization ensures the length (Euclidean norm) of the vector is 1.
    # Formula: v_norm = v / ||v||2
    # When vectors are L2-normalized, Cosine Similarity simplifies directly to
    # the Dot Product (A · B). It also standardizes scale across different frames.
    # =========================================================================
    norm = np.linalg.norm(raw_embedding)
    if norm > 0:
        normalized_embedding = (raw_embedding / norm).astype(float)
    else:
        normalized_embedding = raw_embedding.astype(float)

    embedding_list = normalized_embedding.tolist()

    return EmbeddingResponse(embedding=embedding_list)
