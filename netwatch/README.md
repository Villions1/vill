# NetWatch - Ethernet Traffic Analyzer for GNOME

A modern desktop application for real-time Ethernet traffic analysis with a beautiful GNOME-style UI.

## Features

- 📡 **Real-time Traffic Analysis** - Monitor incoming/outgoing traffic with protocol filtering
- 🧠 **Process-level Monitoring** - See which applications use your network
- 🚫 **Application Blocking** - Block/allow internet access per process via nftables
- 📈 **Live Graphs** - Visualize traffic with smooth line/bar charts
- 🔔 **GNOME Notifications** - Get alerts for suspicious network activity
- 🌓 **Dark/Light Theme** - Follows system theme automatically

## Technology Stack

- **Language**: Python 3.10+ (PyGObject)
- **GUI**: GTK4 + libadwaita
- **Packet Capture**: libpcap (via scapy)
- **Process Mapping**: /proc filesystem + netlink
- **Firewall**: nftables
- **Database**: SQLite for statistics history
- **Async**: asyncio for low-latency processing

## Installation (Arch Linux)

### Prerequisites

```bash
sudo pacman -S python-pygobject gtk4 libadwaita python-scapy python-psutil \
    python-asyncio python-aiohttp sqlite nftables iptables-nft \
    libpcap tcpdump gnome-desktop notify-osd
```

### Setup

```bash
cd netwatch
pip install -r requirements.txt
```

### Running as Root (Required for packet capture and firewall)

```bash
sudo python -m netwatch
```

### Optional: Install systemd service

```bash
sudo cp data/netwatch.service /etc/systemd/system/
sudo systemctl enable netwatch
sudo systemctl start netwatch
```

## Project Structure

```
netwatch/
├── core/
│   ├── __init__.py
│   ├── packet_capture.py    # Packet sniffing with libpcap
│   ├── process_monitor.py   # Process-network mapping
│   ├── firewall_manager.py  # nftables rule management
│   └── stats_collector.py   # Traffic statistics
├── gui/
│   ├── __init__.py
│   ├── main_window.py       # Main application window
│   ├── dashboard.py         # Overview dashboard
│   ├── processes.py         # Process list view
│   ├── connections.py       # Active connections
│   ├── firewall.py          # Firewall rules manager
│   ├── settings.py          # Application settings
│   └── widgets/
│       ├── __init__.py
│       └── traffic_graph.py # Custom graph widget
├── utils/
│   ├── __init__.py
│   ├── dns_resolver.py      # Async DNS resolution
│   ├── notifications.py     # GNOME notifications
│   └── logger.py            # Logging configuration
├── data/
│   ├── netwatch.service     # systemd service file
│   └── nftables.conf        # nftables configuration example
├── main.py                  # Application entry point
├── requirements.txt
└── README.md
```

## Usage

### Dashboard
View overall traffic statistics, speed graphs, and active connection count.

### Processes Tab
See all processes using network, sorted by traffic or connections. Block/allow buttons for each process.

### Connections Tab
Detailed list of all active connections with IP, port, protocol, and state.

### Firewall Tab
Manage nftables rules created by NetWatch. View, add, remove rules.

### Settings
- Select network interface (eth0, wlan0, etc.)
- Enable/disable auto-start
- Configure notifications
- Export logs

## Security Notes

- Requires root privileges for packet capture and firewall management
- Creates isolated nftables table (`inet netwatch`) to avoid conflicts
- All input validated before passing to system commands
- Does not modify existing firewall rules outside `netwatch` table

## Configuration

### nftables Table Structure

NetWatch creates its own nftables table:

```nft
table inet netwatch {
    chain input {
        type filter hook input priority 0; policy accept;
        # Auto-generated rules here
    }
    chain output {
        type filter hook output priority 0; policy accept;
        # Auto-generated rules here
    }
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Q` | Quit application |
| `Ctrl+F` | Search processes |
| `F5` | Refresh data |
| `Ctrl+T` | Toggle dark/light theme |

## UI Description

### Main Window
- **Sidebar Navigation**: Clean libadwaita sidebar with 5 sections
- **Header Bar**: App title with status indicator (green dot when monitoring)
- **Toast Notifications**: Non-intrusive action confirmations

### Dashboard
- Four stat cards showing Download/Upload speeds, Connections count, Active processes
- Line chart showing traffic over last hour with smooth curves
- Top 5 processes list with traffic amounts
- Recent activity feed

### Processes Page
- Searchable list with real-time updates
- Sortable columns (Connections, Name, PID)
- Each row shows: Process name/path, PID, Connection count, Status badge, Block/Allow button
- Color-coded status (green=active, red=blocked)

### Connections Page
- Protocol filter dropdown (All/TCP/UDP)
- List shows: Local address → Remote address, Protocol badge, Status, Process name
- Click to expand details panel

### Firewall Page
- Info banner explaining isolated rules
- Rules list with toggle switches and delete buttons
- Export/Import/Cleanup buttons
- Expiration countdown for temporary rules

### Settings Page
- Preferences groups using Adw.PreferencesGroup
- Network interface dropdown
- Dark mode toggle
- Notification settings with threshold spinner
- Data management actions
- About dialog with version info

## Troubleshooting

### Permission Denied Errors
Run with sudo: `sudo python -m netwatch`

### No Interfaces Found
Ensure you have network interfaces: `ip link show`

### Firewall Not Working
Check nftables is installed: `which nft`

### GUI Not Showing
Ensure GTK4 and libadwaita are installed properly

## License

MIT License

## Author

Senior Linux Developer & Network Engineer

---

**Note**: This application is designed for Arch Linux but should work on other distributions with minor adjustments.
