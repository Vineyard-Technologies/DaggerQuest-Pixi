FROM node:22-bookworm

RUN npm install -g firebase-tools wrangler

RUN curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts
ENV PATH="$PATH:/root/google-cloud-sdk/bin"
