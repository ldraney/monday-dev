#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Board IDs - CORRECTED
const ACCOUNTS_BOARD = '9161287533'
const PROD_DEALS_BOARD = '9384243852'
const PRODUCTION_BOARD = '9304930311' // Production (the real one)
const BULK_BATCH_BOARD = '8768285252'
const EPO_INGREDIENTS_BOARD = '9387127195'

// Priority accounts (Regular Clients + Iterations)
const PRIORITY_ACCOUNTS = [
  'Shopify - Earth Harbor',
  'Shopify - Pure Earth Labs', 
  'Earth Harbor & Resellers',
  'Moo Elixir & Co',
  'Evre Selfcare Limited',
  'Beauty Heroes',
  'Primally Pure',
  'Captain Blankenship',
  'Brickell Mens Products'
]

async function queryMonday(query) {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  })
  
  const result = await response.json()
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors)
    process.exit(1)
  }
  
  return result.data
}

async function getBoardData(boardId, boardName) {
  console.log(`Getting ${boardName} data...`)
  
  const query = `
    query {
      boards(ids: [${boardId}]) {
        name
        columns {
          id
          title
          type
        }
        items_page(limit: 200) {
          items {
            id
            name
            column_values {
              column {
                id
                title
              }
              text
              value
            }
          }
        }
      }
    }
  `
  
  const { boards } = await queryMonday(query)
  return boards[0]
}

async function main() {
  console.log('🔍 Tracing purchasing flow for priority accounts...\n')
  
  // Get all board data
  const accounts = await getBoardData(ACCOUNTS_BOARD, 'Accounts')
  const prodDeals = await getBoardData(PROD_DEALS_BOARD, 'Prod Deals')
  const production = await getBoardData(PRODUCTION_BOARD, 'Production')
  const batches = await getBoardData(BULK_BATCH_BOARD, 'Bulk Batch Traceability')
  const epos = await getBoardData(EPO_INGREDIENTS_BOARD, 'EPO - Ingredients')
  
  console.log('\n📊 BOARD SUMMARY:')
  console.log(`Accounts: ${accounts.items_page.items.length} items`)
  console.log(`Prod Deals: ${prodDeals.items_page.items.length} items`) 
  console.log(`Production: ${production.items_page.items.length} items`)
  console.log(`Bulk Batches: ${batches.items_page.items.length} items`)
  console.log(`EPO Ingredients: ${epos.items_page.items.length} items`)
  
  // Find priority accounts
  const priorityAccountItems = accounts.items_page.items.filter(item => 
    PRIORITY_ACCOUNTS.some(name => item.name.includes(name) || name.includes(item.name))
  )
  
  console.log(`\n🎯 PRIORITY ACCOUNTS FOUND: ${priorityAccountItems.length}`)
  priorityAccountItems.forEach(account => console.log(`  - ${account.name}`))
  
  console.log('\n🔗 FLOW ANALYSIS:')
  
  for (const account of priorityAccountItems) {
    console.log(`\n📋 ${account.name}:`)
    
    // Find prod deals column on accounts
    const prodDealsColumn = account.column_values.find(cv => 
      cv.column.title.toLowerCase().includes('prod deals')
    )
    
    if (prodDealsColumn && prodDealsColumn.text) {
      console.log(`  ✅ Has Prod Deal: ${prodDealsColumn.text}`)
      
      // Find matching prod deal
      const dealNames = prodDealsColumn.text.split(',').map(s => s.trim())
      const matchingDeals = prodDeals.items_page.items.filter(deal => 
        dealNames.some(name => deal.name.includes(name) || name.includes(deal.name))
      )
      
      if (matchingDeals.length > 0) {
        matchingDeals.forEach(deal => {
          console.log(`    📝 Deal: ${deal.name}`)
          
          // Check if deal has production items
          const prodColumn = deal.column_values.find(cv => 
            cv.column.title.toLowerCase().includes('production')
          )
          
          if (prodColumn && prodColumn.text) {
            console.log(`      ✅ Production linked: ${prodColumn.text}`)
          } else {
            console.log(`      ❌ No production link`)
          }
        })
      } else {
        console.log(`    ❌ Deal not found in Prod Deals board`)
      }
    } else {
      console.log(`  ❌ No Prod Deal linked`)
    }
    
    // Check EPO status 
    const epoMatches = epos.items_page.items.filter(epo => 
      epo.name.toLowerCase().includes(account.name.toLowerCase()) ||
      account.name.toLowerCase().includes(epo.name.toLowerCase())
    )
    
    if (epoMatches.length > 0) {
      console.log(`  🛒 EPO Ingredients (${epoMatches.length}):`)
      epoMatches.forEach(epo => {
        const statusColumn = epo.column_values.find(cv => 
          cv.column.title.toLowerCase().includes('status')
        )
        const status = statusColumn?.text || 'No Status'
        console.log(`    - ${epo.name}: ${status}`)
      })
    } else {
      console.log(`  ❌ No EPO ingredients found`)
    }
  }
  
  console.log('\n📈 PURCHASING BOTTLENECKS:')
  
  // Find EPOs that are stuck
  const stuckEpos = epos.items_page.items.filter(epo => {
    const statusColumn = epo.column_values.find(cv => 
      cv.column.title.toLowerCase().includes('status')
    )
    const status = statusColumn?.text?.toLowerCase() || ''
    return status.includes('pending') || status.includes('waiting') || status.includes('stuck') || status === ''
  })
  
  console.log(`${stuckEpos.length} EPOs may need attention:`)
  stuckEpos.slice(0, 10).forEach(epo => {
    const statusColumn = epo.column_values.find(cv => 
      cv.column.title.toLowerCase().includes('status')
    )
    const status = statusColumn?.text || 'No Status'
    console.log(`  - ${epo.name}: ${status}`)
  })
  
  if (stuckEpos.length > 10) {
    console.log(`  ... and ${stuckEpos.length - 10} more`)
  }
}

main()
