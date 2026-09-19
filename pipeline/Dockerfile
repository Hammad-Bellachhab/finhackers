FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 make && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY src ./src
COPY Makefile .
# Artefactos ya calculados (python -m src.pipeline all) para que la imagen arranque sola en Fly;
# docker-compose.yml los sigue montando encima como volúmenes.
COPY data/serve.db data/serve.db
COPY data/test_companies/company_ids.txt data/test_companies/
COPY models ./models
COPY reports ./reports
EXPOSE 8000 8501
CMD ["python", "-m", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
