# =============================================================
# Dockerfile for School-LMS Backend
# =============================================================
# WHAT IS THIS FILE?
# Think of a Dockerfile like a recipe card. It tells Docker
# (a packaging tool) exactly how to build a "container" —
# a small, self-contained box that has your app + everything
# it needs to run (Python, libraries, code). This means your
# app runs the same way on your laptop, on AWS, or anywhere.
# =============================================================

# Step 1: Start from a lightweight Python image
# "python:3.13-slim" is a pre-made box with Python already
# installed. "slim" means it skips unnecessary extras to
# keep the download size small (~150 MB instead of ~900 MB).
FROM python:3.13-slim

# Step 2: Set the working directory inside the container
# This is like doing "cd /app" — all future commands will
# run from this folder inside the container.
WORKDIR /app

# Step 3: Install system dependencies needed by psycopg
# (the PostgreSQL driver). These are low-level C libraries
# that Python packages sometimes need to compile.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Step 4: Copy requirements.txt first (for caching)
# Docker is smart — if requirements.txt hasn't changed,
# it won't re-download all packages. This saves time on
# rebuilds.
COPY requirements.txt .

# Step 5: Install Python dependencies
# "pip install" downloads and installs all the Python
# libraries your backend needs (FastAPI, SQLAlchemy, etc.)
RUN pip install --no-cache-dir -r requirements.txt

# Step 6: Copy the rest of your application code
# This copies everything from your Backend/ folder into
# the container's /app folder.
COPY . .

# Step 7: Create the uploads directory
# Your app stores uploaded files (like school emblems)
# in this folder. We create it now so the app doesn't
# crash looking for it.
RUN mkdir -p uploads/emblems

# Step 8: Tell Docker this container listens on port 8000
# This doesn't actually open the port — it's documentation
# for other developers (and Docker tools) to know which
# port your app uses.
EXPOSE 8000

# Step 9: The command to start your app
# When the container starts, it runs this command:
# - "alembic upgrade head" applies any pending database
#   changes (like adding new tables or columns)
# - "uvicorn app.main:app" starts your FastAPI server
# - "--host 0.0.0.0" means accept connections from anywhere
#   (not just localhost)
# - "--port 8000" is the port number
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

