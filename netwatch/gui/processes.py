"""
Processes Page

List of all processes with network activity, with block/allow controls.
"""

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')

from gi.repository import Gtk, Adw, GLib
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class ProcessesPage(Gtk.ScrolledWindow):
    """
    Processes page showing network usage by application.
    
    Features:
    - Sortable process list
    - Block/Allow buttons per process
    - Search functionality
    - Real-time updates
    """
    
    def __init__(self, core_manager):
        super().__init__()
        
        self.core_manager = core_manager
        self.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        
        # Build UI
        self._build_ui()
        
        # Start update timer
        self._update_timer = GLib.timeout_add_seconds(2, self._update_processes)
    
    def _build_ui(self):
        """Build processes page UI."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        main_box.set_margin_start(24)
        main_box.set_margin_end(24)
        main_box.set_margin_top(24)
        main_box.set_margin_bottom(24)
        
        # Header with search
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        
        # Title
        title = Gtk.Label()
        title.set_markup("<span size='x-large' weight='bold'>Processes</span>")
        title.set_halign(Gtk.Align.START)
        header_box.append(title)
        
        # Search entry
        self._search_entry = Gtk.SearchEntry()
        self._search_entry.set_placeholder_text("Search processes...")
        self._search_entry.connect('search-changed', self._on_search_changed)
        self._search_entry.set_hexpand(True)
        header_box.append(self._search_entry)
        
        main_box.append(header_box)
        
        # Sort options
        sort_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        sort_label = Gtk.Label()
        sort_label.set_text("Sort by:")
        sort_box.append(sort_label)
        
        self._sort_dropdown = Gtk.DropDown.new_from_strings([
            "Connections",
            "Name",
            "PID"
        ])
        self._sort_dropdown.set_selected(0)
        self._sort_dropdown.connect('notify::selected', self._on_sort_changed)
        sort_box.append(self._sort_dropdown)
        
        main_box.append(sort_box)
        
        # Process list header
        header_row = Gtk.ListBoxRow()
        header_row.add_css_class('background')
        
        header_grid = Gtk.Grid()
        header_grid.set_margin_start(12)
        header_grid.set_margin_end(12)
        header_grid.set_margin_top(8)
        header_grid.set_margin_bottom(8)
        header_grid.set_column_spacing(12)
        
        headers = [
            ("Process", 0, 250),
            ("PID", 1, 60),
            ("Connections", 2, 100),
            ("Traffic", 3, 120),
            ("Status", 4, 100),
            ("Action", 5, 120)
        ]
        
        for text, col, width in headers:
            label = Gtk.Label()
            label.set_markup(f"<b>{text}</b>")
            label.set_halign(Gtk.Align.START)
            if col > 0:
                label.set_hexpand(True)
            header_grid.attach(label, col, 0, 1, 1)
        
        header_row.set_child(header_grid)
        
        # Main process list
        self._process_list = Gtk.ListBox()
        self._process_list.add_css_class('boxed-list')
        self._process_list.set_selection_mode(Gtk.SelectionMode.SINGLE)
        
        # Add header to list
        self._process_list.append(header_row)
        
        main_box.append(self._process_list)
        
        self.set_child(main_box)
        
        # Store current processes
        self._current_processes: Dict[int, Gtk.ListBoxRow] = {}
        self._blocked_pids = set()
    
    def _update_processes(self) -> bool:
        """Update process list periodically."""
        try:
            if not self.core_manager:
                return True
            
            # Get all processes
            processes = self.core_manager.process_monitor.get_all_processes()
            
            # Filter by search if active
            search_text = self._search_entry.get_text().lower()
            if search_text:
                processes = [
                    p for p in processes 
                    if search_text in p.name.lower() or search_text in p.exe_path.lower()
                ]
            
            # Sort
            sort_type = self._sort_dropdown.get_selected()
            if sort_type == 0:  # Connections
                processes.sort(key=lambda p: len(p.connections), reverse=True)
            elif sort_type == 1:  # Name
                processes.sort(key=lambda p: p.name)
            elif sort_type == 2:  # PID
                processes.sort(key=lambda p: p.pid)
            
            # Update UI (simplified - would use efficient diffing in production)
            self._refresh_process_list(processes)
            
        except Exception as e:
            logger.error(f"Error updating processes: {e}")
        
        return True
    
    def _refresh_process_list(self, processes):
        """Refresh the process list efficiently."""
        # For simplicity, rebuild entire list
        # In production, would use incremental updates
        
        # Remove all except header
        while True:
            row = self._process_list.get_row_at_index(1)
            if not row:
                break
            self._process_list.remove(row)
        
        self._current_processes = {}
        
        # Add process rows
        for proc in processes:
            row = self._create_process_row(proc)
            self._process_list.append(row)
            self._current_processes[proc.pid] = row
    
    def _create_process_row(self, proc) -> Gtk.ListBoxRow:
        """Create a row widget for a process."""
        row = Gtk.ListBoxRow()
        row.set_activatable(False)
        
        grid = Gtk.Grid()
        grid.set_margin_start(12)
        grid.set_margin_end(12)
        grid.set_margin_top(8)
        grid.set_margin_bottom(8)
        grid.set_column_spacing(12)
        
        # Process name and path
        proc_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        name_label = Gtk.Label()
        name_label.set_markup(f"<b>{proc.name}</b>")
        name_label.set_halign(Gtk.Align.START)
        name_label.set_ellipsize(3)  # PANGO_ELLIPSIZE_END
        
        path_label = Gtk.Label()
        path_label.set_text(proc.exe_path[:50] + "..." if len(proc.exe_path) > 50 else proc.exe_path)
        path_label.add_css_class('dim-label')
        path_label.set_halign(Gtk.Align.START)
        
        proc_box.append(name_label)
        proc_box.append(path_label)
        grid.attach(proc_box, 0, 0, 1, 1)
        
        # PID
        pid_label = Gtk.Label()
        pid_label.set_text(str(proc.pid))
        pid_label.set_halign(Gtk.Align.START)
        grid.attach(pid_label, 1, 0, 1, 1)
        
        # Connections count
        conn_label = Gtk.Label()
        conn_label.set_text(str(len(proc.connections)))
        conn_label.set_halign(Gtk.Align.START)
        grid.attach(conn_label, 2, 0, 1, 1)
        
        # Traffic (placeholder - would calculate from stats)
        traffic_label = Gtk.Label()
        traffic_label.set_text("-")
        traffic_label.set_halign(Gtk.Align.START)
        grid.attach(traffic_label, 3, 0, 1, 1)
        
        # Status
        is_blocked = proc.pid in self._blocked_pids
        status_label = Gtk.Label()
        if is_blocked:
            status_label.set_markup("<span foreground='red'>Blocked</span>")
        else:
            status_label.set_markup("<span foreground='green'>Active</span>")
        status_label.set_halign(Gtk.Align.START)
        grid.attach(status_label, 4, 0, 1, 1)
        
        # Action button
        button = Gtk.Button()
        if is_blocked:
            button.set_label("Allow")
            button.add_css_class('success')
        else:
            button.set_label("Block")
            button.add_css_class('destructive-action')
        
        button.connect('clicked', self._on_block_clicked, proc.pid, proc.name)
        grid.attach(button, 5, 0, 1, 1)
        
        row.set_child(grid)
        return row
    
    def _on_block_clicked(self, button, pid: int, process_name: str):
        """Handle block/unblock button click."""
        is_blocked = pid in self._blocked_pids
        
        if is_blocked:
            # Unblock
            asyncio.run(self.core_manager.firewall_manager.unblock_process_by_pid(pid))
            self._blocked_pids.discard(pid)
            button.set_label("Block")
            button.remove_css_class('success')
            button.add_css_class('destructive-action')
        else:
            # Block
            asyncio.run(self.core_manager.firewall_manager.block_process(pid, process_name))
            self._blocked_pids.add(pid)
            button.set_label("Allow")
            button.remove_css_class('destructive-action')
            button.add_css_class('success')
    
    def _on_search_changed(self, entry):
        """Handle search text change."""
        self._update_processes()
    
    def _on_sort_changed(self, dropdown, param):
        """Handle sort option change."""
        self._update_processes()
    
    def focus_search(self):
        """Focus the search entry."""
        self._search_entry.grab_focus()
    
    def refresh(self):
        """Force refresh."""
        self._update_processes()
    
    def on_shutdown(self):
        """Cleanup."""
        if hasattr(self, '_update_timer'):
            GLib.source_remove(self._update_timer)


# Import asyncio for firewall operations
import asyncio
