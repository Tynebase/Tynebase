#!/usr/bin/env python3
"""
RALPH Runner - Autonomous AI-to-AI Execution Orchestrator
Version: 2.0
Project: TyneBase Backend & Integration (Milestone 2 & 2.5)

This script manages the RALPH development loop state and provides
commands for the AI agent to track progress in Windsurf.

Usage:
    python ralph_runner.py status          # Show current state
    python ralph_runner.py next            # Get next task details
    python ralph_runner.py start <task_id> # Mark task as in progress
    python ralph_runner.py pass <task_id>  # Mark task as passed
    python ralph_runner.py fail <task_id>  # Mark task as failed/blocked
    python ralph_runner.py summary         # Generate progress summary
    python ralph_runner.py commit <msg>    # Record commit (doesn't run git)
    python ralph_runner.py mode <backend|integration>  # Switch mode
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

# File paths
SCRIPT_DIR = Path(__file__).parent
STATE_FILE = SCRIPT_DIR / "ralph_state.json"
SUMMARIES_DIR = SCRIPT_DIR / "execution_summaries"

# Mode-specific file paths (determined at runtime)
TASKS_FILE = None
TASKLIST_FILE = None


def get_mode():
    """Determine current mode from state file."""
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            state = json.load(f)
            return state.get('mode', 'integration')  # Default to integration
    except:
        return 'integration'  # Default to integration if state file doesn't exist


def set_file_paths(mode='integration'):
    """Set file paths based on mode."""
    global TASKS_FILE, TASKLIST_FILE
    
    if mode == 'backend':
        TASKS_FILE = SCRIPT_DIR / "PRD.json"
        TASKLIST_FILE = SCRIPT_DIR / "tasklist.md"
    else:  # integration mode
        TASKS_FILE = SCRIPT_DIR / "prd_integration.json"
        TASKLIST_FILE = SCRIPT_DIR / "tasklist_integration.md"


def load_state():
    """Load current RALPH state."""
    with open(STATE_FILE, 'r', encoding='utf-8') as f:
        state = json.load(f)
    
    # Ensure mode is set
    if 'mode' not in state:
        state['mode'] = 'integration'
    
    # Set file paths based on mode
    set_file_paths(state['mode'])
    
    return state


def save_state(state):
    """Save RALPH state."""
    state['last_updated'] = datetime.now().isoformat()
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2)


def load_tasks():
    """Load tasks from PRD file (mode-specific)."""
    if TASKS_FILE is None:
        set_file_paths(get_mode())
    
    if not TASKS_FILE.exists():
        print(f"\n❌ Tasks file not found: {TASKS_FILE}")
        print(f"   Current mode: {get_mode()}")
        print(f"   Run 'python ralph_runner.py mode <backend|integration>' to switch modes\n")
        sys.exit(1)
    
    with open(TASKS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_tasks(tasks_data):
    """Save tasks to PRD file (mode-specific)."""
    if TASKS_FILE is None:
        set_file_paths(get_mode())
    
    with open(TASKS_FILE, 'w', encoding='utf-8') as f:
        json.dump(tasks_data, f, indent=2)


def get_task_by_id(tasks_data, task_id):
    """Find a task by its ID."""
    for task in tasks_data['tasks']:
        if task['id'] == task_id:
            return task
    return None


def get_next_task(tasks_data):
    """Get the next pending task."""
    for task in tasks_data['tasks']:
        if not task.get('passes', False) and not task.get('blocked', False):
            # Skip deferred tasks (Phase 14)
            if 'Deferred' in task.get('action', ''):
                continue
            return task
    return None


def count_statistics(tasks_data):
    """Calculate task statistics."""
    stats = {
        'total_tasks': 0,
        'completed': 0,
        'in_progress': 0,
        'blocked': 0,
        'deferred': 0
    }
    for task in tasks_data['tasks']:
        if 'Deferred' in task.get('action', ''):
            stats['deferred'] += 1
            continue
        stats['total_tasks'] += 1
        if task.get('passes', False):
            stats['completed'] += 1
        elif task.get('blocked', False):
            stats['blocked'] += 1
        elif task.get('in_progress', False):
            stats['in_progress'] += 1
    return stats


def update_tasklist_md(state, current_task=None, action="update"):
    """Update the tasklist.md scratchpad."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    tasks_data = load_tasks()
    stats = count_statistics(tasks_data)
    
    # Build completed tasks list
    completed_list = []
    for task in tasks_data['tasks']:
        if task.get('passes', False):
            completed_list.append(f"- [x] **{task['id']}**: {task['title']}")
    
    current_section = "None"
    current_status = "Ready to begin"
    notes = "- Awaiting task assignment"
    blockers = "- None"
    next_steps = "- Begin next task"
    
    if current_task:
        current_section = f"{current_task['id']} - {current_task['title']}"
        current_status = "In Progress" if current_task.get('in_progress') else "Pending"
        notes = f"- Working on: {current_task['action']}"
        next_steps = f"- Complete {current_task['id']}"
        if current_task.get('blocked'):
            current_status = "BLOCKED"
            blockers = f"- Task {current_task['id']} requires supervisor review"
    
    mode = state.get('mode', 'integration')
    project_name = "TyneBase Frontend-Backend Integration" if mode == 'integration' else "TyneBase Backend - Milestone 2"
    milestone = "2.5" if mode == 'integration' else "2"
    
    content = f"""# AI Agent Task List (Personal Notes)

**Project:** {project_name}  
**Milestone:** {milestone}  
**Protocol:** RALPH v2.0  
**Last Updated:** {now}

---

## Progress Overview
- **Total Tasks:** {stats['total_tasks']} (excl. {stats['deferred']} deferred)
- **Completed:** {stats['completed']}
- **In Progress:** {stats['in_progress']}
- **Blocked:** {stats['blocked']}
- **Remaining:** {stats['total_tasks'] - stats['completed'] - stats['blocked']}

---

## Current Task: {current_section}
**Status:** {current_status}  
**Phase:** {state.get('current_phase', 'Unknown')}

### Implementation Notes:
{notes}

### Blockers:
{blockers}

### Next Steps:
{next_steps}

---

## Completed Tasks Summary:
{chr(10).join(completed_list) if completed_list else "_(No tasks completed yet)_"}

---

## Execution History (Last 10):
| Timestamp | Task | Action | Result |
|-----------|------|--------|--------|
"""
    
    # Add last 10 history entries
    history = state.get('execution_history', [])[-10:]
    for entry in reversed(history):
        content += f"| {entry.get('timestamp', '-')[:16]} | {entry.get('task_id', '-')} | {entry.get('action', '-')} | {entry.get('result', '-')} |\n"
    
    if not history:
        content += "| - | - | Initialized | Ready |\n"
    
    with open(TASKLIST_FILE, 'w', encoding='utf-8') as f:
        f.write(content)


def cmd_status():
    """Show current RALPH state."""
    state = load_state()
    tasks_data = load_tasks()
    stats = count_statistics(tasks_data)
    
    mode = state.get('mode', 'integration')
    mode_display = "Integration (M2.5)" if mode == 'integration' else "Backend (M2)"
    
    print("\n" + "="*60)
    print(f"  RALPH Status - TyneBase {mode_display}")
    print("="*60)
    print(f"\n  Mode:          {mode.upper()}")
    print(f"\n  Current Phase: {state.get('current_phase', 'Unknown')}")
    print(f"  Current Task:  {state.get('current_task') or 'None'}")
    print(f"  Status:        {state.get('status', 'unknown')}")
    print(f"\n  Progress:")
    print(f"    Completed:   {stats['completed']}/{stats['total_tasks']}")
    print(f"    In Progress: {stats['in_progress']}")
    print(f"    Blocked:     {stats['blocked']}")
    print(f"    Remaining:   {stats['total_tasks'] - stats['completed'] - stats['blocked']}")
    print(f"\n  Last Updated: {state.get('last_updated', 'Never')}")
    print(f"  Last Commit:  {state.get('git', {}).get('last_commit') or 'None'}")
    print("="*60 + "\n")


def cmd_next():
    """Get details of the next task to work on."""
    tasks_data = load_tasks()
    task = get_next_task(tasks_data)
    
    if not task:
        print("\n✅ ALL TASKS COMPLETED! Milestone 2 is done.\n")
        return
    
    print("\n" + "="*60)
    print(f"  NEXT TASK: {task['id']}")
    print("="*60)
    print(f"\n  Phase:  {task['phase']}")
    print(f"  Title:  {task['title']}")
    print(f"  Action: {task['action']}")
    print(f"\n  Status: {'⏳ In Progress' if task.get('in_progress') else '⬜ Pending'}")
    print("\n  Instructions:")
    print("  1. Read task description in RALPH.md")
    print("  2. Consult PRD.md for full context")
    print("  3. Run: python ralph_runner.py start " + task['id'])
    print("  4. Implement the feature")
    print("  5. Run validation steps")
    print("  6. Run: python ralph_runner.py pass " + task['id'])
    print("="*60 + "\n")


def cmd_start(task_id):
    """Mark a task as in progress."""
    state = load_state()
    tasks_data = load_tasks()
    
    task = get_task_by_id(tasks_data, task_id)
    if not task:
        print(f"\n❌ Task '{task_id}' not found.\n")
        return
    
    # Update task
    task['in_progress'] = True
    task['started_at'] = datetime.now().isoformat()
    save_tasks(tasks_data)
    
    # Update state
    state['current_task'] = task_id
    state['current_phase'] = task['phase']
    state['status'] = 'executing'
    state['execution_history'].append({
        'timestamp': datetime.now().isoformat(),
        'task_id': task_id,
        'action': 'started',
        'result': 'in_progress'
    })
    save_state(state)
    
    # Update tasklist.md
    update_tasklist_md(state, task)
    
    print(f"\n✅ Started task {task_id}: {task['title']}")
    print(f"   Action: {task['action']}\n")


def cmd_pass(task_id):
    """Mark a task as passed/completed."""
    state = load_state()
    tasks_data = load_tasks()
    
    task = get_task_by_id(tasks_data, task_id)
    if not task:
        print(f"\n❌ Task '{task_id}' not found.\n")
        return
    
    # Update task
    task['passes'] = True
    task['in_progress'] = False
    task['completed_at'] = datetime.now().isoformat()
    save_tasks(tasks_data)
    
    # Update state
    state['current_task'] = None
    state['status'] = 'ready'
    state['execution_history'].append({
        'timestamp': datetime.now().isoformat(),
        'task_id': task_id,
        'action': 'completed',
        'result': 'PASS'
    })
    save_state(state)
    
    # Update tasklist.md
    update_tasklist_md(state, None)
    
    # Recalculate stats
    stats = count_statistics(tasks_data)
    
    print("\n" + "="*60)
    print(f"✅ TASK COMPLETED: {task_id}")
    print("="*60)
    print(f"\n  Title:    {task['title']}")
    print(f"  Phase:    {task['phase']}")
    print(f"  Progress: {stats['completed']}/{stats['total_tasks']} tasks completed ({(stats['completed']/stats['total_tasks']*100):.1f}%)")
    print(f"\n  Status:   RALPH execution paused")
    print(f"  Action:   Review the completed work before continuing")
    print("\n" + "="*60)
    print("\n📋 To continue RALPH execution:")
    print("   1. Review the changes made for this task")
    print("   2. Run: python ralph_runner.py next")
    print("   3. Run: python ralph_runner.py start <task_id>")
    print("   4. Or use: @/ralph to continue autonomous execution")
    print("\n" + "="*60 + "\n")


def cmd_fail(task_id):
    """Mark a task as failed/blocked."""
    state = load_state()
    tasks_data = load_tasks()
    
    task = get_task_by_id(tasks_data, task_id)
    if not task:
        print(f"\n❌ Task '{task_id}' not found.\n")
        return
    
    # Update task
    task['blocked'] = True
    task['in_progress'] = False
    task['failed_at'] = datetime.now().isoformat()
    save_tasks(tasks_data)
    
    # Update state
    state['current_task'] = task_id
    state['status'] = 'blocked'
    state['execution_history'].append({
        'timestamp': datetime.now().isoformat(),
        'task_id': task_id,
        'action': 'blocked',
        'result': 'FAIL - Supervisor review needed'
    })
    save_state(state)
    
    # Update tasklist.md
    update_tasklist_md(state, task)
    
    print(f"\n⚠️  BLOCKED: Task {task_id}: {task['title']}")
    print(f"   Status: Requires supervisor review")
    print(f"\n   Action: Create execution_summary_task{task_id.replace('.', '_')}.md with failure details\n")


def cmd_commit(message):
    """Record a commit message (doesn't actually run git)."""
    state = load_state()
    
    commit_record = {
        'timestamp': datetime.now().isoformat(),
        'message': message,
        'task': state.get('current_task')
    }
    
    state['git']['last_commit'] = message
    state['execution_history'].append({
        'timestamp': datetime.now().isoformat(),
        'task_id': state.get('current_task', '-'),
        'action': 'commit',
        'result': message[:30] + '...' if len(message) > 30 else message
    })
    save_state(state)
    
    print(f"\n📝 Commit recorded: {message}")
    print(f"   Run manually: git add . && git commit -m \"{message}\"\n")


def cmd_summary():
    """Generate a progress summary."""
    state = load_state()
    tasks_data = load_tasks()
    stats = count_statistics(tasks_data)
    
    mode = state.get('mode', 'integration')
    mode_display = "Integration (M2.5)" if mode == 'integration' else "Backend (M2)"
    
    # Group by phase
    phases = {}
    for task in tasks_data['tasks']:
        if 'Deferred' in task.get('action', ''):
            continue
        phase = task['phase']
        if phase not in phases:
            phases[phase] = {'total': 0, 'completed': 0}
        phases[phase]['total'] += 1
        if task.get('passes', False):
            phases[phase]['completed'] += 1
    
    print("\n" + "="*60)
    print(f"  RALPH Progress Summary - {mode_display}")
    print("="*60)
    print(f"\n  Overall: {stats['completed']}/{stats['total_tasks']} tasks ({(stats['completed']/stats['total_tasks']*100):.1f}%)")
    print("\n  By Phase:")
    for phase, data in phases.items():
        pct = (data['completed']/data['total']*100) if data['total'] > 0 else 0
        bar = "█" * int(pct/10) + "░" * (10 - int(pct/10))
        status = "✅" if data['completed'] == data['total'] else "⏳"
        print(f"    {status} {phase[:40]:<40} [{bar}] {data['completed']}/{data['total']}")
    print("="*60 + "\n")


def cmd_mode(new_mode):
    """Switch between backend and integration modes."""
    if new_mode not in ['backend', 'integration']:
        print(f"\n❌ Invalid mode: {new_mode}")
        print("   Valid modes: backend, integration\n")
        return
    
    state = load_state()
    old_mode = state.get('mode', 'integration')
    
    if old_mode == new_mode:
        print(f"\n✅ Already in {new_mode} mode\n")
        return
    
    state['mode'] = new_mode
    state['current_task'] = None
    state['status'] = 'ready'
    save_state(state)
    
    set_file_paths(new_mode)
    
    print(f"\n✅ Switched from {old_mode} to {new_mode} mode")
    print(f"   Tasks file: {TASKS_FILE.name}")
    print(f"   Tasklist:   {TASKLIST_FILE.name}")
    print(f"\n   Run 'python ralph_runner.py status' to see current state\n")


def cmd_help():
    """Show help."""
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        cmd_help()
        return
    
    command = sys.argv[1].lower()
    
    if command == 'status':
        cmd_status()
    elif command == 'next':
        cmd_next()
    elif command == 'start' and len(sys.argv) > 2:
        cmd_start(sys.argv[2])
    elif command == 'pass' and len(sys.argv) > 2:
        cmd_pass(sys.argv[2])
    elif command == 'fail' and len(sys.argv) > 2:
        cmd_fail(sys.argv[2])
    elif command == 'commit' and len(sys.argv) > 2:
        cmd_commit(' '.join(sys.argv[2:]))
    elif command == 'summary':
        cmd_summary()
    elif command == 'mode' and len(sys.argv) > 2:
        cmd_mode(sys.argv[2])
    elif command in ['help', '-h', '--help']:
        cmd_help()
    else:
        print(f"\n❌ Unknown command: {command}")
        cmd_help()


if __name__ == '__main__':
    main()
