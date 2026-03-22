.PHONY: install dev dev-backend dev-frontend docker-up docker-down

install:
	cd backend && python3 -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	cd frontend && npm install

dev-backend:
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

dev:
	make dev-backend & make dev-frontend

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down
