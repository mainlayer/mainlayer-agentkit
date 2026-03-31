/**
 * Monetized Agent Example
 *
 * Demonstrates how to use the Mainlayer AgentKit plugin to:
 * 1. Create a paid resource representing an API or service
 * 2. Check whether a payer has access
 * 3. Track earnings via revenue analytics
 *
 * Usage:
 *   export MAINLAYER_API_KEY="ml_..."
 *   export ANTHROPIC_API_KEY="your-anthropic-key"
 *   npx tsx examples/monetized-agent.ts
 */

import { Anthropic } from '@anthropic-ai/sdk'
import { MainlayerClient } from '@mainlayer/agentkit'

async function main() {
  const apiKey = process.env.MAINLAYER_API_KEY
  if (!apiKey) {
    throw new Error('MAINLAYER_API_KEY environment variable is required')
  }

  const client = new MainlayerClient(apiKey)

  console.log('=== Monetized Agent Example ===\n')

  // -----------------------------------------------------------------------
  // Step 1: Create a paid resource
  // -----------------------------------------------------------------------
  console.log('📦 Creating a paid resource...')

  try {
    const resource = await client.createResource({
      name: 'Weather Forecast API',
      priceUsd: 0.05,
      feeModel: 'per_request',
      description: 'Premium 7-day weather forecasts with confidence intervals',
    })

    console.log(`✓ Resource created: ${resource.name}`)
    console.log(`  Resource ID: ${resource.id}`)
    console.log(`  Price: $${resource.priceUsd} per request`)
    console.log(`  Fee Model: ${resource.feeModel}\n`)

    const resourceId = resource.id

    // -----------------------------------------------------------------------
    // Step 2: Check access for a buyer
    // -----------------------------------------------------------------------
    console.log('🔐 Checking access for buyer...')

    const buyerId = 'agent-buyer-001'
    const access = await client.checkAccess(resourceId, buyerId)

    console.log(`✓ Access check result:`)
    console.log(`  Resource: ${resourceId}`)
    console.log(`  Buyer: ${buyerId}`)
    console.log(`  Has Access: ${access.hasAccess}`)
    if (access.expiresAt) {
      console.log(`  Expires At: ${access.expiresAt}`)
    }
    console.log()

    // -----------------------------------------------------------------------
    // Step 3: Simulate access verification
    // -----------------------------------------------------------------------
    console.log('💳 Processing simulated payment...')

    if (!access.hasAccess) {
      console.log(`  Buyer lacks access. Would normally purchase via: `)
      console.log(`  client.payForResource("${resourceId}", "${buyerId}")`)
      console.log()
    }

    // -----------------------------------------------------------------------
    // Step 4: Discover the resource
    // -----------------------------------------------------------------------
    console.log('🔍 Discovering resources on Mainlayer marketplace...')

    const discovered = await client.discoverResources({
      query: 'Weather',
      limit: 5,
    })

    console.log(`✓ Found ${discovered.length} resource(s):`)
    discovered.forEach((res) => {
      console.log(`  - ${res.name} (${res.id}): $${res.priceUsd} ${res.feeModel}`)
    })
    console.log()

    // -----------------------------------------------------------------------
    // Step 5: Use Anthropic for multi-turn agent conversation
    // -----------------------------------------------------------------------
    console.log('🤖 Running agent with Claude...')

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are a weather forecast monetization assistant. You have access
to a weather API resource that you can offer to users. Your job is to:
1. Describe the weather forecast service
2. Explain the pricing ($0.05 per forecast)
3. Help users understand its value proposition

Always be helpful and professional.`

    const userMessage = 'Tell me about your weather forecast service and how much it costs.'

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    })

    console.log('\n📧 Agent Response:')
    if (response.content[0].type === 'text') {
      console.log(response.content[0].text)
    }
    console.log()
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error:', err.message)
    } else {
      console.error('Unexpected error:', err)
    }
    process.exit(1)
  }
}

main()
