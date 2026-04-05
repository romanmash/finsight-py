FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY packages/shared /app/packages/shared
COPY config /app/config
COPY apps/api-service /app/apps/api-service

RUN pip install --no-cache-dir -e /app/packages/shared -e /app/apps/api-service

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
