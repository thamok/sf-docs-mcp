from sf_docs_mcp.models import SearchHit
from sf_docs_mcp.services.retrieval import RetrievalService


class FakeEmbeddings:
    def embed_query(self, query: str) -> list[float]:
        return [0.1, 0.2]


class FakeQdrant:
    def dense_search(self, query_vector: list[float], limit: int = 40):
        class P:
            def __init__(self, pid, score, payload):
                self.id = pid
                self.score = score
                self.payload = payload

        return [
            P("a", 0.9, {"document_id": "d1", "url": "u1", "content": "hello world"}),
            P("b", 0.8, {"document_id": "d1", "url": "u1", "content": "hello world!"}),
        ]


def test_hybrid_rrf_and_dedupe():
    lexical = [
        SearchHit("c", "d2", "u2", "other", 0.7, 1, "lexical"),
        SearchHit("a", "d1", "u1", "hello world", 0.6, 2, "lexical"),
    ]

    svc = RetrievalService(
        embeddings=FakeEmbeddings(),
        qdrant=FakeQdrant(),
        lexical_search=lambda _q, _k: lexical,
    )

    hits = svc.search("hello")
    ids = [h.chunk_id for h in hits]

    assert "a" in ids
    assert "c" in ids
    assert "b" not in ids  # near-duplicate of 'a' for same URL
