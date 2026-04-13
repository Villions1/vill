"""
Dashboard Page

Main overview with traffic graphs, statistics, and quick info.
"""

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')

from gi.repository import Gtk, Adw, GLib
from typing import Dict, Any
import logging

from .widgets.traffic_graph import TrafficGraphWidget

logger = logging.getLogger(__name__)


class DashboardPage(Gtk.ScrolledWindow):
    """
    Dashboard page showing overall network status.
    
    Features:
    - Real-time speed graph
    - Total traffic statistics
    - Active connections count
    - Top processes preview
    """
    
    def __init__(self, core_manager):
        super().__init__()
        
        self.core_manager = core_manager
        self.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        
        # Build UI
        self._build_ui()
        
        # Start update timer
        self._update_timer = GLib.timeout_add_seconds(1, self._update_stats)
    
    def _build_ui(self):
        """Build dashboard UI."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18)
        main_box.set_margin_start(24)
        main_box.set_margin_end(24)
        main_box.set_margin_top(24)
        main_box.set_margin_bottom(24)
        
        # Title
        title = Gtk.Label()
        title.set_markup("<span size='x-large' weight='bold'>Network Overview</span>")
        title.set_halign(Gtk.Align.START)
        main_box.append(title)
        
        # Stats cards row
        stats_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        stats_box.set_halign(Gtk.Align.FILL)
        
        # Download speed card
        self._download_card = self._create_stat_card(
            "📥 Download",
            "0 KB/s",
            "speed-download"
        )
        stats_box.append(self._download_card)
        
        # Upload speed card
        self._upload_card = self._create_stat_card(
            "📤 Upload", 
            "0 KB/s",
            "speed-upload"
        )
        stats_box.append(self._upload_card)
        
        # Connections card
        self._connections_card = self._create_stat_card(
            "🔌 Connections",
            "0",
            "connections"
        )
        stats_box.append(self._connections_card)
        
        # Processes card
        self._processes_card = self._create_stat_card(
            "🧠 Processes",
            "0",
            "processes"
        )
        stats_box.append(self._processes_card)
        
        main_box.append(stats_box)
        
        # Traffic graph
        graph_frame = Adw.Frame()
        graph_frame.set_label("Traffic History (Last Hour)")
        
        self._traffic_graph = TrafficGraphWidget(max_points=60)
        self._traffic_graph.set_vexpand(True)
        self._traffic_graph.set_min_content_height(200)
        
        graph_frame.set_child(self._traffic_graph)
        main_box.append(graph_frame)
        
        # Top processes section
        processes_frame = Adw.Frame()
        processes_frame.set_label("Top Processes")
        
        self._top_processes_list = Gtk.ListBox()
        self._top_processes_list.add_css_class('boxed-list')
        self._top_processes_list.set_selection_mode(Gtk.SelectionMode.NONE)
        
        processes_frame.set_child(self._top_processes_list)
        main_box.append(processes_frame)
        
        # Recent activity section
        activity_frame = Adw.Frame()
        activity_frame.set_label("Recent Activity")
        
        self._activity_list = Gtk.ListBox()
        self._activity_list.add_css_class('boxed-list')
        self._activity_list.set_selection_mode(Gtk.SelectionMode.NONE)
        
        activity_frame.set_child(self._activity_list)
        main_box.append(activity_frame)
        
        self.set_child(main_box)
    
    def _create_stat_card(self, title: str, value: str, css_class: str) -> Gtk.Widget:
        """Create a statistics card widget."""
        card = Adw.Bin()
        card.add_css_class('card')
        card.set_vexpand(True)
        
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        box.set_margin_start(18)
        box.set_margin_end(18)
        box.set_margin_top(12)
        box.set_margin_bottom(12)
        
        # Title
        title_label = Gtk.Label()
        title_label.set_markup(f"<span weight='bold'>{title}</span>")
        title_label.set_halign(Gtk.Align.START)
        box.append(title_label)
        
        # Value
        value_label = Gtk.Label()
        value_label.set_markup(f"<span size='xx-large' weight='bold'>{value}</span>")
        value_label.set_halign(Gtk.Align.START)
        setattr(self, f"_{css_class}_label", value_label)
        box.append(value_label)
        
        card.set_child(box)
        return card
    
    def _update_stats(self) -> bool:
        """Update statistics periodically."""
        try:
            if not self.core_manager:
                return True
            
            # Get current speeds
            interface = self.core_manager.get_interface() or 'eth0'
            speed_in, speed_out = self.core_manager.stats_collector.get_current_speed(interface)
            
            # Update speed labels
            self._speed_download_label.set_markup(
                f"<span size='xx-large' weight='bold'>{self._format_speed(speed_in)}</span>"
            )
            self._speed_upload_label.set_markup(
                f"<span size='xx-large' weight='bold'>{self._format_speed(speed_out)}</span>"
            )
            
            # Update connections count
            connections = self.core_manager.process_monitor.get_connections_summary()
            self._connections_label.set_markup(
                f"<span size='xx-large' weight='bold'>{len(connections)}</span>"
            )
            
            # Update processes count
            processes = self.core_manager.process_monitor.get_all_processes()
            self._processes_label.set_markup(
                f"<span size='xx-large' weight='bold'>{len(processes)}</span>"
            )
            
            # Update graph
            total_speed = speed_in + speed_out
            self._traffic_graph.add_point(total_speed)
            
            # Update top processes
            self._update_top_processes()
            
        except Exception as e:
            logger.error(f"Error updating dashboard: {e}")
        
        return True  # Continue timer
    
    def _format_speed(self, bytes_per_sec: float) -> str:
        """Format speed in human-readable format."""
        if bytes_per_sec >= 1_000_000:
            return f"{bytes_per_sec / 1_000_000:.1f} MB/s"
        elif bytes_per_sec >= 1_000:
            return f"{bytes_per_sec / 1_000:.1f} KB/s"
        else:
            return f"{bytes_per_sec:.0f} B/s"
    
    def _update_top_processes(self):
        """Update top processes list."""
        # Clear existing
        while self._top_processes_list.get_first_child():
            child = self._top_processes_list.get_first_child()
            self._top_processes_list.remove(child)
        
        # Get top processes
        top_procs = self.core_manager.stats_collector.get_top_processes(hours=1, limit=5)
        
        for proc in top_procs:
            row = Adw.ActionRow()
            row.set_title(proc['process_name'])
            row.set_subtitle(f"PID: {proc['pid']}")
            
            # Add traffic suffix
            suffix = Gtk.Label()
            suffix.set_markup(f"<b>{self._format_bytes(proc['total_bytes'])}</b>")
            row.add_suffix(suffix)
            
            self._top_processes_list.append(row)
    
    def _format_bytes(self, bytes_count: int) -> str:
        """Format bytes in human-readable format."""
        if bytes_count >= 1_000_000_000:
            return f"{bytes_count / 1_000_000_000:.1f} GB"
        elif bytes_count >= 1_000_000:
            return f"{bytes_count / 1_000_000:.1f} MB"
        elif bytes_count >= 1_000:
            return f"{bytes_count / 1_000:.1f} KB"
        else:
            return f"{bytes_count} B"
    
    def refresh(self):
        """Force refresh of dashboard data."""
        self._update_stats()
    
    def on_shutdown(self):
        """Cleanup on shutdown."""
        if hasattr(self, '_update_timer'):
            GLib.source_remove(self._update_timer)
