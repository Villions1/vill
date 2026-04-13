"""
Firewall Page

Manage nftables rules for application blocking.
"""

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')

from gi.repository import Gtk, Adw, GLib
from typing import Dict, Any
import logging
import asyncio

logger = logging.getLogger(__name__)


class FirewallPage(Gtk.ScrolledWindow):
    """
    Firewall rules management page.
    
    Features:
    - List all active rules
    - Add/remove rules
    - Enable/disable rules
    - Import/export rules
    """
    
    def __init__(self, core_manager):
        super().__init__()
        
        self.core_manager = core_manager
        self.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        
        # Build UI
        self._build_ui()
        
        # Start update timer
        self._update_timer = GLib.timeout_add_seconds(5, self._update_rules)
    
    def _build_ui(self):
        """Build firewall page UI."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        main_box.set_margin_start(24)
        main_box.set_margin_end(24)
        main_box.set_margin_top(24)
        main_box.set_margin_bottom(24)
        
        # Header with actions
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        
        title = Gtk.Label()
        title.set_markup("<span size='x-large' weight='bold'>Firewall Rules</span>")
        title.set_halign(Gtk.Align.START)
        header_box.append(title)
        
        header_box.append(Gtk.Box())  # Spacer
        header_box.set_hexpand(True)
        
        # Export button
        export_btn = Gtk.Button()
        export_btn.set_label("Export")
        export_btn.connect('clicked', self._on_export_clicked)
        header_box.append(export_btn)
        
        # Import button
        import_btn = Gtk.Button()
        import_btn.set_label("Import")
        import_btn.connect('clicked', self._on_import_clicked)
        header_box.append(import_btn)
        
        # Cleanup button
        cleanup_btn = Gtk.Button()
        cleanup_btn.set_label("Cleanup All")
        cleanup_btn.add_css_class('destructive-action')
        cleanup_btn.connect('clicked', self._on_cleanup_clicked)
        header_box.append(cleanup_btn)
        
        main_box.append(header_box)
        
        # Info banner
        info_banner = Adw.Banner()
        info_banner.set_title("NetWatch creates isolated nftables rules")
        info_banner.set_button_label("Learn More")
        info_banner.connect('button-clicked', self._on_info_clicked)
        main_box.append(info_banner)
        
        # Rules list
        self._rules_list = Gtk.ListBox()
        self._rules_list.add_css_class('boxed-list')
        self._rules_list.set_selection_mode(Gtk.SelectionMode.NONE)
        
        main_box.append(self._rules_list)
        
        self.set_child(main_box)
    
    def _update_rules(self) -> bool:
        """Update rules list periodically."""
        try:
            if not self.core_manager or not self.core_manager.firewall_manager:
                return True
            
            # Get all rules
            rules = asyncio.run(self.core_manager.firewall_manager.get_rules())
            
            # Update list
            self._refresh_rules_list(rules)
            
        except Exception as e:
            logger.error(f"Error updating rules: {e}")
        
        return True
    
    def _refresh_rules_list(self, rules):
        """Refresh the rules list."""
        # Remove all rows
        while self._rules_list.get_first_child():
            child = self._rules_list.get_first_child()
            self._rules_list.remove(child)
        
        if not rules:
            # Show empty state
            empty_label = Gtk.Label()
            empty_label.set_markup("<span>No active firewall rules</span>")
            empty_label.add_css_class('dim-label')
            empty_label.set_margin_top(24)
            empty_label.set_margin_bottom(24)
            self._rules_list.append(empty_label)
            return
        
        # Add rule rows
        for rule in rules:
            row = self._create_rule_row(rule)
            self._rules_list.append(row)
    
    def _create_rule_row(self, rule) -> Gtk.ListBoxRow:
        """Create a row widget for a rule."""
        row = Gtk.ListBoxRow()
        row.set_activatable(False)
        
        grid = Gtk.Grid()
        grid.set_margin_start(12)
        grid.set_margin_end(12)
        grid.set_margin_top(8)
        grid.set_margin_bottom(8)
        grid.set_column_spacing(12)
        
        # Process name
        proc_label = Gtk.Label()
        proc_label.set_markup(f"<b>{rule.process_name}</b>")
        proc_label.set_halign(Gtk.Align.START)
        grid.attach(proc_label, 0, 0, 1, 1)
        
        # PID
        pid_label = Gtk.Label()
        pid_label.set_text(f"PID: {rule.pid}")
        pid_label.add_css_class('dim-label')
        grid.attach(pid_label, 1, 0, 1, 1)
        
        # Action badge
        action_label = Gtk.Label()
        if rule.action == 'drop':
            action_label.set_markup("<span foreground='red'>BLOCKED</span>")
            action_label.add_css_class('error')
        else:
            action_label.set_markup("<span foreground='green'>ALLOWED</span>")
            action_label.add_css_class('success')
        grid.attach(action_label, 2, 0, 1, 1)
        
        # Direction
        dir_label = Gtk.Label()
        dir_label.set_text(rule.direction.upper())
        dir_label.add_css_class('pill')
        grid.attach(dir_label, 3, 0, 1, 1)
        
        # Protocol
        proto_label = Gtk.Label()
        proto_label.set_text(rule.protocol.upper())
        proto_label.add_css_class('dim-label')
        grid.attach(proto_label, 4, 0, 1, 1)
        
        # Expiration
        if rule.expires_at:
            expires_in = int(rule.expires_at - asyncio.get_event_loop().time())
            exp_label = Gtk.Label()
            exp_label.set_text(f"Expires in {expires_in}s")
            exp_label.add_css_class('warning')
            grid.attach(exp_label, 5, 0, 1, 1)
        
        # Toggle switch
        switch = Gtk.Switch()
        switch.set_active(rule.enabled)
        switch.set_halign(Gtk.Align.END)
        switch.set_hexpand(True)
        switch.connect('notify::active', self._on_toggle_changed, rule.id)
        grid.attach(switch, 6, 0, 1, 1)
        
        # Delete button
        del_btn = Gtk.Button()
        del_btn.set_icon_name('user-trash-symbolic')
        del_btn.add_css_class('destructive-action')
        del_btn.connect('clicked', self._on_delete_clicked, rule.id)
        grid.attach(del_btn, 7, 0, 1, 1)
        
        row.set_child(grid)
        return row
    
    def _on_toggle_changed(self, switch, param, rule_id: str):
        """Handle rule enable/disable toggle."""
        # In production, would call firewall manager to enable/disable
        pass
    
    def _on_delete_clicked(self, button, rule_id: str):
        """Handle rule deletion."""
        try:
            asyncio.run(self.core_manager.firewall_manager.unblock_process(rule_id))
            self._update_rules()
        except Exception as e:
            logger.error(f"Error deleting rule: {e}")
    
    def _on_export_clicked(self, button):
        """Handle export button click."""
        # Show file chooser dialog
        pass
    
    def _on_import_clicked(self, button):
        """Handle import button click."""
        # Show file chooser dialog
        pass
    
    def _on_cleanup_clicked(self, button):
        """Handle cleanup all button click."""
        dialog = Adw.MessageDialog.new(
            self.get_root(),
            "Cleanup All Rules?",
            "This will remove all NetWatch firewall rules."
        )
        dialog.add_response("cancel", "Cancel")
        dialog.add_response("cleanup", "Cleanup")
        dialog.set_response_appearance("cleanup", Adw.ResponseAppearance.DESTRUCTIVE)
        dialog.connect('response', self._on_cleanup_response)
        dialog.present()
    
    def _on_cleanup_response(self, dialog, response):
        """Handle cleanup dialog response."""
        if response == "cleanup":
            try:
                asyncio.run(self.core_manager.firewall_manager.cleanup())
                self._update_rules()
            except Exception as e:
                logger.error(f"Error during cleanup: {e}")
    
    def _on_info_clicked(self, banner):
        """Handle info banner click."""
        # Could open documentation or show more details
        pass
    
    def refresh(self):
        """Force refresh."""
        self._update_rules()
    
    def on_shutdown(self):
        """Cleanup."""
        if hasattr(self, '_update_timer'):
            GLib.source_remove(self._update_timer)
