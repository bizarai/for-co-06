#!/bin/bash

# Service management script for the map visualization application

function start_server() {
  echo "Starting map service..."
  # Check if server is already running
  if pgrep -f "node server.js" > /dev/null; then
    echo "Server is already running!"
    return 1
  fi
  
  # Start the server in the background
  nohup node server.js > server.log 2>&1 &
  
  # Wait a moment to check if it started successfully
  sleep 2
  if pgrep -f "node server.js" > /dev/null; then
    echo "Server started successfully! Available at http://localhost:3000"
    echo "Map visualization is ready to use."
    return 0
  else
    echo "Server failed to start. Check server.log for details."
    return 1
  fi
}

function stop_server() {
  echo "Stopping map service..."
  if pkill -f "node server.js"; then
    echo "Server stopped successfully."
    return 0
  else
    echo "No server process was found."
    return 1
  fi
}

function server_status() {
  if pgrep -f "node server.js" > /dev/null; then
    echo "Server is running."
    echo "Map visualization available at http://localhost:3000"
    echo "You can also use these endpoints:"
    echo "- Test page: http://localhost:3000/direct-test.html"
    echo "- Debug API: http://localhost:3000/api/debug"
    
    # Show the process details
    echo -e "\nProcess details:"
    ps -f -p $(pgrep -f "node server.js")
    return 0
  else
    echo "Server is not running."
    return 1
  fi
}

function restart_server() {
  echo "Restarting map service..."
  stop_server
  sleep 1
  start_server
}

function tail_logs() {
  echo "Showing last 20 lines of logs and following new entries..."
  echo "Press Ctrl+C to stop viewing logs."
  tail -n 20 -f server.log
}

# Main command processing
case "$1" in
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  restart)
    restart_server
    ;;
  status)
    server_status
    ;;
  logs)
    tail_logs
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo "  start   - Start the map service"
    echo "  stop    - Stop the map service"
    echo "  restart - Restart the map service"
    echo "  status  - Check the service status"
    echo "  logs    - View the server logs"
    exit 1
    ;;
esac

exit $? 