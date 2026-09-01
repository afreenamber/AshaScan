# AshaScan

AI-assisted non-invasive anemia risk screening from conjunctiva/eye images for ASHA workers.

## Purpose

This project provides a lightweight pipeline and API to predict anemia risk level (e.g. low/medium/high) and a confidence score from eye/conjunctiva images collected by community health workers.

## Folder structure

- `src/` — core processing and prediction code
- `notebooks/` — exploratory and analysis notebooks
- `models/` — trained model artifacts (do not commit large binaries)
- `api/` — FastAPI application and endpoints
- `demo_images/` — small demo/example images for tests and docs
- `docs/` — documentation and usage guides
- `data/` — raw datasets (ignored from git)

## Setup

1. Clone the repo:

```bash
git clone <repo-url>
cd AshaScan
```

2. Create a virtual environment and activate it (macOS/Linux):

```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Run the API (example):

```bash
uvicorn api.main:app --reload
```

## Notes

- `data/` is gitignored to avoid uploading large datasets. Keep models in `models/` and only commit small placeholders.
- This repository contains scaffolding; model training and prediction logic are TODOs.
# AshaScan
AI-assisted anemia risk screening designed for ASHA workers.
