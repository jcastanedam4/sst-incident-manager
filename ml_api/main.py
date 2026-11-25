from __future__ import annotations

import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Annotated

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

import torch
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from transformers.modeling_utils import PreTrainedModel
from transformers.tokenization_utils_base import PreTrainedTokenizerBase

from ml_api.labels import MODEL_LABELS, model_label_for_index

MODEL_DIR = Path(os.environ.get("BETO_MODEL_DIR", "ml_api/models/beto_gtc45_model"))
TOKENIZER_DIR = Path(os.environ.get("BETO_TOKENIZER_DIR", "ml_api/models/beto_gtc45_tokenizer"))
MAX_TEXT_LENGTH = 5000
MAX_TOKENS = 128


@dataclass(frozen=True)
class ModelRuntime:
    model: PreTrainedModel
    tokenizer: PreTrainedTokenizerBase
    device: torch.device


_inference_lock = Lock()


def load_runtime() -> ModelRuntime:
    for directory in (MODEL_DIR, TOKENIZER_DIR):
        if not directory.is_dir():
            raise RuntimeError(f"No se encontró el directorio requerido del modelo: {directory}")

    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_DIR, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_DIR,
        local_files_only=True,
        use_safetensors=True,
    )

    if model.config.num_labels != len(MODEL_LABELS):
        raise RuntimeError(
            f"El modelo tiene {model.config.num_labels} clases; se esperaban {len(MODEL_LABELS)}."
        )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()
    return ModelRuntime(model=model, tokenizer=tokenizer, device=device)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.runtime = load_runtime()
    yield
    app.state.runtime = None


app = FastAPI(
    title="Sugerencia de riesgo SST",
    version="1.0.0",
    lifespan=lifespan,
)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[str, Field(min_length=1, max_length=MAX_TEXT_LENGTH)]


@app.get("/health")
def health(request: Request) -> dict[str, str]:
    runtime: ModelRuntime | None = request.app.state.runtime
    if runtime is None:
        raise HTTPException(status_code=503, detail="El modelo no está disponible.")
    return {"status": "ok", "device": str(runtime.device)}


@app.post("/predict")
def predict(payload: PredictionRequest, request: Request) -> dict[str, str]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="El texto no puede estar vacío.")

    runtime: ModelRuntime | None = request.app.state.runtime
    if runtime is None:
        raise HTTPException(status_code=503, detail="El modelo no está disponible.")

    inputs = runtime.tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_TOKENS,
    )
    inputs = {name: tensor.to(runtime.device) for name, tensor in inputs.items()}

    with _inference_lock, torch.inference_mode():
        logits = runtime.model(**inputs).logits
        class_index = int(torch.argmax(logits, dim=-1).item())

    try:
        label = model_label_for_index(class_index)
    except ValueError as error:
        raise HTTPException(status_code=500, detail="El modelo devolvió una clase inválida.") from error

    return {"label": label}
