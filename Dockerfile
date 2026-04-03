FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY packages ./packages

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "packages.api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
