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

# Debian also caps the pixel cache low (16K px a side, 1 GiB of disk), sized for
# thumbnails of untrusted uploads, not print-resolution comic pages: a 1200 dpi
# 11x17 page is 13200x20400. Lift the size caps and let big images spill to
# disk (the container's /tmp has plenty); keep RAM caps at Debian's defaults so
# a huge file costs disk time, not memory. These are ceilings: `-limit` on the
# command line can only lower them.
RUN set -eux; \
  for f in /etc/ImageMagick-6/policy.xml /etc/ImageMagick-7/policy.xml; do \
    if [ -f "$f" ]; then \
      sed -i -E 's/(name="width" value=")[^"]*"/\132KP"/; s/(name="height" value=")[^"]*"/\132KP"/' "$f"; \
      sed -i -E 's/(name="area" value=")[^"]*"/\11GP"/; s/(name="disk" value=")[^"]*"/\116GiB"/' "$f"; \
    fi; \
  done

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs ./

CMD ["node", "index.mjs"]
