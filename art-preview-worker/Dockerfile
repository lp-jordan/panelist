FROM node:22-slim

# ImageMagick rasterizes the previews; Ghostscript is the delegate ImageMagick
# shells out to for PDF pages. libwebp gives ImageMagick webp output.
RUN apt-get update \
  && apt-get install -y --no-install-recommends imagemagick ghostscript libwebp7 \
  && rm -rf /var/lib/apt/lists/*

# Debian's ImageMagick policy blocks PDF/PS coders by default (a security default
# aimed at untrusted input). Our inputs are our own art team's files, so allow
# reading PDF/PS so PDF previews can render. Covers both IMv6 and IMv7 layouts.
RUN set -eux; \
  for f in /etc/ImageMagick-6/policy.xml /etc/ImageMagick-7/policy.xml; do \
    if [ -f "$f" ]; then \
      sed -i 's/rights="none" pattern="PDF"/rights="read" pattern="PDF"/' "$f"; \
      sed -i 's/rights="none" pattern="PS"/rights="read" pattern="PS"/' "$f"; \
    fi; \
  done

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs ./

CMD ["node", "index.mjs"]
