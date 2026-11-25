from __future__ import annotations

from typing import Final

MODEL_LABELS: Final[tuple[str, ...]] = (
    "Biologico",
    "Biomecanico",
    "Condiciones de Seguridad",
    "Fenomenos Naturales",
    "Fisico",
    "Psicosocial",
    "Quimico",
)

def model_label_for_index(index: int) -> str:
    if not 0 <= index < len(MODEL_LABELS):
        raise ValueError(f"El modelo devolvió un índice de clase no reconocido: {index}")
    return MODEL_LABELS[index]
