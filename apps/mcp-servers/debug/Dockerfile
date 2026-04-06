FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY config /app/config
COPY apps/mcp-servers/debug /app/apps/mcp-servers/debug

RUN pip install --no-cache-dir -e /app/apps/mcp-servers/debug

CMD ["uvicorn", "debug_mcp.server:app", "--host", "0.0.0.0", "--port", "8010", "--app-dir", "/app/apps/mcp-servers/debug/src"]
