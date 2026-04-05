FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY config /app/config
COPY apps/mcp-servers/rag-retrieval /app/apps/mcp-servers/rag-retrieval

RUN pip install --no-cache-dir -e /app/apps/mcp-servers/rag-retrieval

CMD ["uvicorn", "rag_retrieval.server:app", "--host", "0.0.0.0", "--port", "8003", "--app-dir", "/app/apps/mcp-servers/rag-retrieval/src"]
