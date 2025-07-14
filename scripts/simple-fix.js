#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

async function addItem(boardId, name, values = {}) {
  const mutation = `
    mutation {
      create_item (
        board_id: ${boardId},
        item_name: "${name}"
        ${Object.keys(values).length > 0 ? `, column_values: "${JSON.stringify(values).replace(/"/g, '\\"')}"` : ''}
      ) {
        id
        name
      }
    }
  `
  
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: mutation })
  })
  
  const result = await response.json()
  
  if (result.errors) {
    console.error(`Failed to create item ${name}:`, result.errors)
    return null
  }
  
  return result.data.create_item
}

async function main() {
  console.log('Screw the dropdowns, let\'s just start using the board!\n')
  
  const boardId = '9579058781'
  
  // Add some test items to start tracking
  console.log('Adding sample tasks...')
  
  await addItem(boardId, 'Set up monday-dev toolkit')
  await addItem(boardId, 'Create tasks & tickets system')
  await addItem(boardId, 'Test board workflow')
  
  console.log('\n✅ Board is ready to use!')
  console.log('Start logging your work and worry about dropdown values later')
  console.log('The important thing is building the habit')
}

main()
