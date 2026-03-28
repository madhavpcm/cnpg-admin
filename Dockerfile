# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install dependencies for cross-compilation
RUN apk add --no-cache curl

# Copy Go modules
COPY go.mod go.sum ./
RUN go mod download

# Build server
COPY cmd/server ./cmd/server
COPY internal ./internal
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /cnpg-admin ./cmd/server

# Build WASM
COPY cmd/wasm ./cmd/wasm  
COPY internal/ui ./internal/ui
RUN GOOS=js GOARCH=wasm CGO_ENABLED=0 go build -o /app.wasm ./cmd/wasm

# Download Go WASM exec JS
RUN curl -sL https://raw.githubusercontent.com/golang/go/go1.26.1/misc/wasm/wasm_exec.js -o /web/static/wasm.js

# Final stage - distroless minimal image
FROM gcr.io/distroless/static:nonroot

# Copy binaries and assets
COPY --from=builder /cnpg-admin /
COPY --from=builder /web /web

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/cnpg-admin"]
