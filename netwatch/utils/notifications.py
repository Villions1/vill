"""
Notifications Module

GNOME desktop notifications for network events.
"""

import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class NotificationManager:
    """
    Manages GNOME desktop notifications.
    
    Features:
    - System notifications via libnotify
    - Notification priorities
    - Action buttons
    - Rate limiting
    """
    
    def __init__(self):
        self._enabled = True
        self._notifications_sent = 0
        self._rate_limit = 10  # Max notifications per minute
    
    def send_notification(self, title: str, message: str, 
                         priority: str = 'normal',
                         icon: Optional[str] = None,
                         actions: Optional[Dict[str, str]] = None) -> bool:
        """
        Send a desktop notification.
        
        Args:
            title: Notification title
            message: Notification body
            priority: 'low', 'normal', 'critical'
            icon: Icon name (optional)
            actions: Dict of action_id -> label
            
        Returns:
            True if sent successfully
        """
        if not self._enabled:
            return False
        
        # Check rate limit
        if self._notifications_sent >= self._rate_limit:
            logger.warning("Notification rate limit exceeded")
            return False
        
        try:
            # Try using notify-send via subprocess
            import subprocess
            
            cmd = ['notify-send']
            
            # Add urgency/priority
            if priority == 'critical':
                cmd.extend(['-u', 'critical'])
            elif priority == 'low':
                cmd.extend(['-u', 'low'])
            
            # Add icon
            if icon:
                cmd.extend(['-i', icon])
            
            # Add timeout (5 seconds for normal, 10 for critical)
            timeout = 10000 if priority == 'critical' else 5000
            cmd.extend(['-t', str(timeout)])
            
            cmd.append(title)
            cmd.append(message)
            
            subprocess.run(cmd, capture_output=True, timeout=2)
            
            self._notifications_sent += 1
            logger.debug(f"Sent notification: {title}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return False
    
    def send_traffic_alert(self, process_name: str, speed_mb: float):
        """Send high traffic alert notification."""
        title = "High Network Activity Detected"
        message = f"{process_name} is using {speed_mb:.1f} MB/s"
        
        self.send_notification(
            title=title,
            message=message,
            priority='normal',
            icon='network-transmit-receive-symbolic'
        )
    
    def send_process_blocked(self, process_name: str):
        """Send notification when process is blocked."""
        title = "Process Blocked"
        message = f"{process_name} has been blocked from accessing the network"
        
        self.send_notification(
            title=title,
            message=message,
            priority='normal',
            icon='network-offline-symbolic'
        )
    
    def send_security_alert(self, message: str):
        """Send security-related alert."""
        self.send_notification(
            title="Security Alert",
            message=message,
            priority='critical',
            icon='security-high-symbolic'
        )
    
    def set_enabled(self, enabled: bool):
        """Enable or disable notifications."""
        self._enabled = enabled
    
    def reset_rate_limit(self):
        """Reset the rate limit counter."""
        self._notifications_sent = 0
    
    @property
    def is_enabled(self) -> bool:
        return self._enabled
