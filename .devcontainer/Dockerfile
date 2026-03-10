FROM debian:bookworm

RUN apt-get update && apt-get install -y curl git ca-certificates && rm -rf /var/lib/apt/lists/*

# Install nvm
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Install Node 22 (LTS) as default
RUN . "$NVM_DIR/nvm.sh" && nvm install 22 && nvm alias default 22

# Make node/npm available in non-interactive shells
ENV PATH="$NVM_DIR/versions/node/v22/bin:$PATH"
SHELL ["/bin/bash", "-c"]

RUN . "$NVM_DIR/nvm.sh" && npm install -g firebase-tools wrangler

RUN curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts
ENV PATH="$PATH:/root/google-cloud-sdk/bin"
