#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Priority accounts to focus on
const PRIORITY_ACCOUNTS = [
  'moo elixir', 'evre', 'brickell', 'captain blankenship', 
  'beauty heroes', 'primally pure', 'earth harbor', 'pure earth labs'
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
    return null
  }
  
  return result.data
}

async function getAllBoardItems() {
  console.log('📊 Getting fresh data for all boards (will cache locally after this run)...')
  
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Get board IDs from our local schema
  const boards = await sql`
    SELECT id, name, purpose 
    FROM board_schemas 
    WHERE purpose IN ('accounts', 'prod_deals', 'production', 'bulk_batch', 'epo_ingredients', 'epo_materials', 'epo_other')
  `
  
  const allData = {}
  
  for (const board of boards) {
    console.log(`  📡 ${board.name} (API call - will cache next time)...`)
    
    const query = `
      query {
        boards(ids: [${board.id}]) {
          items_page(limit: 500) {
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
    
    const data = await queryMonday(query)
    if (data && data.boards && data.boards[0]) {
      allData[board.purpose] = {
        boardId: board.id,
        boardName: board.name,
        items: data.boards[0].items_page.items
      }
      
      // TODO: Cache items to local database for faster future runs
      console.log(`    ✅ ${data.boards[0].items_page.items.length} items loaded`)
    }
  }
  
  await sql.end()
  return allData
}

function findItemsContaining(items, searchTerms) {
  return items.filter(item => 
    searchTerms.some(term => 
      item.name.toLowerCase().includes(term.toLowerCase())
    )
  )
}

function getItemStatus(item) {
  const statusColumn = item.column_values.find(cv => 
    cv.column.title.toLowerCase().includes('status') ||
    cv.column.title.toLowerCase().includes('stage')
  )
  return statusColumn?.text || 'No Status'
}

function getBoardUrl(boardId, itemId = null) {
  const baseUrl = `https://earthharbor.monday.com/boards/${boardId}`
  return itemId ? `${baseUrl}/pulses/${itemId}` : baseUrl
}

function searchIngredients(allData, searchTerms) {
  const found = []
  
  // Search across all available EPO boards (find them dynamically)
  const epoBoards = Object.keys(allData).filter(key => key.includes('epo'))
  
  epoBoards.forEach(boardType => {
    if (allData[boardType]) {
      const matches = allData[boardType].items.filter(item => 
        searchTerms.some(term => 
          item.name.toLowerCase().includes(term.toLowerCase())
        )
      )
      
      matches.forEach(item => {
        found.push({
          ...item,
          boardName: allData[boardType].boardName,
          boardId: allData[boardType].boardId,
          boardType
        })
      })
    }
  })
  
  return found
}

async function main() {
  console.log('🚀 PURE EARTH LABS - COMPLETE PURCHASING DASHBOARD\n')
  console.log('📡 Getting fresh data from Monday.com (one-time API calls)')
  console.log('💾 Next version will use cached local data for instant results\n')
  
  const allData = await getAllBoardItems()
  
  console.log('\n📊 BOARD SUMMARY:')
  Object.entries(allData).forEach(([purpose, data]) => {
    const url = getBoardUrl(data.boardId)
    console.log(`   ${data.boardName}: ${data.items.length} items`)
    console.log(`   🔗 ${url}`)
  })
  
  console.log('\n' + '='.repeat(80))
  console.log('🎯 PRIORITY ACCOUNTS PURCHASING STATUS')
  console.log('='.repeat(80))
  
  const accountSummary = []
  
  // Process each priority account
  for (const accountName of PRIORITY_ACCOUNTS) {
    console.log(`\n📋 ${accountName.toUpperCase()}:`)
    
    // Find account
    const accounts = findItemsContaining(allData.accounts?.items || [], [accountName])
    
    if (accounts.length === 0) {
      console.log('   ❌ Account not found')
      continue
    }
    
    const account = accounts[0]
    const accountUrl = getBoardUrl(allData.accounts.boardId, account.id)
    console.log(`   🏢 Account: ${account.name}`)
    console.log(`   🔗 ${accountUrl}`)
    
    // Find prod deals
    const prodDeals = findItemsContaining(allData.prod_deals?.items || [], [accountName])
    console.log(`   📝 Prod Deals: ${prodDeals.length}`)
    
    prodDeals.forEach(deal => {
      const dealUrl = getBoardUrl(allData.prod_deals.boardId, deal.id)
      const status = getItemStatus(deal)
      console.log(`      - ${deal.name}: ${status}`)
      console.log(`        🔗 ${dealUrl}`)
    })
    
    // Find production items
    const production = findItemsContaining(allData.production?.items || [], [accountName])
    console.log(`   🏭 Production: ${production.length}`)
    
    production.forEach(prod => {
      const prodUrl = getBoardUrl(allData.production.boardId, prod.id)
      const status = getItemStatus(prod)
      console.log(`      - ${prod.name}: ${status}`)
      console.log(`        🔗 ${prodUrl}`)
    })
    
    // Find bulk batches
    const batches = findItemsContaining(allData.bulk_batch?.items || [], [accountName])
    console.log(`   🧪 Bulk Batches: ${batches.length}`)
    
    batches.forEach(batch => {
      const batchUrl = getBoardUrl(allData.bulk_batch.boardId, batch.id)
      const status = getItemStatus(batch)
      console.log(`      - ${batch.name}: ${status}`)
      console.log(`        🔗 ${batchUrl}`)
    })
    
    // Summary for this account
    accountSummary.push({
      name: accountName,
      accounts: accounts.length,
      prodDeals: prodDeals.length,
      production: production.length,
      batches: batches.length,
      hasCompleteFlow: accounts.length > 0 && prodDeals.length > 0 && production.length > 0
    })
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🔍 INGREDIENT SEARCH - EMULSIFYING WAX')
  console.log('='.repeat(80))
  
  // Search for emulsifying wax with MUCH broader terms
  const emulsifyingTerms = [
    'emulsifying', 'wax', 'cetearyl', 'emulsifier', 'polawax', 
    'BTMS', 'conditioning', 'stearyl', 'cetyl', 'emulsi', 
    'wax nf', 'nf', 'conditioning wax', 'emulsify'
  ]
  
  const emulsifyingWaxItems = searchIngredients(allData, emulsifyingTerms)
  
  if (emulsifyingWaxItems.length > 0) {
    console.log(`\n✅ Found ${emulsifyingWaxItems.length} potential emulsifying wax items:`)
    
    emulsifyingWaxItems.forEach(item => {
      const status = getItemStatus(item)
      const itemUrl = getBoardUrl(item.boardId, item.id)
      console.log(`\n🛒 ${item.name}`)
      console.log(`   Board: ${item.boardName}`)
      console.log(`   Status: ${status}`)
      console.log(`   🔗 ${itemUrl}`)
      
      // Show any connections to clients
      const connectionColumns = item.column_values.filter(cv => 
        cv.text && cv.text.trim() && cv.text !== 'null' &&
        (cv.column.title.toLowerCase().includes('production') ||
         cv.column.title.toLowerCase().includes('deal') ||
         cv.column.title.toLowerCase().includes('batch') ||
         cv.column.title.toLowerCase().includes('link'))
      )
      
      if (connectionColumns.length > 0) {
        console.log('   🔗 Connected to:')
        connectionColumns.forEach(cv => {
          console.log(`      ${cv.column.title}: ${cv.text}`)
        })
      }
    })
  } else {
    console.log('\n❌ No emulsifying wax items found with search terms:')
    console.log(`   ${emulsifyingTerms.join(', ')}`)
    
    console.log('\n🔍 Manual investigation needed - check these EPO boards:')
    
    // Find all EPO boards dynamically
    const epoBoards = Object.keys(allData).filter(key => key.includes('epo'))
    
    epoBoards.forEach(boardType => {
      if (allData[boardType]) {
        const url = getBoardUrl(allData[boardType].boardId)
        console.log(`\n📋 ${allData[boardType].boardName} (${allData[boardType].items.length} items):`)
        console.log(`   🔗 ${url}`)
        
        // Show first 10 items as examples
        console.log('   Sample items:')
        allData[boardType].items.slice(0, 10).forEach(item => {
          console.log(`      - ${item.name}`)
        })
        if (allData[boardType].items.length > 10) {
          console.log(`      ... and ${allData[boardType].items.length - 10} more`)
        }
      }
    })
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('📈 OVERALL PURCHASING PIPELINE STATUS')
  console.log('='.repeat(80))
  
  const totalAccounts = accountSummary.length
  const accountsWithCompleteFlow = accountSummary.filter(a => a.hasCompleteFlow).length
  const totalProdDeals = accountSummary.reduce((sum, a) => sum + a.prodDeals, 0)
  const totalProduction = accountSummary.reduce((sum, a) => sum + a.production, 0)
  const totalBatches = accountSummary.reduce((sum, a) => sum + a.batches, 0)
  
  console.log(`\n📊 Summary:`)
  console.log(`   Priority Accounts: ${totalAccounts}`)
  console.log(`   Complete Flows: ${accountsWithCompleteFlow}`)
  console.log(`   Total Prod Deals: ${totalProdDeals}`)
  console.log(`   Total Production: ${totalProduction}`)
  console.log(`   Total Batches: ${totalBatches}`)
  console.log(`   Emulsifying Wax Items: ${emulsifyingWaxItems.length}`)
  
  console.log(`\n🎯 Pipeline Health: ${Math.round((accountsWithCompleteFlow / totalAccounts) * 100)}%`)
  
  // Show accounts needing attention
  const incompleteAccounts = accountSummary.filter(a => !a.hasCompleteFlow)
  if (incompleteAccounts.length > 0) {
    console.log(`\n⚠️  Accounts needing attention:`)
    incompleteAccounts.forEach(account => {
      console.log(`   ${account.name}: missing production or batches`)
    })
  }
  
  console.log('\n💡 QUICK INVESTIGATION LINKS:')
  console.log('   📋 All Boards: https://earthharbor.monday.com/')
  console.log('   🛒 EPO Ingredients: https://earthharbor.monday.com/boards/9387127195')
  console.log('   🔧 EPO Materials: https://earthharbor.monday.com/boards/9454447162') 
  console.log('   📦 EPO External: https://earthharbor.monday.com/boards/9454441691')
  
  console.log('\n🚀 NEXT STEPS:')
  console.log('1. Click EPO board links above to manually search for emulsifying wax')
  console.log('2. Check if items need to be linked via board relations')
  console.log('3. Run this dashboard daily to monitor purchasing pipeline health')
  console.log('4. Cache items data locally for instant future runs')
}

main()
