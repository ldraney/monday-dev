#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'
const BOARD_ID = '9579058781'

async function addDropdownColumn(boardId, title, values) {
  // First create the column
  const createMutation = `
    mutation {
      create_column (
        board_id: ${boardId},
        title: "${title}",
        column_type: dropdown
      ) {
        id
        title
      }
    }
  `
  
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: createMutation })
  })
  
  const result = await response.json()
  
  if (result.errors) {
    console.error(`Failed to create ${title}:`, result.errors)
    return null
  }
  
  const columnId = result.data.create_column.id
  console.log(`✅ Created ${title} column (${columnId})`)
  
  // Now change the column settings
  const settingsStr = JSON.stringify({
    values: values.map((value, index) => ({ id: index + 1, value }))
  })
  
  const updateMutation = `
    mutation {
      change_column_metadata (
        board_id: ${boardId},
        column_id: "${columnId}",
        column_property: "settings",
        value: "${settingsStr.replace(/"/g, '\\"')}"
      ) {
        id
      }
    }
  `
  
  const updateResponse = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: updateMutation })
  })
  
  const updateResult = await updateResponse.json()
  
  if (updateResult.errors) {
    console.error(`Failed to update ${title} settings:`, updateResult.errors)
  } else {
    console.log(`✅ Added dropdown values to ${title}`)
  }
  
  return columnId
}

async function main() {
  console.log('Fixing dropdown columns on Lucas board...\n')
  
  await addDropdownColumn(BOARD_ID, 'Type', ['Task', 'Ticket'])
  await addDropdownColumn(BOARD_ID, 'Status', ['Todo', 'In Progress', 'Blocked', 'Done'])
  await addDropdownColumn(BOARD_ID, 'Priority', ['Today', 'This Week', 'This Month', 'Someday'])
  
  console.log('\n🎯 All dropdown columns fixed!')
  console.log('Your board is now fully functional via API')
}

main()
