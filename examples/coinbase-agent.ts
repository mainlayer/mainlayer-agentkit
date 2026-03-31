/**
 * Example: Coinbase AgentKit agent with Mainlayer payments plugin
 *
 * This example demonstrates how to create an AI agent that can:
 *   - Discover monetized resources on the Mainlayer platform
 *   - Pay for access to resources
 *   - Verify access before consuming a resource
 *   - Publish its own services as monetizable resources
 *
 * Prerequisites:
 *   1. Set MAINLAYER_API_KEY in your environment
 *   2. Set up a wallet provider (CDP or custom)
 *   3. npm install @coinbase/agentkit @mainlayer/agentkit
 */

import { AgentKit, CdpWalletProvider } from '@coinbase/agentkit'
import { HumanMessage } from '@langchain/core/messages'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { ChatAnthropic } from '@langchain/anthropic'
import { mainlayerActionProvider } from '@mainlayer/agentkit'

// ---------------------------------------------------------------------------
// Configuration — all secrets come from the environment
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function createAgent() {
  const mainlayerApiKey = requireEnv('MAINLAYER_API_KEY')
  const cdpApiKeyName = requireEnv('CDP_API_KEY_NAME')
  const cdpApiKeyPrivateKey = requireEnv('CDP_API_KEY_PRIVATE_KEY')
  const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY')

  // -- Wallet provider -------------------------------------------------------
  const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyName: cdpApiKeyName,
    apiKeyPrivateKey: cdpApiKeyPrivateKey,
    networkId: process.env.NETWORK_ID ?? 'base-mainnet',
  })

  // -- AgentKit with Mainlayer plugin ----------------------------------------
  const agentKit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      mainlayerActionProvider(mainlayerApiKey),
      // Add more action providers here as needed
    ],
  })

  // -- LangChain tool binding ------------------------------------------------
  const tools = agentKit.getActions()

  // -- LLM -------------------------------------------------------------------
  const model = new ChatAnthropic({
    model: 'claude-opus-4-5',
    apiKey: anthropicApiKey,
  }).bindTools(tools)

  // -- ReAct agent -----------------------------------------------------------
  const agent = createReactAgent({
    llm: model,
    tools,
    messageModifier: SYSTEM_PROMPT,
  })

  return agent
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are a capable AI agent integrated with Mainlayer — the payment platform for AI agents.

You have access to the following Mainlayer capabilities:
- mainlayer_discover: Browse available resources you can access
- mainlayer_check_access: Verify whether you already have access before paying
- mainlayer_pay: Pay for access to a resource
- mainlayer_create_resource: Publish your own services for other agents to purchase

Workflow guidelines:
1. Always check access before paying to avoid duplicate charges.
2. Discover resources before paying to understand what's available.
3. When creating resources, use clear names and accurate pricing.
4. Handle payment errors gracefully and inform the user.

You are helpful, efficient, and always confirm successful transactions.
`.trim()

// ---------------------------------------------------------------------------
// Demo scenarios
// ---------------------------------------------------------------------------

async function runDiscoverAndPay(agent: Awaited<ReturnType<typeof createAgent>>) {
  console.log('\n=== Scenario 1: Discover and pay for a resource ===\n')

  const response = await agent.invoke({
    messages: [
      new HumanMessage(
        'Please discover available Mainlayer resources, then check if I have access ' +
        'to the first one (use payerId "agent-demo-001"). If I don\'t have access, pay for it.',
      ),
    ],
  })

  const lastMessage = response.messages[response.messages.length - 1]
  console.log('Agent response:', lastMessage.content)
}

async function runCreateResource(agent: Awaited<ReturnType<typeof createAgent>>) {
  console.log('\n=== Scenario 2: Create a monetizable resource ===\n')

  const response = await agent.invoke({
    messages: [
      new HumanMessage(
        'Create a new Mainlayer resource called "Sentiment Analysis API" ' +
        'priced at $0.05 per request with fee model "per_request". ' +
        'Add the description: "Real-time sentiment scoring for text inputs."',
      ),
    ],
  })

  const lastMessage = response.messages[response.messages.length - 1]
  console.log('Agent response:', lastMessage.content)
}

async function runSearchResources(agent: Awaited<ReturnType<typeof createAgent>>) {
  console.log('\n=== Scenario 3: Search for specific resources ===\n')

  const response = await agent.invoke({
    messages: [
      new HumanMessage(
        'Search for Mainlayer resources related to "NLP" and show me the top 5 results ' +
        'with their prices.',
      ),
    ],
  })

  const lastMessage = response.messages[response.messages.length - 1]
  console.log('Agent response:', lastMessage.content)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Initializing Coinbase AgentKit with Mainlayer plugin...')

  let agent: Awaited<ReturnType<typeof createAgent>>
  try {
    agent = await createAgent()
    console.log('Agent ready.')
  } catch (err) {
    console.error('Failed to initialize agent:', err)
    process.exit(1)
  }

  // Run demo scenarios sequentially
  await runDiscoverAndPay(agent)
  await runCreateResource(agent)
  await runSearchResources(agent)

  console.log('\nAll scenarios complete.')
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
