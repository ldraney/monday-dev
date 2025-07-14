#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Just the workspaces you want
const WORKSPACE_IDS = [
  '11007618', // CRM
  '10142622', // Production 2025
  '9736208',  // Lab
  '11346231'  // VRM - Purchasing
]

async function queryMonday(query, variables = {}) {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })
  
  const result = await response.json()
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors)
    process.exit(1)
  }
  
  return result.data
}

async function main() {
  console.log('Getting boards for key workspaces...\n')
  
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Create tables
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    )
  `
  
  await sql`
    CREATE TABLE IF NOT EXISTS boards (
      id VARCHAR(50) PRIMARY KEY,
      workspace_id VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      state VARCHAR(20),
      items_count INTEGER
    )
  `
  
  for (const workspaceId of WORKSPACE_IDS) {
    console.log(`Getting boards for workspace ${workspaceId}...`)
    
    const query = `
      query {
        boards(workspace_ids: [${workspaceId}], limit: 50) {
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
    
    if (boards.length > 0) {
      const workspace = boards[0].workspace
      
      // Save workspace
      await sql`
        INSERT INTO workspaces (id, name) 
        VALUES (${workspace.id}, ${workspace.name})
        ON CONFLICT (id) DO NOTHING
      `
      
      // Save boards
      for (const board of boards) {
        await sql`
          INSERT INTO boards (id, workspace_id, name, state, items_count)
          VALUES (${board.id}, ${board.workspace.id}, ${board.name}, ${board.state}, ${board.items_count || 0})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            state = EXCLUDED.state,
            items_count = EXCLUDED.items_count
        `
      }
      
      console.log(`  ${workspace.name}: ${boards.length} boards`)
    }
  }
  
  // Show what we got
  const results = await sql`
    SELECT w.name as workspace_name, COUNT(b.id) as board_count
    FROM workspaces w
    LEFT JOIN boards b ON w.id = b.workspace_id
    GROUP BY w.name
  `
  
  console.log('\nDone:')
  results.forEach(r => console.log(`  ${r.workspace_name}: ${r.board_count} boards`))
  
  await sql.end()
}

main()
