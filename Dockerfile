# syntax=docker/dockerfile:1.7

# ----- Stage 1: build React frontend -----------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /src
COPY frontend/fan-control-dashboard/package.json frontend/fan-control-dashboard/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/fan-control-dashboard/ ./
RUN npm run build

# ----- Stage 2: Python runtime with ipmitool ---------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ipmitool ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/api/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/api/ ./
COPY --from=frontend-build /src/build ./static

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
