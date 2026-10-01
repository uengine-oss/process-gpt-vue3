FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir 'litellm[proxy]' \
    && useradd --create-home --uid 10001 litellm

COPY config.yaml .

EXPOSE 4000

# root 가 아닌 사용자로 실행
USER 10001

CMD ["litellm", "--config", "/app/config.yaml", "--host", "0.0.0.0", "--port", "4000"]
