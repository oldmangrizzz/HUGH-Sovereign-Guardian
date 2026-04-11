FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir "mcp>=1.3,<1.4" paramiko pydantic

COPY src/ /app/src/

ENV SSH_HOST=""
ENV SSH_PORT="22"
ENV SSH_USER="root"
ENV SSH_PASSWORD=""
ENV SSH_KEY_PATH=""
ENV LOG_LEVEL="INFO"

CMD ["python3", "src/server.py"]
