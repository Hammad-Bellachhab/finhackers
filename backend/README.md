# Backend

FastAPI + uvicorn.

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows (bash); en PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/api/health
- Docs OpenAPI: http://localhost:8000/docs
