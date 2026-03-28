# Build stage
FROM docker.io/library/golang:1.26 AS builder

WORKDIR /app

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

# Copy wasm_exec.js from Go installation (in golang image it's at /usr/local/go)
RUN mkdir -p /web/static/wasm && \
    cp /usr/local/go/misc/wasm/wasm_exec.js /web/static/wasm/wasm.js

# Final stage - distroless minimal image
FROM gcr.io/distroless/static:nonroot

# Copy binaries and assets
COPY --from=builder /cnpg-admin /
COPY --from=builder /web /web

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/cnpg-admin"]
