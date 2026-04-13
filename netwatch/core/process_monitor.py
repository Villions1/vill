"""
Process Monitor Module

Maps network connections to system processes using /proc and netlink.
Provides real-time process-network correlation.
"""

import asyncio
from typing import Dict, List, Optional, Set, Any
from dataclasses import dataclass
from datetime import datetime
import logging
import os
import socket
import struct

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class ProcessInfo:
    """Represents a process with network activity."""
    pid: int
    name: str
    exe_path: str
    username: str
    connections: List[Dict[str, Any]]
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'pid': self.pid,
            'name': self.name,
            'exe_path': self.exe_path,
            'username': self.username,
            'connections': self.connections,
            'bytes_sent': self.bytes_sent,
            'bytes_recv': self.bytes_recv,
            'packets_sent': self.packets_sent,
            'packets_recv': self.packets_recv
        }


@dataclass
class ConnectionInfo:
    """Represents a single network connection."""
    fd: int
    family: str  # IPv4, IPv6
    type: str    # TCP, UDP
    local_addr: str
    local_port: int
    remote_addr: str
    remote_port: int
    status: str
    pid: int
    process_name: str


class ProcessMonitor:
    """
    Monitors system processes and their network connections.
    
    Features:
    - Real-time process discovery
    - Connection-to-process mapping
    - Traffic statistics per process
    - Efficient polling with caching
    """
    
    def __init__(self):
        self._process_cache: Dict[int, ProcessInfo] = {}
        self._connection_cache: Dict[int, ConnectionInfo] = {}
        self._last_update: float = 0
        self._update_interval: float = 1.0  # seconds
        
        if not PSUTIL_AVAILABLE:
            logger.error("psutil not available. Install with: pip install psutil")
    
    def get_all_processes(self) -> List[ProcessInfo]:
        """
        Get all processes with network connections.
        
        Returns:
            List of ProcessInfo objects sorted by traffic
        """
        if not PSUTIL_AVAILABLE:
            return []
        
        processes = []
        
        try:
            # Get network connections per process
            for proc in psutil.process_iter(['pid', 'name', 'exe', 'username']):
                try:
                    pid = proc.info['pid']
                    name = proc.info['name'] or 'unknown'
                    exe_path = proc.info['exe'] or ''
                    username = proc.info['username'] or 'unknown'
                    
                    # Get connections for this process
                    connections = []
                    bytes_sent = 0
                    bytes_recv = 0
                    packets_sent = 0
                    packets_recv = 0
                    
                    try:
                        net_connections = proc.net_connections(kind='inet')
                        for conn in net_connections:
                            conn_info = {
                                'fd': conn.fd,
                                'family': 'IPv6' if conn.family == socket.AF_INET6 else 'IPv4',
                                'type': 'TCP' if conn.type == socket.SOCK_STREAM else 'UDP',
                                'local_addr': conn.laddr.ip if conn.laddr else '',
                                'local_port': conn.laddr.port if conn.laddr else 0,
                                'remote_addr': conn.raddr.ip if conn.raddr else '',
                                'remote_port': conn.raddr.port if conn.raddr else 0,
                                'status': conn.status if hasattr(conn, 'status') else ''
                            }
                            connections.append(conn_info)
                        
                        # Get IO counters if available
                        try:
                            io_counters = proc.io_counters()
                            # Note: These are file I/O, not network I/O
                            # Network I/O requires different approach
                        except (psutil.AccessDenied, AttributeError):
                            pass
                            
                    except (psutil.AccessDenied, psutil.NoSuchProcess):
                        continue
                    
                    # Only include processes with connections
                    if connections:
                        process_info = ProcessInfo(
                            pid=pid,
                            name=name,
                            exe_path=exe_path,
                            username=username,
                            connections=connections,
                            bytes_sent=bytes_sent,
                            bytes_recv=bytes_recv,
                            packets_sent=packets_sent,
                            packets_recv=packets_recv
                        )
                        processes.append(process_info)
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                    
        except Exception as e:
            logger.error(f"Error getting processes: {e}")
        
        # Sort by number of connections (descending)
        processes.sort(key=lambda p: len(p.connections), reverse=True)
        return processes
    
    def get_process_by_pid(self, pid: int) -> Optional[ProcessInfo]:
        """Get detailed info for a specific process."""
        if not PSUTIL_AVAILABLE:
            return None
        
        try:
            proc = psutil.Process(pid)
            name = proc.name()
            exe_path = proc.exe()
            username = proc.username()
            
            connections = []
            try:
                net_connections = proc.net_connections(kind='inet')
                for conn in net_connections:
                    connections.append({
                        'local_addr': conn.laddr.ip if conn.laddr else '',
                        'local_port': conn.laddr.port if conn.laddr else 0,
                        'remote_addr': conn.raddr.ip if conn.raddr else '',
                        'remote_port': conn.raddr.port if conn.raddr else 0,
                        'status': conn.status if hasattr(conn, 'status') else ''
                    })
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                pass
            
            return ProcessInfo(
                pid=pid,
                name=name,
                exe_path=exe_path or '',
                username=username or 'unknown',
                connections=connections,
                bytes_sent=0,
                bytes_recv=0,
                packets_sent=0,
                packets_recv=0
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return None
    
    def find_process_by_connection(self, local_port: int, 
                                   remote_addr: str = '', 
                                   remote_port: int = 0) -> Optional[ProcessInfo]:
        """
        Find process owning a specific connection.
        
        Args:
            local_port: Local port number
            remote_addr: Remote IP address (optional)
            remote_port: Remote port (optional)
            
        Returns:
            ProcessInfo or None if not found
        """
        if not PSUTIL_AVAILABLE:
            return None
        
        try:
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    connections = proc.net_connections(kind='inet')
                    for conn in connections:
                        if conn.laddr and conn.laddr.port == local_port:
                            if not remote_addr or (conn.raddr and 
                                                   conn.raddr.ip == remote_addr and
                                                   conn.raddr.port == remote_port):
                                return self.get_process_by_pid(proc.info['pid'])
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    continue
        except Exception as e:
            logger.debug(f"Error finding process: {e}")
        
        return None
    
    def get_connections_summary(self) -> List[ConnectionInfo]:
        """Get summary of all active connections."""
        if not PSUTIL_AVAILABLE:
            return []
        
        connections = []
        
        try:
            # Get all system connections
            all_connections = psutil.net_connections(kind='inet')
            
            for conn in all_connections:
                if not conn.laddr:
                    continue
                
                # Get process name
                process_name = 'unknown'
                if conn.pid:
                    try:
                        proc = psutil.Process(conn.pid)
                        process_name = proc.name()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                
                conn_info = ConnectionInfo(
                    fd=conn.fd,
                    family='IPv6' if conn.family == socket.AF_INET6 else 'IPv4',
                    type='TCP' if conn.type == socket.SOCK_STREAM else 'UDP',
                    local_addr=conn.laddr.ip,
                    local_port=conn.laddr.port,
                    remote_addr=conn.raddr.ip if conn.raddr else '',
                    remote_port=conn.raddr.port if conn.raddr else 0,
                    status=conn.status if hasattr(conn, 'status') else '',
                    pid=conn.pid if conn.pid else 0,
                    process_name=process_name
                )
                connections.append(conn_info)
                
        except (psutil.AccessDenied, Exception) as e:
            logger.error(f"Error getting connections: {e}")
        
        return connections
    
    async def monitor_loop(self, callback=None):
        """
        Continuous monitoring loop.
        
        Args:
            callback: Async function to call with process list updates
        """
        while True:
            processes = self.get_all_processes()
            
            if callback:
                await callback(processes)
            
            await asyncio.sleep(self._update_interval)
    
    def search_processes(self, query: str) -> List[ProcessInfo]:
        """Search processes by name or path."""
        all_procs = self.get_all_processes()
        query_lower = query.lower()
        
        return [
            p for p in all_procs 
            if query_lower in p.name.lower() or query_lower in p.exe_path.lower()
        ]
