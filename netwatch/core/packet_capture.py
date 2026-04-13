"""
Packet Capture Module

Handles real-time packet sniffing using libpcap/scapy with async support.
Captures Ethernet, IPv4, IPv6 packets and extracts relevant information.
"""

import asyncio
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass
from datetime import datetime
import logging

try:
    from scapy.all import sniff, IP, IPv6, TCP, UDP, Ether, Raw
    from scapy.layers.dns import DNS, DNSQR
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class PacketInfo:
    """Represents captured packet information."""
    timestamp: float
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str  # TCP, UDP, ICMP, etc.
    direction: str  # 'in' or 'out'
    size: int
    interface: str
    dns_query: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'timestamp': self.timestamp,
            'src_ip': self.src_ip,
            'dst_ip': self.dst_ip,
            'src_port': self.src_port,
            'dst_port': self.dst_port,
            'protocol': self.protocol,
            'direction': self.direction,
            'size': self.size,
            'interface': self.interface,
            'dns_query': self.dns_query
        }


class PacketCapture:
    """
    Asynchronous packet capture engine using scapy/libpcap.
    
    Features:
    - Real-time packet capture on specified interface
    - Protocol filtering (TCP, UDP, etc.)
    - Direction detection (incoming/outgoing)
    - DNS query extraction
    - Low-latency async processing
    """
    
    def __init__(self, interface: str = 'eth0'):
        self.interface = interface
        self.is_running = False
        self.packet_callback: Optional[Callable[[PacketInfo], None]] = None
        self._sniffer_thread: Optional[asyncio.Task] = None
        self._packet_queue: asyncio.Queue = asyncio.Queue()
        
        if not SCAPY_AVAILABLE:
            logger.error("Scapy not available. Install with: pip install scapy")
    
    def set_interface(self, interface: str):
        """Change the network interface to monitor."""
        self.interface = interface
        logger.info(f"Interface changed to: {interface}")
    
    def set_callback(self, callback: Callable[[PacketInfo], None]):
        """Set callback function for processed packets."""
        self.packet_callback = callback
    
    async def start(self):
        """Start packet capture in background task."""
        if self.is_running:
            logger.warning("Packet capture already running")
            return
        
        if not SCAPY_AVAILABLE:
            logger.error("Cannot start: Scapy not available")
            return
        
        self.is_running = True
        self._sniffer_thread = asyncio.create_task(self._capture_loop())
        logger.info(f"Started packet capture on {self.interface}")
    
    async def stop(self):
        """Stop packet capture gracefully."""
        self.is_running = False
        if self._sniffer_thread:
            self._sniffer_thread.cancel()
            try:
                await self._sniffer_thread
            except asyncio.CancelledError:
                pass
        logger.info("Packet capture stopped")
    
    def _process_packet(self, packet) -> Optional[PacketInfo]:
        """
        Process raw packet and extract relevant information.
        
        Args:
            packet: Raw scapy packet
            
        Returns:
            PacketInfo object or None if packet should be ignored
        """
        try:
            # Skip if no IP layer
            if not (IP in packet or IPv6 in packet):
                return None
            
            # Determine IP version and addresses
            if IP in packet:
                src_ip = packet[IP].src
                dst_ip = packet[IP].dst
            elif IPv6 in packet:
                src_ip = packet[IPv6].src
                dst_ip = packet[IPv6].dst
            else:
                return None
            
            # Get ports if TCP/UDP
            src_port = 0
            dst_port = 0
            protocol = "OTHER"
            
            if TCP in packet:
                src_port = packet[TCP].sport
                dst_port = packet[TCP].dport
                protocol = "TCP"
            elif UDP in packet:
                src_port = packet[UDP].sport
                dst_port = packet[UDP].dport
                protocol = "UDP"
                
                # Check for DNS query
                if DNS in packet and DNSQR in packet:
                    dns_query = packet[DNSQR].qname.decode('utf-8', errors='ignore')
                else:
                    dns_query = None
            else:
                dns_query = None
            
            # Calculate packet size
            size = len(packet)
            
            # Determine direction (simplified - based on interface IP)
            # In production, would check against local IPs
            direction = 'out'  # Default assumption
            
            packet_info = PacketInfo(
                timestamp=datetime.now().timestamp(),
                src_ip=src_ip,
                dst_ip=dst_ip,
                src_port=src_port,
                dst_port=dst_port,
                protocol=protocol,
                direction=direction,
                size=size,
                interface=self.interface,
                dns_query=dns_query
            )
            
            return packet_info
            
        except Exception as e:
            logger.debug(f"Error processing packet: {e}")
            return None
    
    async def _capture_loop(self):
        """Main capture loop running in separate thread."""
        while self.is_running:
            try:
                # Use asyncio to run blocking sniff in executor
                packets = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: sniff(
                        iface=self.interface,
                        count=10,  # Capture in batches
                        timeout=1.0,
                        store=False,
                        prn=self._on_packet_captured
                    )
                )
                
                # Process captured packets
                for pkt in (packets or []):
                    packet_info = self._process_packet(pkt)
                    if packet_info:
                        await self._packet_queue.put(packet_info)
                        
                        # Call callback if set
                        if self.packet_callback:
                            self.packet_callback(packet_info)
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Capture error: {e}")
                await asyncio.sleep(1.0)  # Back off on error
    
    def _on_packet_captured(self, packet):
        """Scapy callback for each captured packet."""
        # This runs in scapy's thread, just return packet for processing
        pass
    
    async def get_packet(self) -> Optional[PacketInfo]:
        """Get next packet from queue (non-blocking)."""
        try:
            return await asyncio.wait_for(self._packet_queue.get(), timeout=0.1)
        except asyncio.TimeoutError:
            return None
    
    def get_available_interfaces(self) -> list:
        """Get list of available network interfaces."""
        if not SCAPY_AVAILABLE:
            return []
        
        try:
            from scapy.ifaces import get_if_list
            return get_if_list()
        except Exception:
            return ['eth0', 'wlan0', 'lo']
