#!/bin/bash

SESSION="centralgpt"

# Check if tmux session already exists
tmux has-session -t $SESSION 2>/dev/null
if [ $? == 0 ]; then
    echo "Session $SESSION already exists. Attaching to it."
    tmux attach-session -t $SESSION
    exit 0
fi

# Ensure all startup scripts are executable
chmod +x backend.sh celery.sh frontend.sh dbs.sh

# Create a new session, detached
tmux new-session -d -s $SESSION

# Pane 0: Databases
tmux rename-window -t $SESSION:0 'services'
tmux send-keys -t $SESSION:0 './dbs.sh' C-m

# Wait a few seconds for DBs to start up
echo "Waiting for databases to initialize..."
sleep 5

# Pane 1 (split horizontally): Backend
tmux split-window -h -t $SESSION:0
tmux send-keys -t $SESSION:0.1 './backend.sh' C-m

# Pane 2 (split backend vertically): Celery
tmux split-window -v -t $SESSION:0.1
tmux send-keys -t $SESSION:0.2 './celery.sh' C-m

# Pane 3 (split DBs vertically): Frontend
tmux split-window -v -t $SESSION:0.0
tmux send-keys -t $SESSION:0.3 './frontend.sh' C-m

# Adjust pane layout
tmux select-layout -t $SESSION:0 tiled

# Attach to the session
tmux attach-session -t $SESSION
