# Clep Motion — one image, two entrypoints:
#   Cloud Run service:  python3 motion.py service   (chat / templates / preview — fast, synchronous)
#   Cloud Run Job:      python3 motion.py job       (brand extraction / renders — one execution per job)
# Playwright's image ships Python + Chromium (brand extraction, auto tour); Remotion gets its own headless shell.
FROM mcr.microsoft.com/playwright/python:v1.60.0-noble

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Engine deps first so code edits don't bust the npm layer.
COPY engine/package.json engine/package-lock.json engine/
RUN cd engine && npm ci --no-audit --no-fund && npx remotion browser ensure

COPY . .
# Pre-bundle once with an empty public dir; jobs copy it and drop the project's assets into public/.
RUN mkdir -p /tmp/empty-public && cd engine \
    && npx remotion bundle --public-dir /tmp/empty-public --out-dir /app/prebundle --log=error
ENV MOTION_PREBUNDLE=/app/prebundle PYTHONUNBUFFERED=1 PORT=8080

CMD ["python3", "motion.py", "service"]
