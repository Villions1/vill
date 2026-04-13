"""
Statistics Collector Module

Collects and stores traffic statistics in SQLite database.
Provides historical data for graphs and analysis.
"""

import asyncio
import sqlite3
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
import threading
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class TrafficStat:
    """Represents a traffic statistics entry."""
    timestamp: float
    interface: str
    bytes_in: int
    bytes_out: int
    packets_in: int
    packets_out: int
    connections_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'timestamp': self.timestamp,
            'interface': self.interface,
            'bytes_in': self.bytes_in,
            'bytes_out': self.bytes_out,
            'packets_in': self.packets_in,
            'packets_out': self.packets_out,
            'connections_count': self.connections_count
        }


@dataclass
class ProcessStat:
    """Represents process-specific statistics."""
    timestamp: float
    pid: int
    process_name: str
    bytes_sent: int
    bytes_recv: int
    connections_count: int


class StatsCollector:
    """
    Collects and stores network traffic statistics.
    
    Features:
    - SQLite storage for persistence
    - Real-time statistics aggregation
    - Historical data queries
    - Low-overhead async collection
    """
    
    DB_PATH = "data/netwatch.db"
    
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or self.DB_PATH
        self._current_stats: Dict[str, TrafficStat] = {}
        self._process_stats: Dict[int, ProcessStat] = {}
        self._lock = threading.Lock()
        self._db_initialized = False
        
        # Speed tracking (bytes per second)
        self._last_bytes_in: Dict[str, int] = {}
        self._last_bytes_out: Dict[str, int] = {}
        self._last_update_time: float = 0
        
    def initialize_db(self):
        """Initialize SQLite database schema."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Traffic statistics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS traffic_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    interface TEXT NOT NULL,
                    bytes_in INTEGER DEFAULT 0,
                    bytes_out INTEGER DEFAULT 0,
                    packets_in INTEGER DEFAULT 0,
                    packets_out INTEGER DEFAULT 0,
                    connections_count INTEGER DEFAULT 0
                )
            ''')
            
            # Process statistics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS process_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    pid INTEGER NOT NULL,
                    process_name TEXT NOT NULL,
                    bytes_sent INTEGER DEFAULT 0,
                    bytes_recv INTEGER DEFAULT 0,
                    connections_count INTEGER DEFAULT 0
                )
            ''')
            
            # Connections log table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS connections_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    src_ip TEXT NOT NULL,
                    dst_ip TEXT NOT NULL,
                    src_port INTEGER,
                    dst_port INTEGER,
                    protocol TEXT,
                    bytes_count INTEGER DEFAULT 0,
                    pid INTEGER,
                    process_name TEXT
                )
            ''')
            
            # Create indexes for faster queries
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_traffic_ts ON traffic_stats(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_process_ts ON process_stats(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_connections_ts ON connections_log(timestamp)')
            
            conn.commit()
            conn.close()
            self._db_initialized = True
            logger.info("Database initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            self._db_initialized = False
    
    def record_traffic(self, interface: str, bytes_in: int, bytes_out: int,
                       packets_in: int = 0, packets_out: int = 0,
                       connections_count: int = 0):
        """Record current traffic statistics."""
        timestamp = datetime.now().timestamp()
        
        stat = TrafficStat(
            timestamp=timestamp,
            interface=interface,
            bytes_in=bytes_in,
            bytes_out=bytes_out,
            packets_in=packets_in,
            packets_out=packets_out,
            connections_count=connections_count
        )
        
        with self._lock:
            self._current_stats[interface] = stat
            
            # Save to database periodically (every 10 records)
            if len(self._current_stats) % 10 == 0:
                self._save_traffic_to_db(stat)
    
    def record_process_stats(self, pid: int, process_name: str,
                             bytes_sent: int, bytes_recv: int,
                             connections_count: int):
        """Record process-specific statistics."""
        timestamp = datetime.now().timestamp()
        
        stat = ProcessStat(
            timestamp=timestamp,
            pid=pid,
            process_name=process_name,
            bytes_sent=bytes_sent,
            bytes_recv=bytes_recv,
            connections_count=connections_count
        )
        
        with self._lock:
            self._process_stats[pid] = stat
    
    def _save_traffic_to_db(self, stat: TrafficStat):
        """Save traffic statistic to database."""
        if not self._db_initialized:
            return
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO traffic_stats 
                (timestamp, interface, bytes_in, bytes_out, packets_in, packets_out, connections_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (stat.timestamp, stat.interface, stat.bytes_in, stat.bytes_out,
                  stat.packets_in, stat.packets_out, stat.connections_count))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error saving traffic stats: {e}")
    
    def record_connection(self, src_ip: str, dst_ip: str, src_port: int,
                          dst_port: int, protocol: str, bytes_count: int = 0,
                          pid: Optional[int] = None, process_name: Optional[str] = None):
        """Log a connection event."""
        if not self._db_initialized:
            return
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO connections_log
                (timestamp, src_ip, dst_ip, src_port, dst_port, protocol, 
                 bytes_count, pid, process_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (datetime.now().timestamp(), src_ip, dst_ip, src_port, dst_port,
                  protocol, bytes_count, pid, process_name))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error logging connection: {e}")
    
    def get_current_speed(self, interface: str) -> Tuple[float, float]:
        """
        Calculate current upload/download speed in bytes/second.
        
        Returns:
            Tuple of (bytes_in_per_sec, bytes_out_per_sec)
        """
        now = datetime.now().timestamp()
        
        with self._lock:
            if interface not in self._current_stats:
                return (0.0, 0.0)
            
            current = self._current_stats[interface]
            
            if self._last_update_time == 0:
                self._last_bytes_in[interface] = current.bytes_in
                self._last_bytes_out[interface] = current.bytes_out
                self._last_update_time = now
                return (0.0, 0.0)
            
            time_delta = now - self._last_update_time
            if time_delta <= 0:
                return (0.0, 0.0)
            
            bytes_in_delta = current.bytes_in - self._last_bytes_in.get(interface, 0)
            bytes_out_delta = current.bytes_out - self._last_bytes_out.get(interface, 0)
            
            speed_in = max(0, bytes_in_delta) / time_delta
            speed_out = max(0, bytes_out_delta) / time_delta
            
            # Update last values
            self._last_bytes_in[interface] = current.bytes_in
            self._last_bytes_out[interface] = current.bytes_out
            self._last_update_time = now
            
            return (speed_in, speed_out)
    
    def get_historical_traffic(self, interface: Optional[str] = None,
                               hours: int = 24,
                               limit: int = 1000) -> List[TrafficStat]:
        """Get historical traffic data for graphs."""
        if not self._db_initialized:
            return []
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cutoff_time = datetime.now().timestamp() - (hours * 3600)
            
            if interface:
                cursor.execute('''
                    SELECT timestamp, interface, bytes_in, bytes_out, 
                           packets_in, packets_out, connections_count
                    FROM traffic_stats
                    WHERE timestamp > ? AND interface = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                ''', (cutoff_time, interface, limit))
            else:
                cursor.execute('''
                    SELECT timestamp, interface, bytes_in, bytes_out,
                           packets_in, packets_out, connections_count
                    FROM traffic_stats
                    WHERE timestamp > ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                ''', (cutoff_time, limit))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [
                TrafficStat(
                    timestamp=row[0],
                    interface=row[1],
                    bytes_in=row[2],
                    bytes_out=row[3],
                    packets_in=row[4],
                    packets_out=row[5],
                    connections_count=row[6]
                )
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error getting historical traffic: {e}")
            return []
    
    def get_top_processes(self, hours: int = 1, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top processes by traffic usage."""
        if not self._db_initialized:
            return []
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cutoff_time = datetime.now().timestamp() - (hours * 3600)
            
            cursor.execute('''
                SELECT process_name, pid, 
                       SUM(bytes_sent) as total_sent,
                       SUM(bytes_recv) as total_recv,
                       SUM(connections_count) as total_connections
                FROM process_stats
                WHERE timestamp > ?
                GROUP BY pid, process_name
                ORDER BY (total_sent + total_recv) DESC
                LIMIT ?
            ''', (cutoff_time, limit))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'process_name': row[0],
                    'pid': row[1],
                    'bytes_sent': row[2],
                    'bytes_recv': row[3],
                    'total_bytes': row[2] + row[3],
                    'connections': row[4]
                }
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error getting top processes: {e}")
            return []
    
    def get_total_traffic(self, hours: int = 24) -> Dict[str, int]:
        """Get total traffic summary."""
        if not self._db_initialized:
            return {'bytes_in': 0, 'bytes_out': 0}
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cutoff_time = datetime.now().timestamp() - (hours * 3600)
            
            cursor.execute('''
                SELECT SUM(bytes_in), SUM(bytes_out)
                FROM traffic_stats
                WHERE timestamp > ?
            ''', (cutoff_time,))
            
            row = cursor.fetchone()
            conn.close()
            
            return {
                'bytes_in': row[0] or 0,
                'bytes_out': row[1] or 0
            }
            
        except Exception as e:
            logger.error(f"Error getting total traffic: {e}")
            return {'bytes_in': 0, 'bytes_out': 0}
    
    def clear_old_data(self, days: int = 7):
        """Clear data older than specified days."""
        if not self._db_initialized:
            return
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cutoff_time = datetime.now().timestamp() - (days * 86400)
            
            cursor.execute('DELETE FROM traffic_stats WHERE timestamp < ?', (cutoff_time,))
            cursor.execute('DELETE FROM process_stats WHERE timestamp < ?', (cutoff_time,))
            cursor.execute('DELETE FROM connections_log WHERE timestamp < ?', (cutoff_time,))
            
            deleted = cursor.rowcount
            conn.commit()
            conn.close()
            
            logger.info(f"Cleared {deleted} old records")
            
        except Exception as e:
            logger.error(f"Error clearing old data: {e}")
    
    def export_logs(self, output_path: str) -> bool:
        """Export all logs to CSV file."""
        if not self._db_initialized:
            return False
        
        try:
            conn = sqlite3.connect(self.db_path)
            
            with open(output_path, 'w') as f:
                f.write("type,timestamp,interface,pid,process,bytes_in,bytes_out,details\n")
                
                # Export traffic stats
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM traffic_stats ORDER BY timestamp')
                for row in cursor.fetchall():
                    f.write(f"traffic,{row[1]},{row[2]},,,{row[3]},{row[4]},\n")
                
                # Export process stats
                cursor.execute('SELECT * FROM process_stats ORDER BY timestamp')
                for row in cursor.fetchall():
                    f.write(f"process,{row[1]},,{row[2]},{row[3]},{row[4]},{row[5]},\n")
                
                # Export connections
                cursor.execute('SELECT * FROM connections_log ORDER BY timestamp')
                for row in cursor.fetchall():
                    details = f"{row[2]}:{row[4]}->{row[3]}:{row[5]}({row[6]})"
                    f.write(f"connection,{row[1]},,{row[8]},,{row[7]},,{details}\n")
            
            conn.close()
            logger.info(f"Exported logs to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error exporting logs: {e}")
            return False
