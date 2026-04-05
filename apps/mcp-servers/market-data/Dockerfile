FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY config /app/config
COPY apps/mcp-servers/market-data /app/apps/mcp-servers/market-data

RUN pip install --no-cache-dir -e /app/apps/mcp-servers/market-data

CMD ["uvicorn", "market_data.server:app", "--host", "0.0.0.0", "--port", "8001", "--app-dir", "/app/apps/mcp-servers/market-data/src"]
