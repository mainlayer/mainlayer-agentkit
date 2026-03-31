# @mainlayer/agentkit

Mainlayer payments plugin for [Coinbase AgentKit](https://github.com/coinbase/agentkit). Enables AI agents to pay for resources, verify access, discover available services, and monetize their own capabilities — all through a clean, type-safe action-provider interface.

**Key Features:**
- `mainlayer_pay` — Purchase access to paid resources in a single action
- `mainlayer_check_access` — Verify entitlements before consuming content
- `mainlayer_discover` — Browse available resources with filtering and pagination
- `mainlayer_create_resource` — Publish new monetizable services
- Full TypeScript support with comprehensive type definitions
- 12+ unit tests with 100% action provider coverage
- Production-ready error handling and network resilience

## Installation

```bash
npm install @mainlayer/agentkit @coinbase/agentkit
```

## Quick Start

```typescript
import { AgentKit } from '@coinbase/agentkit'
import { mainlayerActionProvider } from '@mainlayer/agentkit'

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    mainlayerActionProvider(process.env.MAINLAYER_API_KEY!),
  ],
})
```

## Available Actions

| Action | Description |
|---|---|
| `mainlayer_pay` | Pay for access to a Mainlayer resource |
| `mainlayer_check_access` | Verify whether a payer has current access to a resource |
| `mainlayer_discover` | Browse available resources with optional search and pagination |
| `mainlayer_create_resource` | Publish a new monetizable resource |

## Action Reference

### `mainlayer_pay`

Pay for access to a resource. Returns payment confirmation including payment ID and amount charged.

```
Input:
  resourceId  string  — ID of the resource to purchase
  payerId     string  — ID of the payer (agent or user)
```

### `mainlayer_check_access`

Check whether a payer currently has access to a resource, and when that access expires.

```
Input:
  resourceId  string  — ID of the resource
  payerId     string  — ID of the payer to check
```

### `mainlayer_discover`

Discover resources available on Mainlayer, with optional filtering.

```
Input:
  query   string  (optional) — Search term to filter resources
  limit   number  (optional) — Max results to return (1–100)
```

### `mainlayer_create_resource`

Publish a new service as a monetizable Mainlayer resource.

```
Input:
  name         string  — Display name for the resource
  priceUsd     number  — Price in USD
  feeModel     string  — Pricing model, e.g. "per_request" or "subscription_monthly"
  description  string  (optional) — Human-readable description
```

## Direct Client Usage

The `MainlayerClient` class is also exported for use outside of AgentKit:

```typescript
import { MainlayerClient } from '@mainlayer/agentkit'

const client = new MainlayerClient(process.env.MAINLAYER_API_KEY!)

// Discover resources
const resources = await client.discoverResources({ query: 'NLP', limit: 10 })

// Pay for a resource
const payment = await client.payForResource('res_abc', 'my-agent-id')

// Check access
const access = await client.checkAccess('res_abc', 'my-agent-id')

// Create a resource
const resource = await client.createResource({
  name: 'My Analysis Service',
  priceUsd: 0.10,
  feeModel: 'per_request',
  description: 'Text classification at scale',
})
```

## Error Handling

API errors are surfaced as `MainlayerApiError` instances:

```typescript
import { MainlayerApiError } from '@mainlayer/agentkit'

try {
  await client.payForResource(resourceId, payerId)
} catch (err) {
  if (err instanceof MainlayerApiError) {
    console.error(`HTTP ${err.status}: ${err.message}`)
  }
}
```

Action methods (used by AgentKit) always return a JSON string and never throw — errors are embedded in the returned object under the `error` key.

## Examples

| File | Description |
|------|-------------|
| `examples/coinbase-agent.ts` | Complete ReAct agent paying for resources and monetizing services |
| `examples/monetized-agent.ts` | Agent that publishes a paid API and checks access |
| `examples/earning-agent.ts` | Agent that discovers premium services and purchases them |

Run any example:

```bash
MAINLAYER_API_KEY=your-key \
CDP_API_KEY_NAME=your-cdp-key-name \
CDP_API_KEY_PRIVATE_KEY=your-cdp-private-key \
ANTHROPIC_API_KEY=your-anthropic-key \
npx tsx examples/coinbase-agent.ts
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck
```

## API

Base URL: `https://api.mainlayer.fr`

Authentication: `Authorization: Bearer <api_key>`

## License

MIT
