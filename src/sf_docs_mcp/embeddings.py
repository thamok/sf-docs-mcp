from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from openai import OpenAI


class EmbeddingProvider(ABC):
    """Provider abstraction so embeddings can be swapped later."""

    @property
    @abstractmethod
    def dimensions(self) -> int:
        ...

    @abstractmethod
    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        ...


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embeddings wrapper.

    Supports:
    - text-embedding-3-large (optionally reduced dimensionality)
    - text-embedding-3-small
    """

    def __init__(
        self,
        model: str = "text-embedding-3-large",
        dimensions: int | None = 1024,
        api_key: str | None = None,
    ):
        self.model = model
        self._dimensions = dimensions
        self.client = OpenAI(api_key=api_key)

    @property
    def dimensions(self) -> int:
        if self._dimensions is None:
            return 3072 if self.model == "text-embedding-3-large" else 1536
        return self._dimensions

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        params: dict = {"model": self.model, "input": list(texts)}
        if self._dimensions is not None and self.model == "text-embedding-3-large":
            params["dimensions"] = self._dimensions

        response = self.client.embeddings.create(**params)
        return [item.embedding for item in response.data]
