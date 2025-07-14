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
  console.log(`Active Project: ${workflowMap.current_session.active_project}`)
  console.log(`Status: ${workflowMap.current_session.status}`)
  currentStats.forEach(board => {
    console.log(`${board.name}: ${board.items_count} items`)
  })
  
  if (workflowMap.current_session.progress_so_far) {
    console.log('\nProgress:')
    workflowMap.current_session.progress_so_far.forEach(item => {
      console.log(`  ${item}`)
    })
  }
  
  console.log('\n=== COPY THIS FOR NEW AI CHATS ===')
  console.log('```json')
  console.log(JSON.stringify({
    context: workflowMap.ai_context.context_for_new_ai,
    role: workflowMap.role,
    current_project: workflowMap.current_session,
    purchasing_flow: workflowMap.purchasing_flow,
    core_boards: workflowMap.core_boards,
    priority_accounts: workflowMap.core_boards['9161287533']?.priority_accounts,
    ready_scripts: workflowMap.current_session.scripts_ready
  }, null, 2))
  console.log('```')
  
  console.log('\n=== QUICK HANDOFF SUMMARY ===')
  console.log(`"${workflowMap.ai_context.context_for_new_ai}"`)
  console.log(`\nIMMEDIATE TODO: ${workflowMap.current_session.immediate_todo[0]}`)
  console.log(`NEXT SCRIPT TO RUN: ${workflowMap.current_session.scripts_ready[0]}`)
}

main()
