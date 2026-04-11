FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir "mcp>=1.3,<1.4" requests pydantic
COPY src/ /app/src/

ENV MAPBOX_PUBLIC_TOKEN=""
ENV MAPBOX_SECRET_TOKEN=""
ENV LOG_LEVEL="INFO"

CMD ["python3", "src/server.py"]
