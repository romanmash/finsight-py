# Current Local Setup

Dev Laptop has local SSH connection to the Linux Server.
Any other needed software or frameworks can be easily installed on any local machine below.

## Dev Laptop

### Hardware
- HW: ROG Strix G18 G815LR
- CPU: Intel Core Ultra 9 275HX (2.70 GHz), 8P+16E cores, 24 threads
- GPU: NVIDIA GeForce RTX 5070 Ti (CUDA, Vulkan), 12 GB, GDDR7
- NPU: Intel AI Boost (DirectML, OpenVINO, Windows ML, ONNX RT, WebNN), 36 TOPs (total), 13 TOPs (NPU), 8 TOPs (GPU)
- RAM: 128 GB, DDR5
- Screen: 18" WQXGA 2560 x 1600

### Software
- Windows 11 Pro x64
- Node.js 20 LTS (v20.x)
- pnpm 10
- LM Studio
- Podman Desktop (Docker-compatible socket — `docker` CLI proxies to Podman)
- WSL (Ubuntu)

## Linux Server

### Hardware
- HW: HP ENVY x360 model15-cp0002no, 2018 model
- CPU: Ryzen 5 2500U, quad-core (Zen architecture, base 2.0GHz, turbo up to 3.6GHz
- GPU: AMD Radeon Vega 8 iGPU (integrated)
- NPU: none
- RAM: 16 GB, DDR4
- Screen: 15.6" Full HD IPS, touchscreen convertible


### Software
- Ubuntu Desktop 24.04
- Docker

## Wi-Fi Router
- Gigabit Ethernet
- OpenVPN server (Developer Laptop can get access to local network from outside home-office)
## Telegram Bot (Feature 009) Local Run

From repository root:

```bash
pnpm install
pnpm --filter @finsight/telegram-bot typecheck
pnpm --filter @finsight/telegram-bot dev
```

Required environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_INTERNAL_TOKEN`
- `TELEGRAM_API_ACCESS_TOKEN`
- `REDIS_URL`
- `API_BASE_URL` (optional, defaults to `http://api:3000`)

## Admin Dashboard (Feature 010) Local Run

From repository root:

```bash
pnpm install
pnpm --filter @finsight/dashboard typecheck
pnpm --filter @finsight/dashboard dev
```

Optional environment variables:

- `VITE_API_BASE_URL` (defaults to empty string, same-origin)

Validation:

```bash
pnpm --filter @finsight/dashboard lint
pnpm --filter @finsight/dashboard test -- --pool=threads
```
## Seed & Infrastructure (Feature 011)

From repository root:

```bash
pnpm install
pnpm seed:run
pnpm validate:011:parity
pnpm validate:011:env
pnpm validate:011:ci
pnpm validate:011:pulumi
```

Required environment variables for deploy-capable paths:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH` (optional, defaults to `/opt/finsight`)
- `HEALTHCHECK_URLS` (comma-separated post-deploy targets)

Deployment helper usage:

```bash
pnpm deploy:remote
pnpm logs:remote -- api
```
