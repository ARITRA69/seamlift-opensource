# The seamtranscode HTTP worker: ffmpeg, the S3 SDK and sharp included.
#
#   docker build -t seamtranscode packages/seamtranscode
#   docker run -p 8100:8100 -e SEAMTRANSCODE_SECRET=... -e R2_ACCOUNT_ID=... seamtranscode
#
# Configuration is environment variables; see the README.

FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json tsconfig.json tsup.config.ts README.md LICENSE ./
COPY src ./src
RUN npm install --no-audit --no-fund --ignore-scripts \
  && npx tsup \
  && mkdir /out \
  && npm pack --ignore-scripts --pack-destination /out

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/ /tmp/pkg/
RUN npm install -g --no-audit --no-fund /tmp/pkg/seamtranscode-*.tgz @aws-sdk/client-s3@3 sharp@0.34 \
  && rm -rf /tmp/pkg /root/.npm
ENV NODE_ENV=production \
  SEAMTRANSCODE_WORK_DIR=/tmp/seamtranscode \
  SEAMTRANSCODE_PORT=8100
USER node
WORKDIR /home/node
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.SEAMTRANSCODE_PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["seamtranscode", "serve"]
