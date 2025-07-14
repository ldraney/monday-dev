#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'
const ACCOUNTS_BOARD_ID = '9161287533'

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

async function main() {
  console.log('Getting Accounts board structure and data...\n')
  
  const query = `
    query {
      boards(ids: [${ACCOUNTS_BOARD_ID}]) {
        columns {
          id
          title
          type
          settings_str
        }
        items_page(limit: 100) {
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
  const board = boards[0]
  
  console.log('=== ACCOUNTS BOARD COLUMNS ===')
  board.columns.forEach(col => {
    console.log(`${col.title} (${col.type})`)
    if (col.settings_str) {
      try {
        const settings = JSON.parse(col.settings_str)
        if (settings.values) {
          console.log(`  Options: ${settings.values.map(v => v.value).join(', ')}`)
        }
      } catch (e) {
        // Settings might not be JSON
      }
    }
  })
  
  console.log('\n=== ACCOUNT ANALYSIS ===')
  
  // Group accounts by key columns
  const accounts = board.items_page.items
  
  // Find assigned person column
  const assignedColumn = board.columns.find(c => 
    c.title.toLowerCase().includes('assign') || 
    c.title.toLowerCase().includes('owner') ||
    c.title.toLowerCase().includes('manager')
  )
  
  // Find account type/group column
  const typeColumn = board.columns.find(c => 
    c.title.toLowerCase().includes('type') || 
    c.title.toLowerCase().includes('group') ||
    c.title.toLowerCase().includes('category')
  )
  
  // Find status column
  const statusColumn = board.columns.find(c => 
    c.title.toLowerCase().includes('status')
  )
  
  console.log(`Total accounts: ${accounts.length}`)
  
  if (assignedColumn) {
    console.log(`\n=== BY ASSIGNED PERSON (${assignedColumn.title}) ===`)
    const byPerson = {}
    accounts.forEach(account => {
      const personValue = account.column_values.find(cv => cv.column.id === assignedColumn.id)
      const person = personValue?.text || 'Unassigned'
      if (!byPerson[person]) byPerson[person] = []
      byPerson[person].push(account.name)
    })
    
    Object.entries(byPerson).forEach(([person, accountNames]) => {
      console.log(`${person}: ${accountNames.length} accounts`)
      if (accountNames.length <= 10) {
        accountNames.forEach(name => console.log(`  - ${name}`))
      } else {
        console.log(`  - ${accountNames.slice(0, 5).join(', ')} ... and ${accountNames.length - 5} more`)
      }
    })
  }
  
  if (typeColumn) {
    console.log(`\n=== BY ACCOUNT TYPE (${typeColumn.title}) ===`)
    const byType = {}
    accounts.forEach(account => {
      const typeValue = account.column_values.find(cv => cv.column.id === typeColumn.id)
      const type = typeValue?.text || 'Uncategorized'
      if (!byType[type]) byType[type] = []
      byType[type].push(account.name)
    })
    
    Object.entries(byType).forEach(([type, accountNames]) => {
      console.log(`${type}: ${accountNames.length} accounts`)
    })
  }
  
  if (statusColumn) {
    console.log(`\n=== BY STATUS (${statusColumn.title}) ===`)
    const byStatus = {}
    accounts.forEach(account => {
      const statusValue = account.column_values.find(cv => cv.column.id === statusColumn.id)
      const status = statusValue?.text || 'No Status'
      if (!byStatus[status]) byStatus[status] = []
      byStatus[status].push(account.name)
    })
    
    Object.entries(byStatus).forEach(([status, accountNames]) => {
      console.log(`${status}: ${accountNames.length} accounts`)
    })
  }
  
  console.log('\n=== SAMPLE ACCOUNTS (first 10) ===')
  accounts.slice(0, 10).forEach(account => {
    console.log(`\n${account.name}:`)
    account.column_values.forEach(cv => {
      if (cv.text && cv.text.trim()) {
        console.log(`  ${cv.column.title}: ${cv.text}`)
      }
    })
  })
}

main()
