"""
NetWatch - Ethernet Traffic Analyzer for GNOME

Main application entry point.
"""

import asyncio
import sys
import os
import signal
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')

from gi.repository import Gtk, Adw, GLib

from netwatch.core.packet_capture import PacketCapture
from netwatch.core.process_monitor import ProcessMonitor
from netwatch.core.firewall_manager import FirewallManager
from netwatch.core.stats_collector import StatsCollector
from netwatch.gui.main_window import MainWindow
from netwatch.utils.logger import setup_logging
from netwatch.utils.notifications import NotificationManager


class CoreManager:
    """
    Central manager for all core components.
    
    Provides unified interface for GUI to access backend functionality.
    """
    
    def __init__(self):
        self.packet_capture = PacketCapture()
        self.process_monitor = ProcessMonitor()
        self.firewall_manager = FirewallManager()
        self.stats_collector = StatsCollector()
        self.notification_manager = NotificationManager()
        
        self._interface = 'eth0'
        self._running = False
    
    async def initialize(self) -> bool:
        """Initialize all core components."""
        try:
            # Initialize database
            self.stats_collector.initialize_db()
            
            # Initialize firewall (requires root)
            if os.geteuid() == 0:
                await self.firewall_manager.initialize()
            else:
                print("Warning: Not running as root. Firewall features disabled.")
            
            return True
            
        except Exception as e:
            print(f"Error initializing core: {e}")
            return False
    
    def get_interface(self) -> str:
        return self._interface
    
    def set_interface(self, interface: str):
        self._interface = interface
        self.packet_capture.set_interface(interface)
    
    async def start_monitoring(self):
        """Start all monitoring services."""
        self._running = True
        
        # Start packet capture
        await self.packet_capture.start()
        
        print("Monitoring started")
    
    async def stop_monitoring(self):
        """Stop all monitoring services."""
        self._running = False
        
        # Stop packet capture
        await self.packet_capture.stop()
        
        # Cleanup firewall
        await self.firewall_manager.cleanup()
        
        print("Monitoring stopped")
    
    async def shutdown(self):
        """Shutdown all components gracefully."""
        await self.stop_monitoring()


class NetWatchApplication(Adw.Application):
    """
    Main GTK application class.
    """
    
    def __init__(self):
        super().__init__(
            application_id='com.netwatch.app',
            flags=Gio.ApplicationFlags.FLAGS_NONE
        )
        
        self.core_manager: Optional[CoreManager] = None
        self.main_window: Optional[MainWindow] = None
    
    def do_startup(self):
        """Application startup."""
        Adw.Application.do_startup(self)
        
        # Setup logging
        setup_logging(log_level='INFO', verbose=False)
        
        # Initialize core manager
        self.core_manager = CoreManager()
        
        # Run async initialization
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(self.core_manager.initialize())
        except Exception as e:
            print(f"Failed to initialize: {e}")
    
    def do_activate(self):
        """Application activation (window shown)."""
        # Create main window
        self.main_window = MainWindow(self, self.core_manager)
        self.main_window.present()
        
        # Start monitoring in background
        asyncio.ensure_future(self.core_manager.start_monitoring())
    
    def do_shutdown(self):
        """Application shutdown."""
        Adw.Application.do_shutdown(self)
        
        # Cleanup
        if self.main_window:
            self.main_window.on_shutdown()
        
        # Shutdown core manager
        if self.core_manager:
            loop = asyncio.get_event_loop()
            loop.run_until_complete(self.core_manager.shutdown())


def check_root_privileges() -> bool:
    """Check if running with root privileges."""
    return os.geteuid() == 0


def main():
    """Main entry point."""
    # Check for root (recommended but not required)
    if not check_root_privileges():
        print("=" * 60)
        print("WARNING: NetWatch works best with root privileges")
        print("Run with: sudo python -m netwatch")
        print("Some features may be limited without root access")
        print("=" * 60)
    
    # Create and run application
    app = NetWatchApplication()
    app.run(sys.argv)


if __name__ == '__main__':
    main()
