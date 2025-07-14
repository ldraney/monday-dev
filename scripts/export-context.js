#!/usr/bin/env node

import 'dotenv/config'
import { readFileSync } from 'fs'

const MONDAY_API_URL = 'https://api.monday.com/v2'

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

async function getCurrentBoardStats(boardIds) {
  const query = `
    query {
      boards(ids: [${boardIds.join(', ')}]) {
        id
        name
        items_count
        workspace {
          name
        }
      }
    }
  `
  
  const data = await queryMonday(query)
  return data?.boards || []
}

async function main() {
  console.log('🤖 Exporting context for AI handoff...\n')
  
  // Load our workflow map
  const workflowMap = JSON.parse(readFileSync('workflow-map.json', 'utf8'))
  
  // Get current board stats
  const boardIds = Object.keys(workflowMap.core_boards)
  const currentStats = await getCurrentBoardStats(boardIds)
  
  // Create AI context export
  const aiContext = {
    ...workflowMap,
    export_timestamp: new Date().toISOString(),
    current_board_stats: currentStats.map(board => ({
      id: board.id,
      name: board.name,
      workspace: board.workspace.name,
      items_count: board.items_count,
      purpose: workflowMap.core_boards[board.id]?.purpose || 'Unknown'
    }))
  }
  
  console.log('=== AI CONTEXT EXPORT ===')
  console.log(JSON.stringify(aiContext, null, 2))
  console.log('\n=== QUICK SUMMARY ===')
  console.log(`Role: ${workflowMap.role}`)
  console.log(`Company: ${workflowMap.company}`)
  console.log(`Core boards: ${Object.keys(workflowMap.core_boards).length}`)
  console.log(`Priority accounts: ${workflowMap.core_boards['9161287533']?.priority_accounts?.length || 0}`)
  
  console.log('\n=== CURRENT STATUS ===')
  currentStats.forEach(board => {
    console.log(`${board.name}: ${board.items_count} items`)
  })
  
  console.log('\n=== COPY THIS FOR NEW AI CHATS ===')
  console.log('```json')
  console.log(JSON.stringify({
    role: workflowMap.role,
    focus: workflowMap.priority_focus,
    purchasing_flow: workflowMap.purchasing_flow,
    core_boards: workflowMap.core_boards,
    priority_accounts: workflowMap.core_boards['9161287533']?.priority_accounts
  }, null, 2))
  console.log('```')
}

main()
