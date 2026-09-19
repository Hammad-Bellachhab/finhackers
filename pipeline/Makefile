# Un solo comando reconstruye todo desde los CSV (../output): make all   (o: python -m src.pipeline all)
PY ?= python
export PYTHONIOENCODING=utf-8

.PHONY: all ingest schema split labels features train evaluate db test-companies sensitivity api frontend test lint smoke clean docker-up docker-down

all:           ## pipeline offline completo desde los CSV (≈ 10 min). Sin make: python -m src.pipeline all
	$(PY) -m src.pipeline all

ingest:        ## Capa 1: CSV → Parquet + informe de calidad
	$(PY) -m src.ingest
schema:        ## Capa 2: tablas empresa × mes
	$(PY) -m src.schema
split:         ## reserva ~80 empresas (grupos enteros) como test simulado → data/test_companies/
	$(PY) -m src.split_test
labels:        ## Capa 3: target de deterioro (ajustado solo con las empresas de entrenamiento)
	$(PY) -m src.labels
features:      ## Capa 4: panel de features
	$(PY) -m src.features
train:         ## Capa 5 + 7: validación temporal, A vs B, ablación, registro
	$(PY) -m src.train
evaluate:      ## Capa 6: SHAP, figuras, análisis de errores
	$(PY) -m src.evaluate
db:            ## Capa 8: base de datos servida (SQLite o DATABASE_URL)
	$(PY) -m src.serve_db
test-companies: ## puntúa las empresas reservadas con predict.py y las compara con lo que les pasó
	$(PY) -m src.evaluate_test
sensitivity:   ## §16: 3 vs 6 meses, p85 vs p90
	$(PY) -m src.sensitivity

api:           ## Capas 9-10
	$(PY) -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000
frontend:      ## Capa 11
	$(PY) -m streamlit run src/frontend/app.py --server.port 8501

test:          ## tests unitarios + smoke sobre datos sintéticos
	$(PY) -m pytest -q tests
smoke:         ## solo el smoke test end-to-end (datos sintéticos, ~1 min)
	$(PY) -m pytest -q tests/test_smoke_pipeline.py
lint:
	$(PY) -m ruff check src tests

docker-up:
	docker compose up --build -d
docker-down:
	docker compose down -v

clean:
	rm -rf data/parquet data/tmp data/serve.db reports/*.parquet
