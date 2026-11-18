FROM python:3.14.2-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN groupadd --gid 10001 lms && useradd --uid 10001 --gid 10001 --no-create-home lms
COPY --chown=10001:10001 . .
RUN mkdir -p uploads/emblems && chown -R 10001:10001 uploads
USER 10001:10001
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--ws-max-size", "65536"]
