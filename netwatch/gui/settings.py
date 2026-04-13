"""
Settings Page

Application configuration and preferences.
"""

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')

from gi.repository import Gtk, Adw, GLib
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class SettingsPage(Gtk.ScrolledWindow):
    """
    Settings page for application configuration.
    
    Features:
    - Network interface selection
    - Auto-start toggle
    - Notification settings
    - Data management
    - About dialog
    """
    
    def __init__(self, core_manager):
        super().__init__()
        
        self.core_manager = core_manager
        self.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        
        # Build UI
        self._build_ui()
    
    def _build_ui(self):
        """Build settings page UI."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18)
        main_box.set_margin_start(24)
        main_box.set_margin_end(24)
        main_box.set_margin_top(24)
        main_box.set_margin_bottom(24)
        
        # Title
        title = Gtk.Label()
        title.set_markup("<span size='x-large' weight='bold'>Settings</span>")
        title.set_halign(Gtk.Align.START)
        main_box.append(title)
        
        # Network settings group
        network_group = Adw.PreferencesGroup()
        network_group.set_title("Network")
        network_group.set_description("Configure network monitoring settings")
        
        # Interface selection
        interface_row = Adw.ComboRow()
        interface_row.set_title("Network Interface")
        interface_row.set_subtitle("Select the interface to monitor")
        
        interfaces = self._get_available_interfaces()
        interface_store = Gtk.StringList.new(interfaces)
        interface_row.set_model(interface_store)
        
        # Set current interface
        if self.core_manager:
            current = self.core_manager.get_interface() or 'eth0'
            try:
                idx = interfaces.index(current)
                interface_row.set_selected(idx)
            except ValueError:
                pass
        
        interface_row.connect('notify::selected', self._on_interface_changed)
        network_group.add(interface_row)
        
        main_box.append(network_group)
        
        # Appearance group
        appearance_group = Adw.PreferencesGroup()
        appearance_group.set_title("Appearance")
        appearance_group.set_description("Customize the look and feel")
        
        # Dark mode toggle
        dark_mode_row = Adw.SwitchRow()
        dark_mode_row.set_title("Dark Mode")
        dark_mode_row.set_subtitle("Use dark theme")
        
        style_manager = Adw.StyleManager.get_default()
        dark_mode_row.set_active(style_manager.get_dark_theme())
        dark_mode_row.connect('notify::active', self._on_dark_mode_changed)
        appearance_group.add(dark_mode_row)
        
        main_box.append(appearance_group)
        
        # Notifications group
        notifications_group = Adw.PreferencesGroup()
        notifications_group.set_title("Notifications")
        notifications_group.set_description("Configure notification settings")
        
        # Enable notifications
        notify_row = Adw.SwitchRow()
        notify_row.set_title("Enable Notifications")
        notify_row.set_subtitle("Show notifications for network activity")
        notify_row.set_active(True)
        notifications_group.add(notify_row)
        
        # High traffic alert threshold
        threshold_row = Adw.SpinRow()
        threshold_row.set_title("High Traffic Alert")
        threshold_row.set_subtitle("Alert when traffic exceeds (MB/s)")
        
        adjustment = Gtk.Adjustment.new(10.0, 0.1, 1000.0, 1.0, 10.0, 0.0)
        threshold_row.set_adjustment(adjustment)
        notifications_group.add(threshold_row)
        
        main_box.append(notifications_group)
        
        # Data management group
        data_group = Adw.PreferencesGroup()
        data_group.set_title("Data Management")
        data_group.set_description("Manage stored statistics and logs")
        
        # Export logs button
        export_row = Adw.ActionRow()
        export_row.set_title("Export Logs")
        export_row.set_subtitle("Export traffic logs to CSV file")
        
        export_btn = Gtk.Button()
        export_btn.set_label("Export")
        export_btn.connect('clicked', self._on_export_clicked)
        export_row.add_suffix(export_btn)
        export_row.set_activatable_widget(export_btn)
        data_group.add(export_row)
        
        # Clear old data button
        clear_row = Adw.ActionRow()
        clear_row.set_title("Clear Old Data")
        clear_row.set_subtitle("Remove data older than 7 days")
        
        clear_btn = Gtk.Button()
        clear_btn.set_label("Clear")
        clear_btn.add_css_class('destructive-action')
        clear_btn.connect('clicked', self._on_clear_clicked)
        clear_row.add_suffix(clear_btn)
        clear_row.set_activatable_widget(clear_btn)
        data_group.add(clear_row)
        
        main_box.append(data_group)
        
        # About group
        about_group = Adw.PreferencesGroup()
        about_group.set_title("About")
        
        # Version info
        version_row = Adw.ActionRow()
        version_row.set_title("NetWatch")
        version_row.set_subtitle("Version 1.0.0")
        
        # Add icon
        icon = Gtk.Image.new_from_icon_name('network-workgroup-symbolic')
        icon.set_pixel_size(32)
        version_row.add_prefix(icon)
        
        about_btn = Gtk.Button()
        about_btn.set_label("About")
        about_btn.connect('clicked', self._on_about_clicked)
        version_row.add_suffix(about_btn)
        version_row.set_activatable_widget(about_btn)
        about_group.add(version_row)
        
        main_box.append(about_group)
        
        self.set_child(main_box)
    
    def _get_available_interfaces(self) -> list:
        """Get list of available network interfaces."""
        if self.core_manager:
            return self.core_manager.packet_capture.get_available_interfaces()
        return ['eth0', 'wlan0', 'lo']
    
    def _on_interface_changed(self, row, param):
        """Handle interface selection change."""
        idx = row.get_selected()
        model = row.get_model()
        interface = model.get_string(idx)
        
        if self.core_manager:
            self.core_manager.set_interface(interface)
            logger.info(f"Interface changed to: {interface}")
    
    def _on_dark_mode_changed(self, row, param):
        """Handle dark mode toggle."""
        style_manager = Adw.StyleManager.get_default()
        style_manager.set_dark_theme(row.get_active())
    
    def _on_export_clicked(self, button):
        """Handle export logs button click."""
        # Show file chooser
        dialog = Gtk.FileChooserDialog(
            title="Export Logs",
            parent=self.get_root(),
            action=Gtk.FileChooserAction.SAVE
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        dialog.add_button("Save", Gtk.ResponseType.ACCEPT)
        dialog.set_current_name("netwatch_logs.csv")
        
        dialog.connect('response', self._on_export_response)
        dialog.present()
    
    def _on_export_response(self, dialog, response):
        """Handle export dialog response."""
        if response == Gtk.ResponseType.ACCEPT:
            file = dialog.get_file()
            if file:
                path = file.get_path()
                if self.core_manager:
                    self.core_manager.stats_collector.export_logs(path)
        
        dialog.destroy()
    
    def _on_clear_clicked(self, button):
        """Handle clear data button click."""
        dialog = Adw.MessageDialog.new(
            self.get_root(),
            "Clear Old Data?",
            "This will remove all data older than 7 days."
        )
        dialog.add_response("cancel", "Cancel")
        dialog.add_response("clear", "Clear")
        dialog.set_response_appearance("clear", Adw.ResponseAppearance.DESTRUCTIVE)
        dialog.connect('response', self._on_clear_response)
        dialog.present()
    
    def _on_clear_response(self, dialog, response):
        """Handle clear dialog response."""
        if response == "clear":
            if self.core_manager:
                self.core_manager.stats_collector.clear_old_data(days=7)
    
    def _on_about_clicked(self, button):
        """Show about dialog."""
        about = Adw.AboutDialog()
        about.set_application_name("NetWatch")
        about.set_version("1.0.0")
        about.set_developer_name("Senior Linux Developer")
        about.set_license_type(Gtk.License.MIT_X11)
        about.set_comments("Ethernet Traffic Analyzer for GNOME")
        about.set_website("https://github.com/netwatch")
        about.set_issue_url("https://github.com/netwatch/issues")
        about.present(self.get_root())
    
    def refresh(self):
        """Refresh settings page."""
        pass
    
    def on_shutdown(self):
        """Cleanup."""
        pass
