#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

async function createBoard() {
  const mutation = `
    mutation {
      create_board (
        board_name: "Lucas - Tasks & Tickets",
        board_kind: public,
        workspace_id: 11007618
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
    console.error('Failed to create board:', result.errors)
    return null
  }
  
  return result.data.create_board
}

async function addColumns(boardId) {
  const columns = [
    { title: "Type", type: "dropdown", settings: `{"values":[{"id":1,"value":"Task"},{"id":2,"value":"Ticket"}]}` },
    { title: "Description", type: "text" },
    { title: "Status", type: "dropdown", settings: `{"values":[{"id":1,"value":"Todo"},{"id":2,"value":"In Progress"},{"id":3,"value":"Blocked"},{"id":4,"value":"Done"}]}` },
    { title: "Priority", type: "dropdown", settings: `{"values":[{"id":1,"value":"Today"},{"id":2,"value":"This Week"},{"id":3,"value":"This Month"},{"id":4,"value":"Someday"}]}` },
    { title: "Time Estimate", type: "text" },
    { title: "Time Spent", type: "text" },
    { title: "Related Boards", type: "text" },
    { title: "Related Tickets", type: "text" },
    { title: "Date Added", type: "date" },
    { title: "Notes", type: "long_text" }
  ]
  
  for (const column of columns) {
    const mutation = `
      mutation {
        create_column (
          board_id: ${boardId},
          title: "${column.title}",
          column_type: ${column.type}
          ${column.settings ? `, settings_str: "${column.settings.replace(/"/g, '\\"')}"` : ''}
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
      body: JSON.stringify({ query: mutation })
    })
    
    const result = await response.json()
    
    if (result.errors) {
      console.error(`Failed to create column ${column.title}:`, result.errors)
    } else {
      console.log(`✅ Created column: ${column.title}`)
    }
  }
}

async function main() {
  console.log("Creating Lucas - Tasks & Tickets board...\n")
  
  const board = await createBoard()
  
  if (!board) {
    console.error("Failed to create board")
    return
  }
  
  console.log(`✅ Created board: ${board.name} (ID: ${board.id})\n`)
  
  console.log("Adding columns...")
  await addColumns(board.id)
  
  console.log(`\n🎯 Your personal task/ticket board is ready!`)
  console.log(`Board ID: ${board.id}`)
  console.log(`\nUse this to:`)
  console.log(`• Track daily tasks vs bigger tickets`)
  console.log(`• Record time estimates vs actual time`)
  console.log(`• Note which boards you touch`)
  console.log(`• Build the habit before rolling out to others`)
  console.log(`\nOnce you prove this works for you, Paul will want it too!`)
}

main()
