#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Board IDs from our schema mapping
const ACCOUNTS_BOARD = '9161287533'
const PROD_DEALS_BOARD = '9384243852'
const PRODUCTION_BOARD = '9304930311'
const BULK_BATCH_BOARD = '8768285252'
const EPO_BOARDS = [
  '9387127195', // EPOs - Ingredients
  '9454447162', // EPOs - Materials  
  '9454441691'  // EPOs - External Purchase Orders
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

async function getBoardItems(boardId, boardName) {
  console.log(`📊 Getting ${boardName} items...`)
  
  const query = `
    query {
      boards(ids: [${boardId}]) {
        name
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

function findItemsContaining(items, searchTerms) {
  return items.filter(item => 
    searchTerms.some(term => 
      item.name.toLowerCase().includes(term.toLowerCase())
    )
  )
}

function getConnectedItemIds(item, columnTitle) {
  const column = item.column_values.find(cv => 
    cv.column.title.toLowerCase().includes(columnTitle.toLowerCase())
  )
  
  if (!column || !column.value || column.value === 'null') {
    return []
  }
  
  try {
    const value = JSON.parse(column.value)
    if (value.linkedPulseIds) {
      return value.linkedPulseIds.map(id => id.linkedPulseId)
    }
    if (Array.isArray(value)) {
      return value.map(item => item.id || item)
    }
    if (value.ids) {
      return value.ids
    }
  } catch (e) {
    // Value might not be JSON
  }
  
  return []
}

function showItemDetails(item, boardName, indent = '') {
  console.log(`${indent}📋 ${boardName}: ${item.name} (ID: ${item.id})`)
  
  // Show key columns
  const keyColumns = ['status', 'stage', 'owners', 'assignee', 'deal value', 'purchasing deadline', 'run date']
  
  item.column_values.forEach(cv => {
    if (cv.text && cv.text.trim() && cv.text !== 'null') {
      const isKey = keyColumns.some(key => cv.column.title.toLowerCase().includes(key))
      if (isKey) {
        console.log(`${indent}   ${cv.column.title}: ${cv.text}`)
      }
    }
  })
}

async function main() {
  console.log('🔍 TRACING BRICKELL → EMULSIFYING WAX NF STATUS...\n')
  
  // 1. Find Brickell account
  const accounts = await getBoardItems(ACCOUNTS_BOARD, 'Accounts')
  const brickellAccounts = findItemsContaining(accounts.items_page.items, ['brickell'])
  
  console.log('🏢 BRICKELL ACCOUNTS FOUND:')
  brickellAccounts.forEach(account => showItemDetails(account, 'Accounts'))
  
  if (brickellAccounts.length === 0) {
    console.log('❌ No Brickell accounts found!')
    return
  }
  
  // 2. Follow connections to Prod Deals
  console.log('\n🔗 FOLLOWING CONNECTIONS TO PROD DEALS...')
  
  const prodDeals = await getBoardItems(PROD_DEALS_BOARD, 'Prod Deals')
  const brickellDeals = findItemsContaining(prodDeals.items_page.items, ['brickell'])
  
  console.log('\n📝 BRICKELL PROD DEALS:')
  brickellDeals.forEach(deal => showItemDetails(deal, 'Prod Deals'))
  
  // 3. Follow to Production
  console.log('\n🔗 FOLLOWING TO PRODUCTION...')
  
  const production = await getBoardItems(PRODUCTION_BOARD, 'Production')
  const brickellProduction = findItemsContaining(production.items_page.items, ['brickell'])
  
  console.log('\n🏭 BRICKELL PRODUCTION ITEMS:')
  brickellProduction.forEach(prod => showItemDetails(prod, 'Production', '  '))
  
  // 4. Follow to Bulk Batches
  console.log('\n🔗 FOLLOWING TO BULK BATCHES...')
  
  const bulkBatches = await getBoardItems(BULK_BATCH_BOARD, 'Bulk Batch Traceability')
  const brickellBatches = findItemsContaining(bulkBatches.items_page.items, ['brickell'])
  
  console.log('\n🧪 BRICKELL BULK BATCHES:')
  brickellBatches.forEach(batch => showItemDetails(batch, 'Bulk Batches', '    '))
  
  // 5. Search ALL EPO boards for emulsifying wax
  console.log('\n🔗 SEARCHING ALL EPO BOARDS FOR EMULSIFYING WAX...')
  
  const emulsifyingWaxItems = []
  
  for (let i = 0; i < EPO_BOARDS.length; i++) {
    const boardId = EPO_BOARDS[i]
    const epoBoard = await getBoardItems(boardId, `EPO Board ${i + 1}`)
    
    const emulsifyingItems = findItemsContaining(epoBoard.items_page.items, ['emulsifying', 'wax'])
    
    console.log(`\n🛒 ${epoBoard.name} - Emulsifying items found: ${emulsifyingItems.length}`)
    
    emulsifyingItems.forEach(item => {
      emulsifyingWaxItems.push({ ...item, boardName: epoBoard.name })
      showItemDetails(item, epoBoard.name, '      ')
      
      // Show connection columns to see if linked to Brickell
      const connectionColumns = item.column_values.filter(cv => 
        cv.column.title.toLowerCase().includes('production') ||
        cv.column.title.toLowerCase().includes('deal') ||
        cv.column.title.toLowerCase().includes('batch') ||
        cv.column.title.toLowerCase().includes('link')
      )
      
      if (connectionColumns.length > 0) {
        console.log('        🔗 Connections:')
        connectionColumns.forEach(cv => {
          if (cv.text && cv.text.trim() && cv.text !== 'null') {
            console.log(`           ${cv.column.title}: ${cv.text}`)
          }
        })
      }
    })
  }
  
  // 6. Summary analysis
  console.log('\n' + '='.repeat(60))
  console.log('📊 BRICKELL PURCHASING PIPELINE SUMMARY')
  console.log('='.repeat(60))
  
  console.log(`🏢 Accounts: ${brickellAccounts.length}`)
  console.log(`📝 Prod Deals: ${brickellDeals.length}`)
  console.log(`🏭 Production Items: ${brickellProduction.length}`)
  console.log(`🧪 Bulk Batches: ${brickellBatches.length}`)
  console.log(`🛒 Emulsifying Wax Items Found: ${emulsifyingWaxItems.length}`)
  
  // 7. Check for broken links
  console.log('\n🔍 PIPELINE ANALYSIS:')
  
  if (brickellDeals.length === 0 && brickellAccounts.length > 0) {
    console.log('⚠️  Accounts exist but no Prod Deals found - check account → deal links')
  }
  
  if (brickellProduction.length === 0 && brickellDeals.length > 0) {
    console.log('⚠️  Prod Deals exist but no Production items - check deal → production links')
  }
  
  if (brickellBatches.length === 0 && brickellProduction.length > 0) {
    console.log('⚠️  Production items exist but no Bulk Batches - check production → batch links')
  }
  
  if (emulsifyingWaxItems.length > 0) {
    console.log('\n🎯 EMULSIFYING WAX STATUS:')
    emulsifyingWaxItems.forEach(item => {
      const statusColumn = item.column_values.find(cv => 
        cv.column.title.toLowerCase().includes('status')
      )
      const status = statusColumn?.text || 'No Status'
      console.log(`   ${item.name}: ${status} (${item.boardName})`)
    })
  } else {
    console.log('❌ No emulsifying wax items found in any EPO board')
  }
  
  // 8. Next steps
  console.log('\n💡 NEXT STEPS:')
  console.log('1. Check why items aren\'t connected via board relations')
  console.log('2. Verify emulsifying wax is in the correct EPO board')
  console.log('3. Check if items are linked by different naming patterns')
  console.log('4. Consider manual linking or bulk linking script')
}

main()
