START FRONTEND SERVER
cd frontend
npm run dev 

START BACKEND SERVER
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000