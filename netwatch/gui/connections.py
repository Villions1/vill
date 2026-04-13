"""
Connections Page

List of all active network connections.
"""

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')

from gi.repository import Gtk, Adw, GLib
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class ConnectionsPage(Gtk.ScrolledWindow):
    """
    Connections page showing all active network connections.
    
    Features:
    - Detailed connection list
    - Filter by protocol/state
    - DNS resolution display
    - Connection details on selection
    """
    
    def __init__(self, core_manager):
        super().__init__()
        
        self.core_manager = core_manager
        self.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        
        # Build UI
        self._build_ui()
        
        # Start update timer
        self._update_timer = GLib.timeout_add_seconds(2, self._update_connections)
    
    def _build_ui(self):
        """Build connections page UI."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        main_box.set_margin_start(24)
        main_box.set_margin_end(24)
        main_box.set_margin_top(24)
        main_box.set_margin_bottom(24)
        
        # Header
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        
        title = Gtk.Label()
        title.set_markup("<span size='x-large' weight='bold'>Active Connections</span>")
        title.set_halign(Gtk.Align.START)
        header_box.append(title)
        
        # Protocol filter
        filter_label = Gtk.Label()
        filter_label.set_text("Protocol:")
        header_box.append(filter_label)
        
        self._protocol_filter = Gtk.DropDown.new_from_strings([
            "All",
            "TCP",
            "UDP"
        ])
        self._protocol_filter.set_selected(0)
        self._protocol_filter.connect('notify::selected', self._on_filter_changed)
        header_box.append(self._protocol_filter)
        
        main_box.append(header_box)
        
        # Connections list
        self._connections_list = Gtk.ListBox()
        self._connections_list.add_css_class('boxed-list')
        self._connections_list.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self._connections_list.connect('row-selected', self._on_connection_selected)
        
        main_box.append(self._connections_list)
        
        # Details panel (hidden by default)
        self._details_panel = Adw.Bin()
        self._details_panel.set_visible(False)
        main_box.append(self._details_panel)
        
        self.set_child(main_box)
    
    def _update_connections(self) -> bool:
        """Update connections list periodically."""
        try:
            if not self.core_manager:
                return True
            
            # Get all connections
            connections = self.core_manager.process_monitor.get_connections_summary()
            
            # Filter by protocol
            protocol_idx = self._protocol_filter.get_selected()
            if protocol_idx == 1:  # TCP
                connections = [c for c in connections if c.type == 'TCP']
            elif protocol_idx == 2:  # UDP
                connections = [c for c in connections if c.type == 'UDP']
            
            # Update list
            self._refresh_connections_list(connections)
            
        except Exception as e:
            logger.error(f"Error updating connections: {e}")
        
        return True
    
    def _refresh_connections_list(self, connections):
        """Refresh the connections list."""
        # Remove all rows
        while self._connections_list.get_first_child():
            child = self._connections_list.get_first_child()
            self._connections_list.remove(child)
        
        # Add connection rows
        for conn in connections:
            row = self._create_connection_row(conn)
            self._connections_list.append(row)
    
    def _create_connection_row(self, conn) -> Gtk.ListBoxRow:
        """Create a row widget for a connection."""
        row = Gtk.ListBoxRow()
        row.set_activatable(True)
        row.set_data('connection', conn)
        
        grid = Gtk.Grid()
        grid.set_margin_start(12)
        grid.set_margin_end(12)
        grid.set_margin_top(8)
        grid.set_margin_bottom(8)
        grid.set_column_spacing(12)
        
        # Local address
        local_label = Gtk.Label()
        local_label.set_markup(f"<b>{conn.local_addr}:{conn.local_port}</b>")
        local_label.set_halign(Gtk.Align.START)
        grid.attach(local_label, 0, 0, 1, 1)
        
        # Arrow
        arrow = Gtk.Label()
        arrow.set_text("→")
        arrow.add_css_class('dim-label')
        grid.attach(arrow, 1, 0, 1, 1)
        
        # Remote address
        remote_label = Gtk.Label()
        remote_str = f"{conn.remote_addr or '*'}:{conn.remote_port or '*'}"
        remote_label.set_text(remote_str)
        remote_label.set_halign(Gtk.Align.START)
        grid.attach(remote_label, 2, 0, 1, 1)
        
        # Protocol badge
        proto_label = Gtk.Label()
        proto_label.set_text(conn.type)
        proto_label.add_css_class('pill')
        if conn.type == 'TCP':
            proto_label.add_css_class('success')
        else:
            proto_label.add_css_class('warning')
        grid.attach(proto_label, 3, 0, 1, 1)
        
        # Status
        status_label = Gtk.Label()
        status_label.set_text(conn.status or '-')
        status_label.add_css_class('dim-label')
        status_label.set_halign(Gtk.Align.START)
        status_label.set_hexpand(True)
        grid.attach(status_label, 4, 0, 1, 1)
        
        # Process name
        proc_label = Gtk.Label()
        proc_label.set_text(conn.process_name)
        proc_label.add_css_class('dim-label')
        proc_label.set_halign(Gtk.Align.END)
        grid.attach(proc_label, 5, 0, 1, 1)
        
        row.set_child(grid)
        return row
    
    def _on_connection_selected(self, listbox, row):
        """Handle connection selection."""
        if not row:
            self._details_panel.set_visible(False)
            return
        
        conn = row.get_data('connection')
        if not conn:
            return
        
        # Show details
        self._show_connection_details(conn)
    
    def _show_connection_details(self, conn):
        """Show detailed connection information."""
        details_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        details_box.set_margin_start(12)
        details_box.set_margin_end(12)
        details_box.set_margin_top(12)
        details_box.set_margin_bottom(12)
        
        # Title
        title = Gtk.Label()
        title.set_markup("<b>Connection Details</b>")
        title.set_halign(Gtk.Align.START)
        details_box.append(title)
        
        # Details grid
        grid = Gtk.Grid()
        grid.set_row_spacing(6)
        grid.set_column_spacing(12)
        
        details = [
            ("Local Address:", f"{conn.local_addr}:{conn.local_port}"),
            ("Remote Address:", f"{conn.remote_addr or 'N/A'}:{conn.remote_port or 'N/A'}"),
            ("Protocol:", conn.type),
            ("Family:", conn.family),
            ("Status:", conn.status or 'Unknown'),
            ("Process:", f"{conn.process_name} (PID: {conn.pid})"),
        ]
        
        for i, (label, value) in enumerate(details):
            lbl = Gtk.Label()
            lbl.set_markup(f"<b>{label}</b>")
            lbl.set_halign(Gtk.Align.START)
            grid.attach(lbl, 0, i, 1, 1)
            
            val = Gtk.Label()
            val.set_text(value)
            val.set_halign(Gtk.Align.START)
            grid.attach(val, 1, i, 1, 1)
        
        details_box.append(grid)
        
        self._details_panel.set_child(details_box)
        self._details_panel.set_visible(True)
    
    def _on_filter_changed(self, dropdown, param):
        """Handle protocol filter change."""
        self._update_connections()
    
    def refresh(self):
        """Force refresh."""
        self._update_connections()
    
    def on_shutdown(self):
        """Cleanup."""
        if hasattr(self, '_update_timer'):
            GLib.source_remove(self._update_timer)
