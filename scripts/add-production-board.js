#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

const MONDAY_API_URL = 'https://api.monday.com/v2'
const PRODUCTION_BOARD_ID = '9304930311'

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
  console.log('Adding Production board to local database...\n')
  
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Get board info
  const query = `
    query {
      boards(ids: [${PRODUCTION_BOARD_ID}]) {
        id
        name
        state
        items_count
        workspace {
          id
          name
        }
      }
    }
  `
  
  const { boards } = await queryMonday(query)
  
  if (boards.length === 0) {
    console.error('Board not found! Check the ID.')
    await sql.end()
    return
  }
  
  const board = boards[0]
  const workspace = board.workspace
  
  console.log(`Found board: ${board.name}`)
  console.log(`Workspace: ${workspace.name} (${workspace.id})`)
  console.log(`Items: ${board.items_count}`)
  
  // Add workspace if it doesn't exist
  await sql`
    INSERT INTO workspaces (id, name) 
    VALUES (${workspace.id}, ${workspace.name})
    ON CONFLICT (id) DO NOTHING
  `
  
  // Add board
  await sql`
    INSERT INTO boards (id, workspace_id, name, state, items_count)
    VALUES (${board.id}, ${workspace.id}, ${board.name}, ${board.state}, ${board.items_count || 0})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      state = EXCLUDED.state,
      items_count = EXCLUDED.items_count
  `
  
  console.log('\n✅ Added to local database!')
  
  // Show updated workspace summary
  const results = await sql`
    SELECT w.name as workspace_name, COUNT(b.id) as board_count
    FROM workspaces w
    LEFT JOIN boards b ON w.id = b.workspace_id
    GROUP BY w.name
    ORDER BY w.name
  `
  
  console.log('\nUpdated workspace summary:')
  results.forEach(r => console.log(`  ${r.workspace_name}: ${r.board_count} boards`))
  
  await sql.end()
}

main()
