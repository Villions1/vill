"""
Main Application Window

GTK4/libadwaita main window with navigation sidebar.
"""

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')

from gi.repository import Gtk, Adw, Gio, GLib
from typing import Optional, Dict, Any
import logging

from .dashboard import DashboardPage
from .processes import ProcessesPage
from .connections import ConnectionsPage
from .firewall import FirewallPage
from .settings import SettingsPage

logger = logging.getLogger(__name__)


class MainWindow(Adw.ApplicationWindow):
    """
    Main application window with sidebar navigation.
    
    Features:
    - libadwaita modern UI
    - Sidebar navigation
    - Dark/light theme support
    - Keyboard shortcuts
    """
    
    def __init__(self, app: Adw.Application, core_manager):
        super().__init__(application=app)
        
        self.core_manager = core_manager
        self.set_default_size(1200, 800)
        self.set_title("NetWatch")
        
        # Pages dictionary
        self._pages: Dict[str, Gtk.Widget] = {}
        
        # Build UI
        self._build_ui()
        
        # Setup keyboard shortcuts
        self._setup_shortcuts()
        
        logger.info("Main window initialized")
    
    def _build_ui(self):
        """Build the main UI structure."""
        # Create root box
        root_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.set_content(root_box)
        
        # Header bar
        header = Adw.HeaderBar()
        header.set_show_end_title_buttons(True)
        header.set_title_widget(self._create_title_widget())
        root_box.append(header)
        
        # Main content with split view
        self._split_view = Adw.NavigationSplitView()
        self._split_view.set_sidebar_width_fraction(0.2)
        self._split_view.set_min_sidebar_width(200)
        self._split_view.set_max_sidebar_width(300)
        
        # Sidebar
        sidebar_list = Gtk.ListBox()
        sidebar_list.add_css_class('navigation-sidebar')
        
        # Add navigation items
        nav_items = [
            ('dashboard', '📊 Dashboard', 'Overview'),
            ('processes', '🧠 Processes', 'Network by Process'),
            ('connections', '🔌 Connections', 'Active Connections'),
            ('firewall', '🛡️ Firewall', 'Rules Management'),
            ('settings', '⚙️ Settings', 'Configuration'),
        ]
        
        for page_id, label, description in nav_items:
            row = Adw.ActionRow()
            row.set_title(label)
            row.set_subtitle(description)
            row.connect('activated', self._on_nav_item_activated, page_id)
            sidebar_list.append(row)
        
        # Set initial selection
        sidebar_list.select_row(sidebar_list.get_row_at_index(0))
        
        # Navigation stack
        self._stack = Gtk.Stack()
        self._stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)
        self._stack.set_transition_duration(300)
        
        # Create pages
        self._pages['dashboard'] = DashboardPage(self.core_manager)
        self._pages['processes'] = ProcessesPage(self.core_manager)
        self._pages['connections'] = ConnectionsPage(self.core_manager)
        self._pages['firewall'] = FirewallPage(self.core_manager)
        self._pages['settings'] = SettingsPage(self.core_manager)
        
        for page_id, widget in self._pages.items():
            self._stack.add_named(widget, page_id)
        
        # Assemble split view
        self._split_view.set_sidebar(sidebar_list)
        self._split_view.set_content(self._stack)
        
        # Toast overlay for notifications
        self._toast_overlay = Adw.ToastOverlay()
        self._toast_overlay.set_child(self._split_view)
        
        root_box.append(self._toast_overlay)
    
    def _create_title_widget(self) -> Gtk.Widget:
        """Create custom title widget with status indicator."""
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        box.set_valign(Gtk.Align.CENTER)
        
        # Title label
        title = Gtk.Label()
        title.set_markup("<b>NetWatch</b>")
        title.add_css_class('title')
        box.append(title)
        
        # Status indicator
        self._status_indicator = Gtk.Label()
        self._status_indicator.set_markup("●")
        self._status_indicator.set_tooltip_text("Monitoring active")
        self._status_indicator.add_css_class('success')
        box.append(self._status_indicator)
        
        return box
    
    def _setup_shortcuts(self):
        """Setup keyboard shortcuts."""
        controller = Gtk.EventControllerKey.new()
        controller.connect('key-pressed', self._on_key_pressed)
        self.add_controller(controller)
    
    def _on_key_pressed(self, controller, keyval, keycode, state):
        """Handle keyboard shortcuts."""
        modifier = state & Gtk.accelerator_get_default_mod_mask()
        
        # Ctrl+Q - Quit
        if keyval == ord('q') and modifier == Gdk.ModifierType.CONTROL_MASK:
            self.close()
            return True
        
        # Ctrl+F - Focus search (in processes page)
        if keyval == ord('f') and modifier == Gdk.ModifierType.CONTROL_MASK:
            if hasattr(self._pages['processes'], 'focus_search'):
                self._pages['processes'].focus_search()
            return True
        
        # F5 - Refresh
        if keyval == Gdk.KEY_F5:
            self._refresh_current_page()
            return True
        
        # Ctrl+T - Toggle theme
        if keyval == ord('t') and modifier == Gdk.ModifierType.CONTROL_MASK:
            self._toggle_theme()
            return True
        
        return False
    
    def _on_nav_item_activated(self, row, page_id: str):
        """Handle navigation item selection."""
        self._stack.set_visible_child_name(page_id)
        logger.debug(f"Navigated to: {page_id}")
    
    def _refresh_current_page(self):
        """Refresh current visible page."""
        current_page = self._stack.get_visible_child_name()
        if current_page and hasattr(self._pages[current_page], 'refresh'):
            self._pages[current_page].refresh()
            self.show_toast(f"Refreshed {current_page}")
    
    def _toggle_theme(self):
        """Toggle between dark and light theme."""
        settings = Adw.StyleManager.get_default()
        settings.set_dark_theme(not settings.get_dark_theme())
    
    def show_toast(self, message: str, timeout: int = 3):
        """Show a toast notification."""
        toast = Adw.Toast()
        toast.set_title(message)
        toast.set_timeout(timeout)
        self._toast_overlay.add_toast(toast)
    
    def set_monitoring_status(self, active: bool):
        """Update monitoring status indicator."""
        if active:
            self._status_indicator.set_markup("●")
            self._status_indicator.add_css_class('success')
            self._status_indicator.remove_css_class('error')
        else:
            self._status_indicator.set_markup("○")
            self._status_indicator.remove_css_class('success')
            self._status_indicator.add_css_class('error')
    
    def on_shutdown(self):
        """Cleanup before shutdown."""
        logger.info("Shutting down main window")
        for page in self._pages.values():
            if hasattr(page, 'on_shutdown'):
                page.on_shutdown()


# Import Gdk for keyboard handling
from gi.repository import Gdk
