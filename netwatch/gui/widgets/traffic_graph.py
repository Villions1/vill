"""
Traffic Graph Widget

Custom drawing area for real-time traffic visualization.
"""

import gi
gi.require_version('Gtk', '4.0')

from gi.repository import Gtk, Gdk
from typing import List
from collections import deque
import math


class TrafficGraphWidget(Gtk.DrawingArea):
    """
    Custom widget for drawing real-time traffic graphs.
    
    Features:
    - Smooth line chart
    - Auto-scaling Y axis
    - Configurable data points
    - Low CPU usage
    """
    
    def __init__(self, max_points: int = 60):
        super().__init__()
        
        self.max_points = max_points
        self.data_points: deque = deque(maxlen=max_points)
        self._line_width = 2.0
        self._fill_alpha = 0.3
        
        # Colors
        self._stroke_color = (0.2, 0.5, 1.0)  # Blue
        self._fill_color = (0.2, 0.5, 1.0)
        
        # Setup drawing
        self.set_draw_func(self._draw_func)
        
        # Set minimum size
        self.set_size_request(-1, 200)
    
    def add_point(self, value: float):
        """Add a new data point."""
        self.data_points.append(value)
        self.queue_draw()
    
    def clear(self):
        """Clear all data points."""
        self.data_points.clear()
        self.queue_draw()
    
    def set_max_points(self, count: int):
        """Set maximum number of visible data points."""
        self.max_points = count
        self.data_points = deque(maxlen=count)
        self.queue_draw()
    
    def _draw_func(self, area, cr, width, height):
        """Draw the graph."""
        if not self.data_points:
            return
        
        # Clear background
        cr.set_source_rgb(1.0, 1.0, 1.0)
        cr.paint()
        
        # Calculate scaling
        max_value = max(self.data_points) if self.data_points else 1.0
        if max_value == 0:
            max_value = 1.0
        
        padding = 10
        graph_width = width - 2 * padding
        graph_height = height - 2 * padding
        
        # Draw grid lines
        cr.set_source_rgba(0.8, 0.8, 0.8, 0.5)
        cr.set_line_width(1.0)
        
        # Horizontal grid lines
        for i in range(5):
            y = padding + (graph_height / 5) * i
            cr.move_to(padding, y)
            cr.line_to(width - padding, y)
        
        cr.stroke()
        
        # Draw data line
        cr.set_source_rgb(*self._stroke_color)
        cr.set_line_width(self._line_width)
        
        step_x = graph_width / (self.max_points - 1) if self.max_points > 1 else graph_width
        
        # Start path
        cr.move_to(padding, height - padding)
        
        # Draw line through all points
        for i, value in enumerate(self.data_points):
            x = padding + i * step_x
            # Invert Y because GTK coordinates go down
            normalized = value / max_value
            y = height - padding - (normalized * graph_height)
            
            if i == 0:
                cr.move_to(x, y)
            else:
                # Use curve for smoothness
                prev_x = padding + (i - 1) * step_x
                prev_value = list(self.data_points)[i - 1] if i > 0 else value
                prev_normalized = prev_value / max_value
                prev_y = height - padding - (prev_normalized * graph_height)
                
                # Control points for smooth curve
                cp1_x = (prev_x + x) / 2
                cp1_y = prev_y
                cp2_x = (prev_x + x) / 2
                cp2_y = y
                
                cr.curve_to(cp1_x, cp1_y, cp2_x, cp2_y, x, y)
        
        cr.stroke()
        
        # Fill area under line
        cr.set_source_rgba(*self._fill_color, self._fill_alpha)
        
        # Complete the path for filling
        cr.line_to(padding + (len(self.data_points) - 1) * step_x, height - padding)
        cr.line_to(padding, height - padding)
        cr.close_path()
        cr.fill()
        
        # Draw current value label
        if self.data_points:
            current_value = self.data_points[-1]
            label = self._format_value(current_value)
            
            # Draw text background
            cr.set_source_rgba(0.0, 0.0, 0.0, 0.7)
            cr.rectangle(width - 80, padding, 75, 24)
            cr.fill()
            
            # Draw text (simplified - in production would use Pango)
            cr.set_source_rgb(1.0, 1.0, 1.0)
            # Note: Real implementation would use Pango for text rendering
    
    def _format_value(self, value: float) -> str:
        """Format value for display."""
        if value >= 1_000_000:
            return f"{value/1_000_000:.1f} MB/s"
        elif value >= 1_000:
            return f"{value/1_000:.1f} KB/s"
        else:
            return f"{value:.0f} B/s"
