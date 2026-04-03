from __future__ import annotations

from openai import OpenAI


SUPPORTED_MODELS = {
    "text-embedding-3-large": (1024, 3072),
    "text-embedding-3-small": (512, 1536),
}


class EmbeddingService:
    def __init__(self, api_key: str, model: str, dimensions: int | None = None) -> None:
        if model not in SUPPORTED_MODELS:
            raise ValueError(f"Unsupported embedding model: {model}")

        min_dims, max_dims = SUPPORTED_MODELS[model]
        chosen_dims = dimensions or max_dims
        if chosen_dims < min_dims or chosen_dims > max_dims:
            raise ValueError(
                f"Invalid dimensions={chosen_dims} for {model}; expected between {min_dims} and {max_dims}"
            )

        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.dimensions = chosen_dims

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = self.client.embeddings.create(
            model=self.model,
            input=texts,
            dimensions=self.dimensions,
        )
        return [item.embedding for item in response.data]

    def embed_query(self, query: str) -> list[float]:
        return self.embed_texts([query])[0]
