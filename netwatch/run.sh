#!/bin/bash
# NetWatch launcher script
# Uses system Python for PyGObject compatibility

SYSTEM_PYTHON="/usr/bin/python3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$SYSTEM_PYTHON" ]; then
    echo "ERROR: System Python not found at $SYSTEM_PYTHON"
    exit 1
fi

if [ ! -f "$SCRIPT_DIR/main.py" ]; then
    echo "ERROR: main.py not found in $SCRIPT_DIR"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  WARNING: NetWatch works best with root privileges"
    echo "Some features may be limited without root access"
    echo ""
fi

exec "$SYSTEM_PYTHON" "$SCRIPT_DIR/main.py" "$@"
